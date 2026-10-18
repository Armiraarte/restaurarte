import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

const PRECIO_CARNE_EXTRA = 20;

export function terminoPermitido(categoria: string, nombre: string | undefined): boolean {
  return nombre !== undefined && (categoria === 'Tacos' || (categoria === 'Tacos Dorados' && nombre !== 'Dorado'));
}

export interface ItemPedido {
  idProducto: number;
  cantidad: number;
  sin?: number[];
  mezcla?: string[];
  sinQueso?: boolean;
  conQueso?: boolean;
  carneExtra?: number;
  terminoId?: number | null;
  /** Identificador temporal del borrador; se asigna un número definitivo bajo el bloqueo de la orden. */
  mixGrupo?: number | null;
}

export function itemsValidos(items: ItemPedido[]): boolean {
  return items.length > 0 && items.every((i) =>
    Number.isSafeInteger(i?.idProducto) && i.idProducto > 0 &&
    Number.isSafeInteger(i?.cantidad) && i.cantidad > 0 &&
    (i.sin === undefined || (Array.isArray(i.sin) && i.sin.every((id) => Number.isSafeInteger(id) && id > 0))) &&
    (i.mezcla === undefined || (Array.isArray(i.mezcla) && i.mezcla.length <= 40 && i.mezcla.every((n) => typeof n === 'string' && n.trim().length > 0 && n.length <= 255))) &&
    (i.sinQueso === undefined || typeof i.sinQueso === 'boolean') &&
    (i.conQueso === undefined || typeof i.conQueso === 'boolean') &&
    !(i.sinQueso && i.conQueso) &&
    (i.terminoId == null || (Number.isSafeInteger(i.terminoId) && i.terminoId > 0)) &&
    (i.carneExtra === undefined || (Number.isSafeInteger(i.carneExtra) && i.carneExtra >= 0 && i.carneExtra <= 2)) &&
    (i.mixGrupo == null || (Number.isSafeInteger(i.mixGrupo) && i.mixGrupo > 0 && i.mixGrupo <= 2147483647))
  );
}

/** Se ejecuta dentro de la transacción que ya bloqueó la orden. Nunca fusiona renglones. */
export async function guardarDetallePedido(
  conexion: Pick<PoolConnection, 'query' | 'execute'>,
  idOrden: number,
  items: ItemPedido[],
  productos: Map<number, RowDataPacket>,
  complementos: Map<number, { id: number; nombre: string }[]>,
  ahora: Date,
): Promise<{ idDetalle_Orden: number; mix_grupo: number | null }[]> {
  const grupos = new Map<number, number>();
  let ultimo = 0;
  if (items.some((i) => i.mixGrupo != null)) {
    const [filas] = await conexion.query<RowDataPacket[]>(
      'SELECT COALESCE(MAX(mix_grupo), 0) AS ultimo FROM orden_has_detalle WHERE idOrden = ?', [idOrden],
    );
    ultimo = Number(filas[0].ultimo);
  }
  const guardados: { idDetalle_Orden: number; mix_grupo: number | null }[] = [];
  for (const item of items) {
    if (item.mixGrupo != null && !grupos.has(item.mixGrupo)) grupos.set(item.mixGrupo, ++ultimo);
    const mix = item.mixGrupo == null ? null : grupos.get(item.mixGrupo)!;
    const p = productos.get(item.idProducto)!;
    const carneExtra = item.carneExtra ?? 0;
    const subtotal = ((Math.round(Number(p.precio) * 100) + carneExtra * PRECIO_CARNE_EXTRA * 100) * item.cantidad) / 100;
    const opciones = {
      sin: (complementos.get(item.idProducto) ?? []).filter((c) => item.sin?.includes(c.id)),
      mezcla: item.mezcla ?? [],
    };
    const [resultado] = await conexion.execute<ResultSetHeader>(
      `INSERT INTO orden_has_detalle
        (idOrden, idProducto, cantidad, sin_queso, con_queso, carne_extra, mix_grupo, opciones, subtotal, creado_en, actualizado_en, termino_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [idOrden, item.idProducto, item.cantidad, item.sinQueso ? 1 : 0, item.conQueso ? 1 : 0,
        carneExtra, mix, JSON.stringify(opciones), subtotal.toFixed(2), ahora, ahora, item.terminoId ?? null],
    );
    guardados.push({ idDetalle_Orden: resultado.insertId, mix_grupo: mix });
  }
  return guardados;
}
