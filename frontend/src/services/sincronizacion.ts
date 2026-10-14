// Datos compartidos entre la caja web y las tablets. Se actualizan al momento con los avisos en vivo
// del servidor (services/enVivo.ts) y, como respaldo, se vuelven a leer cada pocos segundos:
// el turno abierto (tabla turnos) y las mesas registradas en ese turno (tabla mesas).
import { useCallback, useEffect, useState } from 'react';
import { listarMesasTurno, MesaRegistrada } from './mesasService';
import { obtenerTurnoActual, TurnoActual } from './turnosService';
import { useEnVivo } from './enVivo';

const INTERVALO_MESAS_MS = 5_000;
const INTERVALO_TURNO_MS = 15_000;

/** Turno abierto: undefined mientras carga, null si la caja no ha iniciado turno. */
export function useTurnoActual(): TurnoActual | null | undefined {
  const [turno, setTurno] = useState<TurnoActual | null | undefined>(undefined);
  const cargar = useCallback(
    () =>
      obtenerTurnoActual()
        .then(setTurno)
        .catch(() => {
          // sin conexión: se conserva el último valor y se reintenta
        }),
    []
  );
  useEffect(() => {
    cargar();
    const id = setInterval(cargar, INTERVALO_TURNO_MS);
    return () => clearInterval(id);
  }, [cargar]);
  useEnVivo(['turno'], cargar);
  return turno;
}

/** Mesas registradas en el turno abierto. `recargar` las vuelve a pedir al momento (p. ej. tras agregar una). */
export function useMesasTurno() {
  const [mesas, setMesas] = useState<MesaRegistrada[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recargar = useCallback(async () => {
    try {
      setMesas((await listarMesasTurno()).mesas);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las mesas.');
    }
  }, []);
  useEffect(() => {
    recargar();
    const id = setInterval(recargar, INTERVALO_MESAS_MS);
    return () => clearInterval(id);
  }, [recargar]);
  useEnVivo(['ordenes'], recargar);
  return { mesas, error, recargar };
}
