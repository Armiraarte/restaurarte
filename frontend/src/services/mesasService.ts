// Registro de mesas en la base de datos (tabla `mesas` de Laravel): POST /api/mesas
import { getToken } from './authService';

/** Fila de `mesas`. BD: tipo_venta_id 1 = comer aquí, 2 = para llevar; estatus 0 = ABIERTA, 1 = PAGANDO (pidió la cuenta), 2 = PAGADO. */
export interface MesaRegistrada {
  id: number; // Autoincrementable, asignado por MySQL.
  codigo: string; // Código generado de la orden: "T1-001"
  nombre: string; // Número de mesa ("5") o nombre del cliente ("Juan")
  tipo_venta_id: number;
  total: string;
  estatus: number;
  creado_en?: string;
  actualizado_en?: string; // al cobrarla (PAGADO) es la hora del cobro
}

/**
 * Inserta la mesa al agregarla desde la tablet. Si ya existía una con ese código, el servidor
 * devuelve esa misma (creada = false) en lugar de duplicarla.
 */
export async function registrarMesa(codigo: string, paraLlevar: boolean): Promise<{ mesa: MesaRegistrada; creada: boolean }> {
  let res: Response;
  try {
    res = await fetch('/api/mesas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken() ?? ''}` },
      body: JSON.stringify({ nombre: codigo, tipo_venta_id: paraLlevar ? 2 : 1 }),
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor; la mesa no se registró.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'No se pudo registrar la mesa.');
  return data;
}

/** Mesas registradas en el turno abierto (lo único que la tablet muestra). Sin turno, la lista va vacía. */
export async function listarMesasTurno(): Promise<{ turno: { id: number } | null; mesas: MesaRegistrada[] }> {
  let res: Response;
  try {
    res = await fetch('/api/mesas', { headers: { Authorization: `Bearer ${getToken() ?? ''}` } });
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
