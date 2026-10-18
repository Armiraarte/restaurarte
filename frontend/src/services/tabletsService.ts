// Tablets en línea y verificación de conexión: /api/tablets
import { useCallback, useEffect, useState } from 'react';
import { getToken, revisarSesionReemplazada } from './authService';
import { cadaTantoVisible } from './sincronizacion';

export interface TabletEnLinea {
  usuarioId: string;
  usuario: string;
  nombre: string;
  tablet: string | null;
  mesero: string | null;
  conectada: boolean;
  ultimoLatido: string;
  verificacion: { estado: 'pendiente' | 'verificada'; solicitadaEn: string; respuestaMs: number | null } | null;
}

async function pedir<T>(metodo: 'GET' | 'POST', ruta: string, cuerpo?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/tablets${ruta}`, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${getToken() ?? ''}`,
        ...(cuerpo ? { 'Content-Type': 'application/json' } : {}),
      },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor.');
  }
  await revisarSesionReemplazada(res);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'No se pudo completar la operación.');
  return data as T;
}

/** Tablet: avisa que sigue en línea. Devuelve la verificación pendiente, si el admin pidió una. */
export function enviarLatido(datos: { tablet: string | null; mesero: string | null }) {
  return pedir<{ verificacion: { id: string } | null }>('POST', '/latido', datos);
}

export function confirmarVerificacion(id: string) {
  return pedir<{ ok: true }>('POST', `/verificacion/${encodeURIComponent(id)}/confirmar`);
}

export function salirDeLinea() {
  return pedir<{ ok: true }>('POST', '/salir');
}

/** Admin */
export async function listarTabletsEnLinea(): Promise<TabletEnLinea[]> {
  const { tablets } = await pedir<{ tablets: TabletEnLinea[] }>('GET', '');
  return tablets;
}

export async function pedirVerificacion(usuarioId: string): Promise<TabletEnLinea> {
  const { tablet } = await pedir<{ tablet: TabletEnLinea }>('POST', `/${encodeURIComponent(usuarioId)}/verificar`);
  return tablet;
}

/**
 * Tablets que han iniciado sesión, desde el servidor (las mismas de «Tablets en línea»).
 * Se vuelve a leer cada 3 s. null mientras carga.
 */
export function useTabletsEnLinea(intervaloMs = 3_000) {
  const [tablets, setTablets] = useState<TabletEnLinea[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cargar = useCallback(async () => {
    try {
      setTablets(await listarTabletsEnLinea());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las tablets.');
    }
  }, []);
  useEffect(() => {
    cargar();
    // Solo mientras la pantalla está a la vista (en una tablet con la pantalla apagada no se consulta).
    return cadaTantoVisible(cargar, intervaloMs);
  }, [cargar, intervaloMs]);
  return { tablets, error };
}
