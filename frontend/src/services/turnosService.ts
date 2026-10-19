// Turnos: el de caja lo inicia a propósito el administrador o cajero (botón «Iniciar turno»); sin él no se cobra
// ni se activan tabletas. Cada tablet abre su sesión dentro de ese turno. BD: tablas turnos y sesiones_tablet.
import { getToken } from './authService';

/** Error que indica que la caja aún no inicia turno (la tablet no puede empezar). */
export class SinTurnoError extends Error {}

/** Error del corte: trae las órdenes que faltan por cobrar. */
export class CortePendienteError extends Error {
  constructor(mensaje: string, public pendientes: ResumenTurno['pendientes']) {
    super(mensaje);
  }
}

async function pedir<T>(ruta: string, metodo: 'GET' | 'POST' = 'POST'): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/turnos${ruta}`, { method: metodo, headers: { Authorization: `Bearer ${getToken() ?? ''}` } });
  } catch {
    throw new Error('No se pudo conectar con el servidor.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (data.sinTurno) throw new SinTurnoError(data.error || 'La caja no ha iniciado turno.');
    if (Array.isArray(data.pendientes)) throw new CortePendienteError(data.error, data.pendientes);
    throw new Error(data.error || 'No se pudo completar la operación.');
  }
  return data as T;
}

/** Caja (admin/cajero): inicia el turno; si ya hay uno abierto, devuelve ese. */
/** ordenesTraidas: órdenes sin cobrar de un turno que se cerró solo a la medianoche, que pasan a este turno. */
export const iniciarTurno = () => pedir<{ turno: { idTurno: number }; nuevo: boolean; ordenesTraidas?: number }>('/iniciar');

/** Tablet: abre su sesión dentro del turno de caja. Lanza SinTurnoError si la caja no ha iniciado turno. */
export const iniciarSesionTablet = () => pedir<{ turno: { idTurno: number }; sesion: { id: number } }>('/sesion-tablet');

/** Tablet: cierra su sesión al cerrar sesión. */
export const cerrarSesionTablet = () => pedir<{ ok: true }>('/sesion-tablet/cerrar');

/** Fila de `turnos` (estatus 1 = abierto, 0 = cerrado). */
export interface TurnoActual {
  idTurno: number;
  idUsuario: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  estatus: number;
}

/** Turno de caja abierto, o null si la caja aún no inicia turno. */
export const obtenerTurnoActual = () => pedir<{ turno: TurnoActual | null }>('/actual', 'GET').then((d) => d.turno);

/* ---------- Corte de turno (módulo Turnos) ---------- */

export interface ResumenTurno {
  turno: { idTurno: number; idUsuario: string; abrio: string; fecha_inicio: string; fecha_fin: string | null; estatus: number };
  ordenes: { abiertas: number; pagando: number; pagadas: number; sinPedido: number };
  totalVendido: number;
  pendientes: { idOrden: number; nombre: string; total: number; estatus: number }[];
  productos: { categoria: string; nombre: string; cantidad: number; importe: number }[];
  tablets: { usadas: number; conectadas: number };
  /** Registro del cierre (BD: cierres_turno); null mientras el turno está abierto. */
  cierre: { tipo: TipoCierre; cerro: string | null; cerrado_en: string; ordenes_pendientes: number } | null;
}

/** 'corte': la caja hizo el corte. 'automatico': nadie lo hizo y el turno se cerró solo a la medianoche. */
export type TipoCierre = 'corte' | 'automatico';

export interface TurnoCerrado {
  idTurno: number;
  abrio: string;
  fecha_inicio: string;
  fecha_fin: string;
  ordenes_cobradas: number;
  total_vendido: number;
  /** null en turnos cerrados antes de que existiera el registro del cierre. */
  cierre_tipo: TipoCierre | null;
  cerro: string | null;
  ordenes_pendientes: number;
}

/** «cortó Ana» / «cierre automático a medianoche». */
export const textoCierre = (tipo: TipoCierre | null | undefined, cerro: string | null | undefined) =>
  tipo === 'automatico' ? 'cierre automático a medianoche' : cerro ? `cortó ${cerro}` : '';

type Impresion = { ok: boolean; error?: string };

/** Resumen del turno abierto, o null si no hay turno. */
export const obtenerResumenTurno = () => pedir<{ resumen: ResumenTurno | null }>('/resumen', 'GET').then((d) => d.resumen);

/** Resumen de un turno cerrado (corte anterior). */
export const obtenerResumenDe = (idTurno: number) => pedir<{ resumen: ResumenTurno }>(`/${idTurno}/resumen`, 'GET').then((d) => d.resumen);

/** Cortes anteriores. */
export const listarTurnosCerrados = () => pedir<{ turnos: TurnoCerrado[] }>('/historial', 'GET').then((d) => d.turnos);

/** Corte de turno: cierra el turno e imprime el ticket. Lanza CortePendienteError si faltan órdenes por cobrar. */
export const cerrarTurno = () => pedir<{ resumen: ResumenTurno; impresion: Impresion }>('/cerrar');

export const reimprimirCorte = (idTurno: number) => pedir<{ impresion: Impresion }>(`/${idTurno}/imprimir-corte`);
