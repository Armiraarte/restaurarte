// Registro de mesas en la base de datos (tabla `mesas` de Laravel): POST /api/mesas
import { fetchConSesion } from './authService';

/** Fila de `mesas`. BD: tipo_venta_id 1 = comer aquí, 2 = para llevar; estatus 0 = ABIERTA, 1 = PAGANDO (pidió la cuenta), 2 = PAGADO. */
export interface MesaRegistrada {
  id: number; // Autoincrementable, asignado por MySQL.
  codigo: string; // Código generado de la orden: "T1-001"
  nombre: string; // Número de mesa ("5") o nombre del cliente ("Juan")
  origen?: 'mesa' | 'llamada' | 'nombre';
  tipo_venta_id: number;
  total: string;
  estatus: number;
  creado_en?: string;
  actualizado_en?: string; // al cobrarla (PAGADO) es la hora del cobro
  cuentas_divididas?: number; // en cuántas cuentas se dividió con el botón Dividir (0 = no se dividió)
  partes_divididas?: { numero: number; importe: number }[]; // lo de cada cuenta (Cuenta 1, 2…)
}

/**
 * Abre la orden de esa mesa del croquis (número del 1 al 9) o a nombre de un cliente.
 * Si esa mesa o ese nombre ya tiene una orden activa, el servidor devuelve la misma.
 */
export async function registrarMesa(codigo: string, paraLlevar: boolean, origen?: 'mesa' | 'llamada' | 'nombre'): Promise<{ mesa: MesaRegistrada; creada: boolean }> {
  let res: Response;
  try {
    res = await fetchConSesion('/api/mesas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: codigo, tipo_venta_id: paraLlevar ? 2 : 1, ...(origen && { origen }) }),
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor; la mesa no se registró.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'No se pudo registrar la mesa.');
  return data;
}

/** Cambia la orden `id` a la mesa libre `mesa` (1 a 9) con todo lo que tiene; devuelve el número anterior. */
export async function cambiarMesa(id: number, mesa: string): Promise<{ mesa: MesaRegistrada; anterior: string }> {
  let res: Response;
  try {
    res = await fetchConSesion(`/api/mesas/${id}/cambiar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mesa }),
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor; la mesa no se cambió.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'No se pudo cambiar de mesa.');
  return data;
}

/**
 * Mesas registradas en el turno abierto (lo único que la tablet muestra). Sin turno, la lista va vacía.
 * mesaPrueba: número de la mesa de prueba (solo en la PC de desarrollo; en producción siempre null).
 */
export async function listarMesasTurno(): Promise<{ turno: { id: number } | null; mesas: MesaRegistrada[]; mesaPrueba?: string | null }> {
  let res: Response;
  try {
    res = await fetchConSesion('/api/mesas');
  } catch {
    throw new Error('No se pudo conectar con el servidor.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'No se pudieron cargar las mesas.');
  return data;
}

/** "5" → "Mesa 5"; un nombre ("Juan") se muestra tal cual. Es el mismo identificador de la cuenta local. */
export const etiquetaMesaRegistrada = (m: Pick<MesaRegistrada, 'nombre'>) => (/^\d+$/.test(m.nombre) ? `Mesa ${m.nombre}` : m.nombre);

/** Órdenes activas (ABIERTA 0 o PAGANDO 1). Las PAGADAS (2) ya no se muestran en Órdenes ni en la tablet: van a Ventas. */
export const esOrdenActiva = (m: Pick<MesaRegistrada, 'estatus'>) => m.estatus !== 2;
