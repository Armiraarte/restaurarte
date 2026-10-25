import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

export type OrigenOrden = 'mesa' | 'llamada' | 'nombre';
export const esOrigenOrden = (valor: unknown): valor is OrigenOrden => valor === 'mesa' || valor === 'llamada' || valor === 'nombre';
export const origenOrden = (nombre: string, origen?: unknown): OrigenOrden => /^\d+$/.test(nombre)
  ? 'mesa' : origen === 'llamada' ? 'llamada' : 'nombre';

let columna: Promise<boolean> | null = null;
/** Compatibilidad de lectura mientras se prepara la migración del origen. */
export function tieneOrigenOrden(db: Pick<PoolConnection, 'query'>): Promise<boolean> {
  return columna ??= db.query<RowDataPacket[]>("SHOW COLUMNS FROM orden LIKE 'origen'")
    .then(([filas]) => filas.length > 0)
    .catch((err) => { columna = null; throw err; });
}
