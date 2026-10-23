// Cálculos del monitor de impresión (estado actual, tramos del día, resumen): sin dependencias para poder probarlos.
export type TipoEventoMonitor = 'conectado' | 'desconectado' | 'impresion' | 'falla' | 'servidor';

export interface EventoMonitor {
  tipo: TipoEventoMonitor;
  hora: string;
  equipo?: string | null;
  destino?: string;
  ms?: number;
  detalle?: string;
}

export interface MonitorImpresion {
  ahora: string;
  /** 'produccion': esta PC vigila la laptop conectada a producción; 'este-servidor': se conecta a este servidor. */
  fuente: 'produccion' | 'este-servidor';
  revision: { hora: string | null; error: string | null } | null;
  eventos: EventoMonitor[];
}

const esDeConexion = (e: EventoMonitor) => e.tipo === 'conectado' || e.tipo === 'desconectado' || e.tipo === 'servidor';

/** Conectada o no (null: todavía sin datos), qué computadora y desde cuándo. */
export function estadoActual(eventos: EventoMonitor[]): { conectado: boolean | null; equipo: string | null; desde: string | null } {
  const ultimo = [...eventos].reverse().find(esDeConexion);
  const equipo = [...eventos].reverse().find((e) => e.equipo)?.equipo ?? null;
  if (!ultimo) return { conectado: null, equipo, desde: null };
  return { conectado: ultimo.tipo === 'conectado', equipo, desde: ultimo.hora };
}

export type EstadoTramo = 'conectado' | 'desconectado' | 'sin-datos';
export interface Tramo {
  desde: number;
  hasta: number;
  estado: EstadoTramo;
}

/** Tramos conectada / desconectada entre `inicio` y `fin` (ms), para la línea de tiempo del día. */
export function tramos(eventos: EventoMonitor[], inicio: number, fin: number): Tramo[] {
  const deConexion = eventos.filter(esDeConexion).map((e) => ({ hora: Date.parse(e.hora), conectado: e.tipo === 'conectado' }));
  const previo = [...deConexion].reverse().find((e) => e.hora <= inicio);
  let estado: EstadoTramo = previo ? (previo.conectado ? 'conectado' : 'desconectado') : 'sin-datos';
  let desde = inicio;
  const lista: Tramo[] = [];
  for (const e of deConexion) {
    if (e.hora <= inicio || e.hora >= fin) continue;
    const nuevo: EstadoTramo = e.conectado ? 'conectado' : 'desconectado';
    if (nuevo === estado) continue;
    if (e.hora > desde) lista.push({ desde, hasta: e.hora, estado });
    estado = nuevo;
    desde = e.hora;
  }
  if (fin > desde) lista.push({ desde, hasta: fin, estado });
  return lista;
}

/** Resumen de un periodo: % del tiempo vigilado que estuvo conectada, desconexiones, tickets y fallas. */
export function resumen(eventos: EventoMonitor[], inicio: number, fin: number) {
  const lista = tramos(eventos, inicio, fin);
  const conectado = lista.filter((t) => t.estado === 'conectado').reduce((acc, t) => acc + t.hasta - t.desde, 0);
  const vigilado = lista.filter((t) => t.estado !== 'sin-datos').reduce((acc, t) => acc + t.hasta - t.desde, 0);
  const enPeriodo = eventos.filter((e) => Date.parse(e.hora) >= inicio && Date.parse(e.hora) < fin);
  return {
    porcentajeConectado: vigilado ? Math.round((conectado / vigilado) * 100) : null,
    desconexiones: enPeriodo.filter((e) => e.tipo === 'desconectado').length,
    impresiones: enPeriodo.filter((e) => e.tipo === 'impresion').length,
    fallas: enPeriodo.filter((e) => e.tipo === 'falla').length,
  };
}

/** «2 h 13 min», «45 s». */
export function duracion(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
}

/** Para cada desconexión, cuánto duró la conexión anterior (por índice del evento). */
export function duracionesConexion(eventos: EventoMonitor[]): Map<number, number> {
  const duraciones = new Map<number, number>();
  let conectadoDesde: number | null = null;
  eventos.forEach((e, i) => {
    if (e.tipo === 'conectado') conectadoDesde = Date.parse(e.hora);
    else if (e.tipo === 'desconectado' || e.tipo === 'servidor') {
      if (e.tipo === 'desconectado' && conectadoDesde !== null) duraciones.set(i, Date.parse(e.hora) - conectadoDesde);
      conectadoDesde = null;
    }
  });
  return duraciones;
}
