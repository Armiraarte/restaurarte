// Mesas: el botón "Agregar mesa" de la tablet registra una orden en MySQL (tabla `orden`, la de Laravel:
// migraciones 2026_10_09_000003 a 2026_10_10_000013; modelo App\Models\Orden).
//   orden.idOrden         → número autoincrementable asignado por MySQL
//   orden.codigo          → número de mesa ("5") o nombre del cliente ("Juan"); único
//   orden.total           → 0.00 al crearla
//   orden.tipo_orden      → 1 = comer aquí, 2 = para llevar (catálogo tipos_venta)
//   orden.estatus         → 0 = ABIERTA (al crearla), 1 = PAGANDO, 2 = PAGADO
//   orden.idTurno         → turno de caja abierto (la tablet solo muestra las órdenes de ese turno)
//   orden.idSesion_tablet → sesión de la tablet que la registró
// Las respuestas conservan los nombres que ya usa el frontend (id, tipo_venta_id, turno_id, sesion_tablet_id).
import { Router, type Request, type Response, type NextFunction } from 'express';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { requireAuth } from './auth.js';
import { config } from './config.js';
import { esDuplicado, pool } from './db.js';
import { mysqlDisponible } from './usuarios.js';
import { sesionTabletAbierta, turnoAbierto } from './turnos.js';
import { asignarNombreMesa, cambiarMesaOrden, ErrorAltaMesa, validarNumeroMesa } from './numeracionMesas.js';

const TIPO_VENTA = { comerAqui: 1, paraLlevar: 2 } as const;

/** Igual que App\Models\Mesa::normalizarNombre: "Mesa 05" → "5"; un nombre se conserva sin espacios sobrantes. */
export function normalizarNombreMesa(nombre: string): string {
  const limpio = nombre.trim().replace(/\s+/g, ' ');
  const numero = limpio.match(/^(?:mesa\s*)?0*(\d+)$/i);
  return numero ? numero[1] || '0' : limpio;
}

interface MesaFila extends RowDataPacket {
  id: number;
  codigo: string;
  nombre: string;
  tipo_venta_id: number;
  total: string;
  estatus: number;
  turno_id: number | null;
  sesion_tablet_id: number | null;
  creado_en: Date;
  actualizado_en: Date;
}

/** Siguiente código de orden del turno: "T1-001", "T1-002"… (único en la tabla). */
async function siguienteCodigo(conexion: PoolConnection, turnoId: number): Promise<string> {
  const [filas] = await conexion.query<RowDataPacket[]>(
    `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(codigo, '-', -1) AS UNSIGNED)), 0) AS ultimo
       FROM orden WHERE codigo LIKE ? FOR UPDATE`,
    [`T${turnoId}-%`],
  );
  return `T${turnoId}-${String(Number(filas[0].ultimo) + 1).padStart(3, '0')}`;
}

/** Órdenes de la mesa de prueba: «PRUEBA-001», «PRUEBA-002»… (no usan el consecutivo del turno). */
async function siguienteCodigoPrueba(conexion: PoolConnection): Promise<string> {
  const [filas] = await conexion.query<RowDataPacket[]>(
    `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(codigo, '-', -1) AS UNSIGNED)), 0) AS ultimo
       FROM orden WHERE codigo LIKE 'PRUEBA-%' FOR UPDATE`,
  );
  return `PRUEBA-${String(Number(filas[0].ultimo) + 1).padStart(3, '0')}`;
}

const COLUMNAS =
  'idOrden AS id, codigo, nombre, total, tipo_orden AS tipo_venta_id, estatus, idTurno AS turno_id, idSesion_tablet AS sesion_tablet_id, creado_en, actualizado_en';

function soloRoles(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      res.status(403).json({ error: 'Sin permiso.' });
      return;
    }
    next();
  };
}

export const mesasRouter = Router();
mesasRouter.use(requireAuth, soloRoles('tablet', 'admin', 'cajero'));

