// Errores de la app: en vez de que la pantalla se quede en blanco o la app se cierre sin decir nada,
// cada error se guarda aquí y se muestra en las alertas (componentes/AlertasErrores.tsx) con su problema real.
// Se juntan:
//   - errores al dibujar una pantalla (React, ver main.tsx y LimiteDeErrores),
//   - errores de JavaScript sin atrapar y promesas rechazadas sin .catch,
//   - console.error y lo que el código mande con registrarError(),
//   - si la app se cerró sola mientras estaba en pantalla (p. ej. la tablet se quedó sin memoria):
//     se avisa al volver a abrirla, con la memoria que usaba.
// Se guardan en localStorage (los últimos 20) para verlos aunque la app se haya recargado.
import { useSyncExternalStore } from 'react';

export type OrigenError = 'pantalla' | 'script' | 'promesa' | 'consola' | 'app' | 'cierre';

export interface ErrorApp {
  id: string;
  origen: OrigenError;
  mensaje: string;
  /** Pila, componente, datos para diagnosticar. */
  detalle: string;
  /** Pantalla donde pasó. */
  ruta: string;
  primeraVez: string;
  ultimaVez: string;
  veces: number;
  /** Ya se mostró su alerta (sigue en la lista). */
  visto: boolean;
}

const CLAVE = 'app_errores'; // sin prefijo pos_ para no disparar la sincronización entre pestañas
const MAXIMO = 20;
const LARGO_DETALLE = 4_000;
/** Desde esta memoria (MB) un cierre de golpe sí se avisa como posible falta de memoria. */
const MEMORIA_ALTA_MB = 150;

let errores: ErrorApp[] = leerGuardados();
const oyentes = new Set<() => void>();

function leerGuardados(): ErrorApp[] {
  try {
    const guardados = JSON.parse(localStorage.getItem(CLAVE) ?? '[]');
    if (!Array.isArray(guardados)) return [];
    // Se quitan los avisos de «se cerró sola» que se guardaron con poca memoria: eran falsas alarmas.
    return guardados.filter((e: ErrorApp) => {
      if (e.origen !== 'cierre') return true;
      const mb = Number(/memoria de la app en ese momento: (\d+) MB/i.exec(e.detalle ?? '')?.[1]);
      return mb >= MEMORIA_ALTA_MB;
    });
  } catch {
    return [];
  }
}

function publicar(lista: ErrorApp[]) {
  errores = lista;
  try {
    localStorage.setItem(CLAVE, JSON.stringify(lista));
  } catch {
    // sin espacio o sin almacenamiento: las alertas siguen en memoria
  }
  oyentes.forEach((fn) => fn());
}

function describir(error: unknown): { mensaje: string; detalle: string } {
  if (error instanceof Error) {
    return { mensaje: error.message || error.name, detalle: error.stack ?? '' };
  }
  if (typeof error === 'string') return { mensaje: error, detalle: '' };
  try {
    return { mensaje: JSON.stringify(error) ?? String(error), detalle: '' };
  } catch {
    return { mensaje: String(error), detalle: '' };
  }
}

/** Agrega un error a las alertas. Si ya estaba (mismo origen y mensaje), solo suma una vez más. */
export function registrarError(error: unknown, origen: OrigenError = 'app', extra = '') {
  const { mensaje, detalle: pila } = describir(error);
  const detalle = [pila, extra].filter(Boolean).join('\n\n').slice(0, LARGO_DETALLE);
  const ahora = new Date().toISOString();
  const previo = errores.find((e) => e.origen === origen && e.mensaje === mensaje);
  const nuevo: ErrorApp = previo
    ? { ...previo, detalle: detalle || previo.detalle, ultimaVez: ahora, veces: previo.veces + 1, visto: false }
    : {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        origen,
        mensaje: mensaje.slice(0, 500),
        detalle,
        ruta: window.location.pathname,
        primeraVez: ahora,
        ultimaVez: ahora,
        veces: 1,
        visto: false,
      };
  publicar([nuevo, ...errores.filter((e) => e !== previo)].slice(0, MAXIMO));
}

export function marcarVisto(id: string) {
  if (errores.some((e) => e.id === id && !e.visto)) publicar(errores.map((e) => (e.id === id ? { ...e, visto: true } : e)));
}

