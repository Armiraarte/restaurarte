import type { PoolConnection, ResultSetHeader } from 'mysql2/promise';

export interface ExtraPedido {
  descripcion: string;
  importe: number;
}

export function extrasValidos(extras: unknown): extras is ExtraPedido[] {
  return Array.isArray(extras) && extras.length <= 100 && extras.every((e) =>
    typeof e?.descripcion === 'string' && e.descripcion.trim().length > 0 && e.descripcion.length <= 180 &&
    typeof e.importe === 'number' && Number.isFinite(e.importe) && e.importe > 0 && e.importe <= 9999999.99 &&
    Math.round(e.importe * 100) / 100 === e.importe,
  );
}

/** Se ejecuta bajo el mismo bloqueo y transacción que los productos del pedido. */
export async function guardarExtrasPedido(conexion: Pick<PoolConnection, 'execute'>, idOrden: number, extras: ExtraPedido[], ahora: Date) {
  const guardados = [];
  for (const extra of extras) {
    const descripcion = extra.descripcion.trim().replace(/\s+/g, ' ');
    const [resultado] = await conexion.execute<ResultSetHeader>(
      'INSERT INTO orden_extra (idOrden, descripcion, importe, creado_en, actualizado_en) VALUES (?, ?, ?, ?, ?)',
      [idOrden, descripcion, extra.importe.toFixed(2), ahora, ahora],
    );
    guardados.push({ id: resultado.insertId, descripcion, importe: extra.importe, creado_en: ahora.toISOString() });
  }
  return guardados;
}

export async function recalcularTotalOrden(conexion: Pick<PoolConnection, 'execute'>, idOrden: number, ahora: Date) {
  await conexion.execute(
    `UPDATE orden SET total =
       (SELECT COALESCE(SUM(subtotal), 0) FROM orden_has_detalle WHERE idOrden = ?) +
       (SELECT COALESCE(SUM(importe), 0) FROM orden_extra WHERE idOrden = ?), actualizado_en = ?
     WHERE idOrden = ?`, [idOrden, idOrden, ahora, idOrden],
  );
}