/**
 * Mesas registradas en el turno abierto (lo que la tablet muestra). Sin turno abierto, la lista va vacía.
 * Orden: primero los números de mesa de menor a mayor, después los nombres.
 */
mesasRouter.get('/', async (_req, res) => {
  if (!pool || !mysqlDisponible()) {
    res.status(503).json({ error: 'La base de datos no está disponible.' });
    return;
  }
  const turno = await turnoAbierto();
  if (!turno) {
    res.json({ turno: null, mesas: [] });
    return;
  }
  // Con mesa de prueba (solo PC de desarrollo) también van sus órdenes, que están fuera del turno: las activas y
  // las cobradas desde que abrió el turno (para verlas en Cajas y Ventas). Producción no las lista nunca.
  const prueba = config.mesaPrueba;
  const [mesas] = await pool.query<MesaFila[]>(
    `SELECT ${COLUMNAS} FROM orden WHERE idTurno = ?
       ${prueba ? 'OR (idTurno IS NULL AND nombre = ? AND (estatus IN (0, 1) OR creado_en >= ?))' : ''}
      ORDER BY nombre REGEXP '^[0-9]+$' DESC, CAST(nombre AS UNSIGNED), nombre, idOrden`,
    prueba ? [turno.idTurno, prueba, turno.fecha_inicio] : [turno.idTurno],
  );
  res.json({ turno: { idTurno: turno.idTurno, fecha_inicio: turno.fecha_inicio }, mesas, mesaPrueba: prueba });
});

/**
 * Registra una mesa del 1 al 9, asignando el siguiente número libre dentro del turno abierto.
 * Las cuentas por nombre conservan su identidad si ya existe una abierta con ese nombre.
 * Respuesta: { mesa, creada } — creada = true si se insertó una fila nueva.
 */
mesasRouter.post('/', async (req, res) => {
  // El número de mesa o nombre del cliente va en orden.nombre; orden.codigo se genera (T1-001…).
  const nombre = normalizarNombreMesa(String(req.body?.nombre ?? req.body?.codigo ?? ''));
  if (!nombre || nombre.length > 100) {
    res.status(400).json({ error: 'La mesa necesita un número o nombre (máximo 100 caracteres).' });
    return;
  }
  try {
    validarNumeroMesa(nombre);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
    return;
  }
  if (!pool || !mysqlDisponible()) {
    res.status(503).json({ error: 'La base de datos no está disponible; no se pudo registrar la mesa.' });
    return;
  }
  const tipoVentaId = req.body?.tipo_venta_id ?? (req.body?.paraLlevar === true ? TIPO_VENTA.paraLlevar : TIPO_VENTA.comerAqui);
  if (!Number.isSafeInteger(tipoVentaId) || tipoVentaId < 1) {
    res.status(400).json({ error: 'El tipo de venta debe ser un ID válido del catálogo.' });
    return;
  }

  // Cierra turnos vencidos antes de tomar una conexión para la transacción.
  const turno = await turnoAbierto();
  if (!turno) {
    res.status(409).json({ error: 'La caja no ha iniciado turno; no se puede agregar la mesa.', sinTurno: true });
    return;
  }
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const ahora = new Date();
    const nombreAsignado = await asignarNombreMesa(conexion, turno.idTurno, nombre);
    const tabletId = req.usuario!.tablet?.id;
    const sesionId = tabletId ? ((await sesionTabletAbierta(tabletId, turno.idTurno, conexion))?.id ?? null) : null;
    // Mesa de prueba (solo PC de desarrollo): sus órdenes van fuera del turno, así producción no las ve.
    const esPrueba = nombreAsignado === config.mesaPrueba;
    // Si esa mesa ya tiene una orden activa (ABIERTA o PAGANDO) en el turno, se usa esa; una orden PAGADA
    // nunca se reabre: la nueva Mesa 1 es otra orden con su propio código.
    const [activas] = await conexion.query<MesaFila[]>(
      esPrueba
        ? 'SELECT idOrden AS id FROM orden WHERE idTurno IS NULL AND nombre = ? AND estatus IN (0, 1) FOR UPDATE'
        : 'SELECT idOrden AS id FROM orden WHERE idTurno = ? AND nombre = ? AND estatus IN (0, 1) FOR UPDATE',
      esPrueba ? [nombreAsignado] : [turno.idTurno, nombreAsignado],
    );
    let creada = false;
    let id: number;

    if (activas.length > 0) {
      id = activas[0].id;
    } else {
      const codigo = esPrueba ? await siguienteCodigoPrueba(conexion) : await siguienteCodigo(conexion, turno.idTurno);
      const [resultado] = await conexion.execute<ResultSetHeader>(
        `INSERT INTO orden (codigo, nombre, total, tipo_orden, estatus, idTurno, idSesion_tablet, creado_en, actualizado_en)
         VALUES (?, ?, 0.00, ?, 0, ?, ?, ?, ?)`,
        [codigo, nombreAsignado, tipoVentaId, esPrueba ? null : turno.idTurno, sesionId, ahora, ahora],
      );
      id = resultado.insertId;
      creada = true;
    }
    await conexion.commit();

    const [filas] = await pool.query<MesaFila[]>(`SELECT ${COLUMNAS} FROM orden WHERE idOrden = ?`, [id]);
    res.status(creada ? 201 : 200).json({ mesa: filas[0], creada });
  } catch (err) {
    await conexion.rollback();
    if (err instanceof ErrorAltaMesa) {
      res.status(err.status).json({ error: err.message, ...(err.sinTurno ? { sinTurno: true } : {}) });
      return;
    }
    if (esDuplicado(err)) {
      // Dos cajas/tablets generaron el mismo código al mismo tiempo: se pide reintentar.
      res.status(409).json({ error: 'Se registró otra orden al mismo tiempo; intenta de nuevo.' });
      return;
    }
    if ((err as { code?: string })?.code === 'ER_NO_REFERENCED_ROW_2') {
      res.status(400).json({ error: 'El tipo de venta no existe en el catálogo.' });
      return;
    }
    console.error('[mesas] No se pudo registrar la mesa:', err);
    res.status(500).json({ error: 'No se pudo registrar la mesa en la base de datos.' });
  } finally {
    conexion.release();
  }
});


