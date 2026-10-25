// Monitor de la computadora de las impresoras (backend/src/monitorImpresion.ts): conexiones, desconexiones e
// impresiones. Solo lo ve el usuario autorizado; a los demás el servidor les contesta 403.
import { fetchConSesion } from './authService';

import type { MonitorImpresion } from './monitorCalculos';
export * from './monitorCalculos';

/** Error 403: el usuario no tiene permiso (no se vuelve a intentar). */
export class SinPermisoMonitor extends Error {}

export async function obtenerMonitorImpresion(): Promise<MonitorImpresion> {
  let res: Response;
  try {
    res = await fetchConSesion('/api/monitor/impresion');
  } catch {
    throw new Error('No se pudo conectar con el servidor.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 403) throw new SinPermisoMonitor(data.error || 'Sin permiso.');
  if (!res.ok) throw new Error(data.error || 'No se pudo cargar el monitor.');
  return data;
}
