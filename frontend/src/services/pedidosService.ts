// Menú y pedidos desde la base de datos (API: backend/src/pedidos.ts).
import { getToken } from './authService';
import { terminosCategoria } from './terminosPedido';

export interface ComplementoMenu {
  id: number;
  nombre: string;
}

export interface TerminoMenu {
  id: number;
  nombre: string;
}

export interface PapasMenu {
  idProducto: number;
  nombre: string;
  tamano: string;
  precio: number;
}

export interface ProductoMenu {
  id: number; // producto.id
  nombre: string; // "Frijol"
  tamano: string | null; // "Chica", "Media orden"… o null
  grupo: string | null; // subgrupo de la categoría (Bebidas: Refrescos, Aguas, Jugos) o null
  precio: number;
  imagen: string | null;
  complementos: ComplementoMenu[];
}

export interface CategoriaMenu {
  id: number;
  nombre: string; // "Tacos Dorados"
  productos: ProductoMenu[];
  terminos?: TerminoMenu[];
  papas?: PapasMenu | null;
}

export interface OrdenBD {
  idOrden: number;
  origen?: 'mesa' | 'llamada' | 'nombre';
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

/** Cobro libre: el importe se captura al agregarlo, sin unidades ni producto de catálogo. */
export interface ExtraPedido {
  descripcion: string;
  importe: number;
}

export interface ExtraOrdenBD extends ExtraPedido {
  id: number;
  creado_en: string;
}

export const ESTATUS_ORDEN: Record<number, string> = { 0: 'ABIERTA', 1: 'PAGANDO', 2: 'PAGADO' };

export interface DetalleOrdenBD {
  idDetalle_Orden: number;
  idProducto: number;
  categoria: string;
  nombre: string;
  tamano: string | null;
  cantidad: number;
  /** Quesadillas y Hamburguesas: la pidieron sin queso. */
  sin_queso: boolean;
  /** Solo Hamburguesas: 1 = DOBLE CARNE, 2 = TRIPLE CARNE (ya incluida en subtotal). */
  carne_extra: number;
  con_queso: boolean;
  mix_grupo: number | null;
  termino_id: number | null;
  termino: string | null;
  opciones: { sin: ComplementoMenu[]; mezcla: string[]; reparto?: RepartoPedido[]; papas?: PapasMenu; complementosExtra?: ComplementoMenu[]; nota?: string;
    comanda?: { origen: string; tipoPedido?: 'mesa' | 'llamada' | 'nombre'; producto: { nombre: string; tamano: string | null; categoria: string }; ofrecidos: ComplementoMenu[] } } | null;
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
 * Quesadillas y Hamburguesas: SIN QUESO se registra en orden_has_detalle.sin_queso.
 */
export const CATEGORIAS_SIN_QUESO = ['Tacos', 'Sopes', 'Quesadillas', 'Hamburguesas', 'Lonches'];
export const CATEGORIAS_CON_QUESO = ['Tacos', 'Sopes', 'Quesadillas', 'Hamburguesas', 'Lonches'];
/** Categorías donde el queso no va de base: inicia apagado y en cocina solo se dice si lo piden (CON QUESO). */
export const CATEGORIAS_QUESO_OPCIONAL = ['Tacos'];

/** Papas a la Francesa: en los tickets solo «Orden de papas» o «Media orden de papas». */
export const CATEGORIA_PAPAS = 'Papas a la Francesa';
export const nombrePapas = (tamano: string | null) => (tamano === 'Media orden' ? 'Media orden de papas' : 'Orden de papas');

/**
 * Hamburguesas: DOBLE CARNE (1 extra) o TRIPLE CARNE (2 extra); cada carne extra cuesta PRECIO_CARNE_EXTRA
 * por pieza (orden_has_detalle.carne_extra; el servidor ya la incluye en el subtotal).
 */
export const CATEGORIA_CARNE_EXTRA = 'Hamburguesas';
export const PRECIO_CARNE_EXTRA = 20;
/** «EXTRA CREMA Y QUESO». */
export const textoComplementosExtra = (nombres: string[]) => `EXTRA ${nombres.join(' Y ').toUpperCase()}`;
export const MAX_CARNE_EXTRA = 2;
export const textoCarneExtra = (n: number | undefined) => (n === 1 ? 'DOBLE CARNE' : n === 2 ? 'TRIPLE CARNE' : '');

/** Categorías activas con sus productos (precio y complementos). */
export const obtenerMenu = () => pedir<{ categorias: CategoriaMenu[]; terminos?: TerminoMenu[]; papas?: PapasMenu | null }>('/menu')
  .then((d) => d.categorias.map((c) => ({
    ...c, terminos: terminosCategoria(c.nombre, d.terminos ?? []),
    papas: ['Hamburguesas', 'Lonches'].includes(c.nombre) ? d.papas ?? null : null,
  })));

/** Orden con su detalle y total. */
export const obtenerOrden = (idOrden: number) => pedir<{ orden: OrdenBD; detalle: DetalleOrdenBD[]; extras: ExtraOrdenBD[] }>(`/ordenes/${idOrden}`);

/** Manda productos a cocina: guarda el detalle (orden_has_detalle) y recalcula el total. */
export const enviarPedido = (
  idOrden: number,
  items: { idProducto: number; cantidad: number; sin?: number[]; mezcla?: string[]; reparto?: RepartoPedido[]; complementosExtra?: number[]; nota?: string; sinQueso?: boolean; conQueso?: boolean; carneExtra?: number; mixGrupo?: number | null; terminoId?: number | null; conPapas?: boolean }[],
  extras: ExtraPedido[] = [],
  origenPedido?: 'mesa' | 'llamada' | 'nombre',
) =>
  pedir<{ orden: OrdenBD; detalle: DetalleOrdenBD[]; extras: ExtraOrdenBD[]; extrasGuardados: ExtraOrdenBD[]; guardados: { idDetalle_Orden: number; mix_grupo: number | null }[] }>(`/ordenes/${idOrden}/pedido`, { method: 'POST', body: JSON.stringify({ items, extras, ...(origenPedido && { origenPedido }) }) });

/** Pide la cuenta: la orden pasa a PAGANDO (estatus 1) y la caja hace el cobro. */
export const pedirCuenta = (idOrden: number) =>
  pedir<{ orden: OrdenBD; detalle: DetalleOrdenBD[]; extras: ExtraOrdenBD[] }>(`/ordenes/${idOrden}/pedir-cuenta`, { method: 'POST' });

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

/**
 * MIXTAS: cuántas piezas de cada sabor en un solo renglón (BD: orden_has_detalle.opciones.reparto).
 * `precio`: lo que cuesta una pieza de ese sabor (cada pieza se cobra a su precio); falta en renglones viejos.
 */
export interface RepartoPedido {
  nombre: string;
  cantidad: number;
  precio?: number;
}

/** Alitas: ahí MIXTAS es la única forma de mezclar (no se tocan varios sabores para juntarlos en una pieza). */
export const CATEGORIAS_REPARTO = ['Alitas'];

/** "4 BBQ + 6 Buffalo". */
export const textoReparto = (reparto: RepartoPedido[]) => reparto.map((r) => `${r.cantidad} ${r.nombre}`).join(' + ');

/** Nombre de un renglón guardado: el reparto ("4 BBQ + 6 Buffalo"), la mezcla ("Papa con Frijol") o el producto con su tamaño. */
export const nombreDetalle = (d: Pick<DetalleOrdenBD, 'nombre' | 'tamano' | 'opciones'>) =>
  d.opciones?.reparto?.length
    ? `${textoReparto(d.opciones.reparto)}${d.tamano ? ` (${d.tamano})` : ''}`
    : d.opciones?.mezcla && d.opciones.mezcla.length > 1
      ? d.opciones.mezcla.join(' con ')
      : nombreProducto(d);
