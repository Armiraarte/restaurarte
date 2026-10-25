// Productos que se terminaron (apartado «Agotados»): mientras lo estén, en el menú salen en gris y no se pueden
// comandar. GET/PUT/DELETE /api/agotados; cada cambio llega en vivo (aviso 'menu') a las pantallas abiertas.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getToken } from './authService';
import { useEnVivo } from './enVivo';
import { useCadaTantoVisible } from './sincronizacion';

export interface Agotado {
  idProducto: number;
  desde: string; // ISO 8601
  por: string;
}

async function pedir(ruta: string, init: RequestInit = {}): Promise<Agotado[]> {
  let res: Response;
  try {
    res = await fetch(`/api/agotados${ruta}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken() ?? ''}` },
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'No se pudo actualizar lo agotado.');
  return Array.isArray(data.agotados) ? data.agotados : [];
}

export const obtenerAgotados = () => pedir('');
export const marcarAgotado = (idProducto: number, agotado: boolean) =>
  pedir(`/${idProducto}`, { method: 'PUT', body: JSON.stringify({ agotado }) });
export const todoDisponible = () => pedir('', { method: 'DELETE' });

/**
 * Lo agotado, siempre al día: se lee al abrir, con cada aviso en vivo y, de respaldo, cada minuto.
 * `ids`: para saber rápido si un producto se terminó.
 */
export function useAgotados() {
  const [lista, setLista] = useState<Agotado[]>([]);
  const recargar = useCallback(
    () =>
      obtenerAgotados()
        // Igual que antes: se conserva para no volver a dibujar el menú.
        .then((nueva) => setLista((previa) => (JSON.stringify(previa) === JSON.stringify(nueva) ? previa : nueva)))
        .catch(() => {
          // sin conexión: se conserva lo último y se reintenta
        }),
    [],
  );
  useEffect(() => {
    recargar();
  }, [recargar]);
  useEnVivo(['menu'], recargar);
  useCadaTantoVisible(recargar, 60_000);
  const ids = useMemo(() => new Set(lista.map((a) => a.idProducto)), [lista]);
  return { lista, setLista, ids, recargar };
}