/**
 * Cambiar de mesa (botón CAMBIAR en Órdenes): la orden abierta pasa a una mesa libre del croquis (1 a 9) con todo lo
 * que tiene; solo cambia orden.nombre (el pedido, los extras, el total y el código se quedan en la misma orden).
 * Bajo el mismo bloqueo del turno que las altas, así dos tablets no pueden ocupar la misma mesa a la vez.
 */
mesasRouter.post('/:id/cambiar', async (req, res) => {
  const id = Number(req.params.id);
  const destino = normalizarNombreMesa(String(req.body?.mesa ?? ''));
  if (!Number.isSafeInteger(id) || id < 1 || !/^[1-9]$/.test(destino)) {
    res.status(400).json({ error: 'Elige una mesa libre del 1 al 9.' });
    return;
  }
  if (!pool || !mysqlDisponible()) {
    res.status(503).json({ error: 'La base de datos no está disponible; no se cambió la mesa.' });
    return;
  }
  const turno = await turnoAbierto();
  if (!turno) {
    res.status(409).json({ error: 'La caja no ha iniciado turno.', sinTurno: true });
    return;
  }
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const anterior = await cambiarMesaOrden(conexion, turno.idTurno, id, destino);
    await conexion.commit();
    const [filas] = await pool.query<MesaFila[]>(`SELECT ${COLUMNAS} FROM orden WHERE idOrden = ?`, [id]);
    res.json({ mesa: filas[0], anterior });
  } catch (err) {
    await conexion.rollback();
    if (err instanceof ErrorAltaMesa) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error('[mesas] No se pudo cambiar de mesa:', err);
    res.status(500).json({ error: 'No se pudo cambiar de mesa.' });
  } finally {
    conexion.release();
  }
});