export function descartarError(id: string) {
  publicar(errores.filter((e) => e.id !== id));
}

export function limpiarErrores() {
  publicar([]);
}

function suscribir(fn: () => void) {
  oyentes.add(fn);
  return () => {
    oyentes.delete(fn);
  };
}

export function useErrores(): ErrorApp[] {
  return useSyncExternalStore(suscribir, () => errores);
}

/** Texto de todos los errores, para copiarlo y mandarlo a quien da soporte. */
export function textoErrores(lista: ErrorApp[]): string {
  const equipo = `${navigator.userAgent} · pantalla ${window.innerWidth}×${window.innerHeight}`;
  return [
    `Errores de SOFT RESTAURANTE (${new Date().toLocaleString('es-MX')})`,
    equipo,
    ...lista.map((e) =>
      [`--- [${e.origen}] ${e.mensaje}`, `${e.veces} vez/veces · última ${e.ultimaVez} · ${e.ruta}`, e.detalle].filter(Boolean).join('\n'),
    ),
  ].join('\n\n');
}

/* ---------- Vigilancia global (se llama una vez al arrancar, en main.tsx) ---------- */

const CLAVE_PULSO = 'app_pulso';
const INTERVALO_PULSO_MS = 10_000;

interface Pulso {
  en: number;
  estado: 'visible' | 'oculta' | 'cerrada';
  ruta: string;
  memoriaMb: number | null;
}

/** Memoria de JavaScript en uso (solo Chrome la informa). */
function memoriaMb(): number | null {
  const memoria = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  return memoria ? Math.round(memoria.usedJSHeapSize / 1_048_576) : null;
}

function guardarPulso(estado: Pulso['estado']) {
  try {
    const pulso: Pulso = { en: Date.now(), estado, ruta: window.location.pathname, memoriaMb: memoriaMb() };
    localStorage.setItem(CLAVE_PULSO, JSON.stringify(pulso));
  } catch {
    // sin almacenamiento: no se puede detectar el cierre
  }
}

/** Si la última vez la app estaba en pantalla y no se cerró normalmente, es que se cerró sola. */
function revisarCierreAnterior() {
  let previo: Pulso | null = null;
  try {
    previo = JSON.parse(localStorage.getItem(CLAVE_PULSO) ?? 'null');
  } catch {
    return;
  }
  if (previo?.estado !== 'visible') return;
  // Solo se avisa si la app usaba mucha memoria. Con poca (p. ej. 4 MB) no fue por memoria: lo normal es que
  // se haya forzado el cierre o reiniciado la tablet, y no es una falla de la app.
  if (previo.memoriaMb === null || previo.memoriaMb < MEMORIA_ALTA_MB) return;
  const memoriaEquipo = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  registrarError(
    `La app se cerró sola mientras estaba en pantalla; usaba ${previo.memoriaMb} MB de memoria (la tablet se quedó sin memoria).`,
    'cierre',
    [
      `Último registro: ${new Date(previo.en).toLocaleString('es-MX')} en ${previo.ruta}`,
      `Memoria de la app en ese momento: ${previo.memoriaMb} MB`,
      memoriaEquipo ? `Memoria del equipo: ~${memoriaEquipo} GB` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  );
}

let vigilando = false;

export function vigilarErrores() {
  if (vigilando) return;
  vigilando = true;

  window.addEventListener('error', (e) => registrarError(e.error ?? e.message, 'script', e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : ''));
  window.addEventListener('unhandledrejection', (e) => registrarError(e.reason, 'promesa'));

  const consolaError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    consolaError(...args);
    const error = args.find((a) => a instanceof Error);
    const texto = args.filter((a) => typeof a === 'string').join(' ');
    if (error || texto) registrarError(error ?? texto, 'consola', error && texto ? texto : '');
  };

  revisarCierreAnterior();
  guardarPulso(document.visibilityState === 'visible' ? 'visible' : 'oculta');
  setInterval(() => {
    if (document.visibilityState === 'visible') guardarPulso('visible');
  }, INTERVALO_PULSO_MS);
  document.addEventListener('visibilitychange', () => guardarPulso(document.visibilityState === 'visible' ? 'visible' : 'oculta'));
  window.addEventListener('pagehide', () => guardarPulso('cerrada'));
}
