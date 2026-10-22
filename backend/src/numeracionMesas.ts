import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

export class ErrorAltaMesa extends Error {
  constructor(message: string, public status: number, public sinTurno = false) {
    super(message);
  }
}

export function validarNumeroMesa(nombre: string): void {
  if (/^\d+$/.test(nombre) && !/^[1-9]$/.test(nombre)) {
    throw new ErrorAltaMesa('Las mesas solo pueden tener números del 1 al 9.', 400);
  }
}

/**
 * Se llama dentro de una transacción y mantiene el bloqueo del turno hasta insertar y confirmar la orden.
 * Croquis: la mesa que se toca es la que se abre (el número no se reasigna). Si esa mesa ya tiene una orden
 * activa, quien llama la reutiliza; el bloqueo evita que dos tablets abran dos órdenes en la misma mesa.
 */
export async function asignarNombreMesa(
  conexion: Pick<PoolConnection, 'query'>,
  turnoId: number,
  solicitado: string,
): Promise<string> {
  validarNumeroMesa(solicitado);
  // Serializa las altas de todas las tablets y también protege el consecutivo de orden.
  const [turnos] = await conexion.query<RowDataPacket[]>(
    'SELECT idTurno FROM turnos WHERE idTurno = ? AND estatus = 1 FOR UPDATE', [turnoId],
  );
  if (!turnos.length) throw new ErrorAltaMesa('La caja no ha iniciado turno; no se puede agregar la mesa.', 409, true);
  return solicitado;
}
