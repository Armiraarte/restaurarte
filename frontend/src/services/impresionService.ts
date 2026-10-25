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
  /** Computadora que imprime cuando está conectada por internet (la del instalador). */
  equipo?: string | null;
  configuracionConservada?: boolean;
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
  if (!res.ok) {
    // El servidor puede conservar las asignaciones aunque la PC no responda a esta consulta.
    if (ruta === '/estado' && data.agente === false && data.asignaciones) return data;
    throw new Error(data.error || 'Error de impresión.');
  }
  return data;
}

export function obtenerEstadoImpresion(): Promise<EstadoImpresion> {
  return pedir('/estado');
}

/**
 * Sincronizar: la computadora de las impresoras vuelve a buscarlas en Windows y reinicia limpio su impresión.
 * Si está desconectada, `error` dice cuál es, desde qué hora y qué hacer.
 */
export function sincronizarImpresoras(): Promise<EstadoImpresion> {
  return pedir('/sincronizar', { method: 'POST', body: '{}' });
}

export function asignarImpresora(destino: DestinoImpresion, impresora: string): Promise<EstadoImpresion> {
  return pedir('/asignacion', { method: 'PUT', body: JSON.stringify({ destino, impresora }) });
}

export function imprimirPrueba(destino: DestinoImpresion = 'caja'): Promise<{ ok: true; impresora: string; destino: DestinoImpresion }> {
  return pedir('/prueba', { method: 'POST', body: JSON.stringify({ destino }) });
}

/**
 * Descarga el instalador de impresión (un .exe) para abrirlo en la computadora donde están conectadas las impresoras:
 * instala drivers e impresoras, el programa de impresión y lo conecta a este sistema. Una página web no puede
 * instalar drivers, por eso se descarga. `alAvanzar` recibe el avance de 0 a 1 (pesa unos 36 MB).
 */
export async function descargarInstaladorImpresoras(alAvanzar?: (avance: number) => void): Promise<void> {
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
  const total = Number(res.headers.get('Content-Length')) || 0;
  const partes: Uint8Array<ArrayBuffer>[] = [];
  let recibido = 0;
  try {
    const lector = res.body!.getReader();
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      partes.push(value);
      recibido += value.length;
      if (total) alAvanzar?.(recibido / total);
    }
  } catch {
    throw new Error('Se cortó la descarga. Vuelve a intentarlo.');
  }
  const url = URL.createObjectURL(new Blob(partes, { type: 'application/octet-stream' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = 'Instalar-impresoras-SOFT-RESTAURANTE.exe';
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
