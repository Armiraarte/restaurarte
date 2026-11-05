// Quitar de la cuenta lo que se mandó por error: un renglón de orden_has_detalle (todo o algunas piezas)
// o un cobro extra de orden_extra. Solo la caja (admin y cajero), y nunca en una orden ya pagada.
// No imprime nada en cocina; el total de la orden se recalcula con recalcularTotalOrden.

/** Quién puede quitar productos ya enviados (las tablets de meseros no). */
export const ROLES_QUITAR_DEL_PEDIDO = ['admin', 'cajero'];

export interface RenglonQuitar {
  cantidad: number;
  subtotal: number;
  opciones: { reparto?: unknown[] } | null;
}

export type ResultadoQuitar =
  | { borrar: true; piezas: number; importe: number }
  | { borrar: false; piezas: number; importe: number; cantidad: number; subtotal: number }
  | { error: string };

/**
 * Sin `piezas` se quita el renglón completo. Con `piezas` se quitan solo esas y el resto conserva su precio por pieza
 * (el subtotal ya incluye carne extra y papas por pieza). MIXTAS («4 BBQ + 6 Buffalo») solo se quita completo.
 */
export function calcularQuitar(renglon: RenglonQuitar, piezas?: unknown): ResultadoQuitar {
  const subtotalCentavos = Math.round(renglon.subtotal * 100);
  if (piezas === undefined || piezas === null || piezas === renglon.cantidad) {
    return { borrar: true, piezas: renglon.cantidad, importe: subtotalCentavos / 100 };
  }
  if (typeof piezas !== 'number' || !Number.isSafeInteger(piezas) || piezas < 1) {
    return { error: 'Indica cuántas piezas quitar (1 o más).' };
  }
  if (piezas > renglon.cantidad) {
    return { error: `Ese producto solo tiene ${renglon.cantidad} ${renglon.cantidad === 1 ? 'pieza' : 'piezas'}.` };
  }
  if (renglon.opciones?.reparto?.length) {
    return { error: 'Las MIXTAS se quitan completas.' };
  }
  const cantidad = renglon.cantidad - piezas;
  const quedan = Math.round((subtotalCentavos * cantidad) / renglon.cantidad);
  return { borrar: false, piezas, importe: (subtotalCentavos - quedan) / 100, cantidad, subtotal: quedan / 100 };
}
