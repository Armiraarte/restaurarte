import { fetchConSesion } from './authService';
import type { OrdenCocina } from './comandasCocina';

export async function obtenerCocina(): Promise<{ turno: { idTurno: number } | null; ordenes: OrdenCocina[] }> {
  const res = await fetchConSesion('/api/cocina');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'No se pudieron cargar las comandas.');
  return data;
}
