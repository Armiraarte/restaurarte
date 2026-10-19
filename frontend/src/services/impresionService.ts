import { getToken } from './authService';

export interface Impresora {
  nombre: string;
  driver: string;
  puerto: string;
  usb: boolean;
  conectada: boolean;
  predeterminada: boolean;
}

export interface EstadoImpresion {
  agente: boolean;
  impresoras?: Impresora[];
  ticket?: Impresora | null;
  asignaciones?: Record<DestinoImpresion, string | null>;
  destinos?: Record<DestinoImpresion, Impresora | null>;
  error?: string;
}

export type DestinoImpresion = 'cocina' | 'caja';

async function pedir(ruta: string, init?: RequestInit) {
  let res: Response;
  try {
    res = await fetch(`/api/impresion${ruta}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error de impresión.');
  return data;
}

export function obtenerEstadoImpresion(): Promise<EstadoImpresion> {
  return pedir('/estado');
}

export function asignarImpresora(destino: DestinoImpresion, impresora: string): Promise<EstadoImpresion> {
  return pedir('/asignacion', { method: 'PUT', body: JSON.stringify({ destino, impresora }) });
}

export function imprimirPrueba(destino: DestinoImpresion = 'caja'): Promise<{ ok: true; impresora: string; destino: DestinoImpresion }> {
  return pedir('/prueba', { method: 'POST', body: JSON.stringify({ destino }) });
}

/**
 * Descarga el instalador de las impresoras (drivers de la Star TSP143 y registro de la Axiohm) para abrirlo en
 * la computadora donde están conectadas. Una página web no puede instalar drivers: se descarga y se abre
 * INSTALAR.cmd (pide permiso de administrador).
 */
export async function descargarInstaladorImpresoras(): Promise<void> {
  let res: Response;
  try {
    res = await fetch('/api/impresion/instalador', { headers: { Authorization: `Bearer ${getToken()}` } });
  } catch {
    throw new Error('No se pudo conectar con el servidor.');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo descargar el instalador.');
  }
  const url = URL.createObjectURL(await res.blob());
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = 'Drivers-impresoras-SOFT-RESTAURANTE.zip';
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
