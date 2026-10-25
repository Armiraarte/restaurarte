import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { config } from './config.js';

export class ErrorAltaMesa extends Error {
  constructor(message: string, public status: number, public sinTurno = false) {
    super(message);
  }
}

/** Mesas del 1 al 9; la de prueba (config.mesaPrueba) solo existe en la PC de desarrollo. */
export function validarNumeroMesa(nombre: string): void {
  if (/^\d+$/.test(nombre) && !/^[1-9]$/.test(nombre) && nombre !== config.mesaPrueba) {
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

/**
 * Mueve la orden `idOrden` a la mesa `destino` (dentro de una transacción). Bloquea el turno como las altas, revisa
 * que la orden sea del turno y no esté cobrada, y que la mesa esté libre. Devuelve el nombre anterior.
 */
export async function cambiarMesaOrden(
  conexion: Pick<PoolConnection, 'query' | 'execute'>,
  turnoId: number,
  idOrden: number,
  destino: string,
): Promise<string> {
  const [turnos] = await conexion.query<RowDataPacket[]>('SELECT idTurno FROM turnos WHERE idTurno = ? AND estatus = 1 FOR UPDATE', [turnoId]);
  if (!turnos.length) throw new ErrorAltaMesa('La caja no ha iniciado turno.', 409);
  const [ordenes] = await conexion.query<RowDataPacket[]>('SELECT idOrden, nombre, estatus, idTurno FROM orden WHERE idOrden = ? FOR UPDATE', [idOrden]);
  const orden = ordenes[0];
  if (!orden) throw new ErrorAltaMesa('La orden no existe.', 404);
  if (Number(orden.idTurno) !== Number(turnoId)) throw new ErrorAltaMesa('Esa orden no es del turno abierto.', 409);
  if (![0, 1].includes(Number(orden.estatus))) throw new ErrorAltaMesa('Esa orden ya se cobró; no se puede cambiar de mesa.', 409);
  if (String(orden.nombre) === destino) throw new ErrorAltaMesa(`La orden ya está en la mesa ${destino}.`, 409);
  const [ocupada] = await conexion.query<RowDataPacket[]>(
    'SELECT idOrden FROM orden WHERE idTurno = ? AND nombre = ? AND estatus IN (0, 1) FOR UPDATE', [turnoId, destino],
  );
  if (ocupada.length) throw new ErrorAltaMesa(`La mesa ${destino} ya está ocupada; elige una libre.`, 409);
  const anterior = String(orden.nombre);
  await conexion.execute('UPDATE orden SET nombre = ?, actualizado_en = ? WHERE idOrden = ?', [destino, new Date(), idOrden]);
  return anterior;
}
