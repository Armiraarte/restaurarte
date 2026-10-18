// Menú y pedidos desde la base de datos (API: backend/src/pedidos.ts).
import { getToken } from './authService';

export interface ComplementoMenu {
  id: number;
  nombre: string;
}

export interface ProductoMenu {
  id: number; // producto.id
  nombre: string; // "Frijol"
  tamano: string | null; // "Chica", "Media orden"… o null
  precio: number;
  imagen: string | null;
  complementos: ComplementoMenu[];
}

export interface CategoriaMenu {
  id: number;
  nombre: string; // "Tacos Dorados"
  productos: ProductoMenu[];
}

export interface OrdenBD {
  idOrden: number;
  codigo: string;
  nombre: string;
  etiqueta: string; // "Mesa 5" o el nombre del cliente
  total: number;
  tipo_orden: number; // 1 = comer aquí, 2 = para llevar
  estatus: number; // 0 = ABIERTA, 1 = PAGANDO, 2 = PAGADO
  idTurno: number | null;
  creado_en: string; // cuándo llegó
  abierta_por: string; // nombre de la tablet, o "Caja"
}

export const ESTATUS_ORDEN: Record<number, string> = { 0: 'ABIERTA', 1: 'PAGANDO', 2: 'PAGADO' };

export interface DetalleOrdenBD {
  idDetalle_Orden: number;
  idProducto: number;
  categoria: string;
  nombre: string;
  tamano: string | null;
  cantidad: number;
  /** Solo Quesadillas: la pidieron sin queso (llevan queso sin registrarlo). */
  sin_queso: boolean;
  /** Solo Hamburguesas: 1 = DOBLE CARNE, 2 = TRIPLE CARNE (ya incluida en subtotal). */
  carne_extra: number;
  subtotal: number;
  creado_en: string;
}

async function pedir<T>(ruta: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${ruta}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken() ?? ''}`, ...init.headers },
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'No se pudo completar la operación.');
  return data as T;
}

/**
 * La única categoría que se puede pedir sin queso: las quesadillas llevan queso sin registrarlo y,
 * si las piden sin queso, se registra en el renglón (orden_has_detalle.sin_queso).
 */
export const CATEGORIA_SIN_QUESO = 'Quesadillas';

/**
 * Hamburguesas: DOBLE CARNE (1 extra) o TRIPLE CARNE (2 extra); cada carne extra cuesta PRECIO_CARNE_EXTRA
 * por pieza (orden_has_detalle.carne_extra; el servidor ya la incluye en el subtotal).
 */
export const CATEGORIA_CARNE_EXTRA = 'Hamburguesas';
export const PRECIO_CARNE_EXTRA = 20;
export const MAX_CARNE_EXTRA = 2;
export const textoCarneExtra = (n: number | undefined) => (n === 1 ? 'DOBLE CARNE' : n === 2 ? 'TRIPLE CARNE' : '');

/** Categorías activas con sus productos (precio y complementos). */
export const obtenerMenu = () => pedir<{ categorias: CategoriaMenu[] }>('/menu').then((d) => d.categorias);

/** Orden con su detalle y total. */
export const obtenerOrden = (idOrden: number) => pedir<{ orden: OrdenBD; detalle: DetalleOrdenBD[] }>(`/ordenes/${idOrden}`);

/** Manda productos a cocina: guarda el detalle (orden_has_detalle) y recalcula el total. */
export const enviarPedido = (
  idOrden: number,
  items: { idProducto: number; cantidad: number; sin?: number[]; sinQueso?: boolean; carneExtra?: number }[]
) =>
  pedir<{ orden: OrdenBD; detalle: DetalleOrdenBD[] }>(`/ordenes/${idOrden}/pedido`, { method: 'POST', body: JSON.stringify({ items }) });

/** Pide la cuenta: la orden pasa a PAGANDO (estatus 1) y la caja hace el cobro. */
export const pedirCuenta = (idOrden: number) =>
  pedir<{ orden: OrdenBD; detalle: DetalleOrdenBD[] }>(`/ordenes/${idOrden}/pedir-cuenta`, { method: 'POST' });

/** Cobra la orden (PAGANDO → PAGADO) con lo que entregó el cliente e imprime el ticket de cobro. */
export const cobrarOrden = (idOrden: number, recibido: number) =>
  pedir<{
    orden: OrdenBD;
    detalle: DetalleOrdenBD[];
    cobro: { total: number; recibido: number; cambio: number };
    impresion: { ok: boolean; error?: string };
  }>(`/ordenes/${idOrden}/cobrar`, { method: 'POST', body: JSON.stringify({ recibido }) });

/** Vuelve a imprimir el ticket de cobro de una orden pagada (sin `recibido` no imprime efectivo ni cambio). */
export const reimprimirTicketCobro = (idOrden: number, recibido?: number) =>
  pedir<{ impresion: { ok: boolean; error?: string } }>(`/ordenes/${idOrden}/ticket-cobro`, {
    method: 'POST',
    body: JSON.stringify({ recibido }),
  });


/** "Frijol" / "Milanesa (Grande)". */
export const nombreProducto = (p: { nombre: string; tamano: string | null }) => (p.tamano ? `${p.nombre} (${p.tamano})` : p.nombre);
