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
  error?: string;
}

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

export function imprimirPrueba(): Promise<{ ok: true; impresora: string }> {
  return pedir('/prueba', { method: 'POST' });
}
