import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

export const MAX_MESAS = 9;

/** Continúa después de la mayor ocupada; al llegar a 9, reutiliza la menor libre. */
export function siguienteNumeroMesa(nombres: Iterable<string>): number | null {
  const ocupadas = new Set([...nombres].filter((n) => /^[1-9]$/.test(n)).map(Number));
  const mayor = Math.max(0, ...ocupadas);
  for (let numero = mayor + 1; numero <= MAX_MESAS; numero++) {
    if (!ocupadas.has(numero)) return numero;
  }
  for (let numero = 1; numero <= MAX_MESAS; numero++) {
    if (!ocupadas.has(numero)) return numero;
  }
  return null;
}

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

/** Se llama dentro de una transacción y mantiene el bloqueo hasta insertar y confirmar la orden. */
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
  if (!/^\d+$/.test(solicitado)) return solicitado;

  // Lectura actual, incluso si otra tablet acaba de ocupar el número que se mostraba en pantalla.
  const [activas] = await conexion.query<RowDataPacket[]>(
    'SELECT nombre FROM orden WHERE idTurno = ? AND estatus IN (0, 1) FOR UPDATE', [turnoId],
  );
  const numero = siguienteNumeroMesa(activas.map((fila) => String(fila.nombre)));
  if (numero === null) throw new ErrorAltaMesa('Las 9 mesas están ocupadas. Cobra una mesa para liberar su número.', 409);
  return String(numero);
}
