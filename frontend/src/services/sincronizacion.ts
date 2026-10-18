// Datos compartidos entre la caja web y las tablets. Se actualizan al momento con los avisos en vivo
// del servidor (services/enVivo.ts) y, como respaldo, se vuelven a leer cada pocos segundos:
// el turno abierto (tabla turnos) y las mesas registradas en ese turno (tabla mesas).
// Pensado para tablets modestas: con la pantalla apagada o la app en segundo plano no se consulta nada,
// y si la respuesta no cambió no se vuelve a dibujar la pantalla.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { listarMesasTurno, MesaRegistrada } from './mesasService';
import { obtenerTurnoActual, TurnoActual } from './turnosService';
import { escucharEnVivo, useEnVivo } from './enVivo';

const INTERVALO_MESAS_MS = 5_000;
const INTERVALO_TURNO_MS = 15_000;

/**
 * Llama a `fn` cada `ms` mientras la app esté a la vista; al volver a verse, la llama al momento
 * para ponerse al día. Devuelve la función para detenerlo.
 */
export function cadaTantoVisible(fn: () => void, ms: number): () => void {
  const id = setInterval(() => {
    if (document.visibilityState === 'visible') fn();
  }, ms);
  const alVolver = () => {
    if (document.visibilityState === 'visible') fn();
  };
  document.addEventListener('visibilitychange', alVolver);
  return () => {
    clearInterval(id);
    document.removeEventListener('visibilitychange', alVolver);
  };
}

/** cadaTantoVisible dentro de un componente (siempre llama a la versión más reciente de `fn`). */
export function useCadaTantoVisible(fn: () => void, ms: number) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => cadaTantoVisible(() => ref.current(), ms), [ms]);
}

/** Turno abierto: undefined mientras carga, null si la caja no ha iniciado turno. */
export function useTurnoActual(): TurnoActual | null | undefined {
  const [turno, setTurno] = useState<TurnoActual | null | undefined>(undefined);
  const cargar = useCallback(
    () =>
      obtenerTurnoActual()
        // Mismo turno que antes: se conserva el objeto para no volver a dibujar.
        .then((nuevo) => setTurno((previo) => (JSON.stringify(previo) === JSON.stringify(nuevo) ? previo : nuevo)))
        .catch(() => {
          // sin conexión: se conserva el último valor y se reintenta
        }),
    []
  );
  useEffect(() => {
    cargar();
  }, [cargar]);
  useCadaTantoVisible(cargar, INTERVALO_TURNO_MS);
  useEnVivo(['turno'], cargar);
  return turno;
}

/* ---------- Mesas del turno: una sola consulta para toda la pantalla ---------- */

// La caja usa las mesas en varios lugares a la vez (contadores del menú, Cajas, Órdenes, Ventas). Antes cada
// uno las pedía por su cuenta cada 5 s y con cada aviso; ahora todos comparten la misma consulta.

interface EstadoMesas {
  mesas: MesaRegistrada[] | null;
  error: string | null;
}

let estadoMesas: EstadoMesas = { mesas: null, error: null };
let textoMesas = '';
const oyentesMesas = new Set<() => void>();
let consultaMesas: Promise<void> | null = null;
let repetirConsulta = false;
let detenerMesas: (() => void) | null = null;

function publicarMesas(nuevo: EstadoMesas) {
  estadoMesas = nuevo;
  oyentesMesas.forEach((fn) => fn());
}

async function consultarMesas() {
  try {
    const { mesas } = await listarMesasTurno();
    const texto = JSON.stringify(mesas);
    if (texto === textoMesas && estadoMesas.error === null) return; // sin cambios: no se dibuja nada
    textoMesas = texto;
    publicarMesas({ mesas, error: null });
  } catch (err) {
    const error = err instanceof Error ? err.message : 'No se pudieron cargar las mesas.';
    if (error !== estadoMesas.error) publicarMesas({ ...estadoMesas, error });
  }
}

/**
 * Vuelve a pedir las mesas. Si ya hay una consulta en camino, se repite al terminar (para ver lo que
 * se acaba de guardar) y todos esperan esa misma.
 */
function recargarMesas(): Promise<void> {
  if (consultaMesas) {
    repetirConsulta = true;
    return consultaMesas;
  }
  consultaMesas = (async () => {
    do {
      repetirConsulta = false;
      await consultarMesas();
    } while (repetirConsulta);
  })().finally(() => {
    consultaMesas = null;
  });
  return consultaMesas;
}

function suscribirMesas(fn: () => void) {
  oyentesMesas.add(fn);
  if (!detenerMesas) {
    recargarMesas();
    const detenerIntervalo = cadaTantoVisible(recargarMesas, INTERVALO_MESAS_MS);
    const dejarEnVivo = escucharEnVivo(['ordenes'], recargarMesas);
    detenerMesas = () => {
      detenerIntervalo();
      dejarEnVivo();
    };
  }
  return () => {
    oyentesMesas.delete(fn);
    if (oyentesMesas.size === 0 && detenerMesas) {
      detenerMesas();
      detenerMesas = null;
    }
  };
}

/** Mesas registradas en el turno abierto. `recargar` las vuelve a pedir al momento (p. ej. tras agregar una). */
export function useMesasTurno() {
  const { mesas, error } = useSyncExternalStore(suscribirMesas, () => estadoMesas);
  return { mesas, error, recargar: recargarMesas };
}
