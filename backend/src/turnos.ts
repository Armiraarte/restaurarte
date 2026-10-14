// Turnos (tablas `turnos` y `sesiones_tablet` de Laravel, migración 2026_10_10_000006):
//   - Turno de caja (idTurno, idUsuario, fecha_inicio, fecha_fin, estatus 1 abierto / 0 cerrado): lo inicia
//     un admin o cajero con «Iniciar turno» (migración 000019). Solo uno abierto a la vez.
//   - Sesión de tablet: se abre al iniciar sesión la tablet, dentro del turno de caja abierto.
// Las mesas que registra la tablet se ligan al turno (mesas.turno_id) y a la sesión (mesas.sesion_tablet_id).
import { Router, type Request, type Response, type NextFunction } from 'express';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { requireAuth } from './auth.js';
import { pool } from './db.js';
import { mysqlDisponible } from './usuarios.js';
import { imprimirLineas } from './impresion.js';
import { lineasTicketCorte } from './ticketCorte.js';

export interface TurnoFila extends RowDataPacket {
  idTurno: number;
  idUsuario: string;
  fecha_inicio: Date;
  fecha_fin: Date | null;
  estatus: number; // 1 abierto, 0 cerrado
}

interface SesionFila extends RowDataPacket {
  id: number;
  turno_id: number;
  tablet_id: string;
  iniciada_en: Date;
}

type Consultor = Pick<PoolConnection, 'query'>;

/** Turno de caja abierto, o null. */
export async function turnoAbierto(db: Consultor = pool!): Promise<TurnoFila | null> {
  const [filas] = await db.query<TurnoFila[]>(
    'SELECT idTurno, idUsuario, fecha_inicio, fecha_fin, estatus FROM turnos WHERE estatus = 1 LIMIT 1',
  );
  return filas[0] ?? null;
}

/** Sesión abierta de una tablet en el turno indicado, o null. */
export async function sesionTabletAbierta(tabletId: string, turnoId: number, db: Consultor = pool!): Promise<SesionFila | null> {
  const [filas] = await db.query<SesionFila[]>(
    'SELECT id, turno_id, tablet_id, iniciada_en FROM sesiones_tablet WHERE tablet_id = ? AND turno_id = ? AND cerrada_en IS NULL LIMIT 1',
    [tabletId, turnoId],
  );
  return filas[0] ?? null;
}

/* ---------- Corte de turno ---------- */

/** Resumen de un turno para el módulo Turnos y el ticket de corte. */
export interface ResumenTurno {
  turno: { idTurno: number; idUsuario: string; abrio: string; fecha_inicio: Date; fecha_fin: Date | null; estatus: number };
  ordenes: { abiertas: number; pagando: number; pagadas: number; sinPedido: number };
  totalVendido: number;
  /** Órdenes que impiden el corte: PAGANDO, o ABIERTA con productos. */
  pendientes: { idOrden: number; nombre: string; total: number; estatus: number }[];
  productos: { categoria: string; nombre: string; cantidad: number; importe: number }[];
  tablets: { usadas: number; conectadas: number };
}

const etiqueta = (nombre: string) => (/^\d+$/.test(nombre) ? `Mesa ${nombre}` : nombre);

export async function resumenTurno(idTurno: number, db: Consultor = pool!): Promise<ResumenTurno | null> {
  const [turnos] = await db.query<RowDataPacket[]>(
    `SELECT t.idTurno, t.idUsuario, COALESCE(u.nombre, t.idUsuario) AS abrio, t.fecha_inicio, t.fecha_fin, t.estatus
       FROM turnos t LEFT JOIN usuarios u ON u.id = t.idUsuario WHERE t.idTurno = ?`,
    [idTurno],
  );
  if (!turnos[0]) return null;
  const [ordenes] = await db.query<RowDataPacket[]>(
    'SELECT idOrden, nombre, total, estatus FROM orden WHERE idTurno = ? ORDER BY idOrden',
    [idTurno],
  );
  const [productos] = await db.query<RowDataPacket[]>(
    `SELECT c.nombre AS categoria, p.nombre, p.tamano, SUM(d.cantidad) AS cantidad, SUM(d.subtotal) AS importe
       FROM orden_has_detalle d
       JOIN orden o ON o.idOrden = d.idOrden
       JOIN producto p ON p.id = d.idProducto
       JOIN categorias c ON c.id = p.categoria_id
      WHERE o.idTurno = ? AND o.estatus = 2
      GROUP BY d.idProducto, c.nombre, p.nombre, p.tamano, c.id
      ORDER BY c.id, p.nombre`,
    [idTurno],
  );
  const [tablets] = await db.query<RowDataPacket[]>(
    `SELECT COUNT(DISTINCT tablet_id) AS usadas, COUNT(DISTINCT CASE WHEN cerrada_en IS NULL THEN tablet_id END) AS conectadas
       FROM sesiones_tablet WHERE turno_id = ?`,
    [idTurno],
  );
  const total = (o: RowDataPacket) => Number(o.total);
  return {
    turno: turnos[0] as ResumenTurno['turno'],
    ordenes: {
      abiertas: ordenes.filter((o) => o.estatus === 0 && total(o) > 0).length,
      pagando: ordenes.filter((o) => o.estatus === 1).length,
      pagadas: ordenes.filter((o) => o.estatus === 2).length,
      sinPedido: ordenes.filter((o) => o.estatus === 0 && total(o) === 0).length,
    },
    totalVendido: Math.round(ordenes.filter((o) => o.estatus === 2).reduce((a, o) => a + total(o), 0) * 100) / 100,
    pendientes: ordenes
      .filter((o) => o.estatus === 1 || (o.estatus === 0 && total(o) > 0))
      .map((o) => ({ idOrden: o.idOrden, nombre: etiqueta(o.nombre), total: total(o), estatus: o.estatus })),
    productos: productos.map((p) => ({
      categoria: p.categoria,
      nombre: `${p.categoria} ${p.nombre}${p.tamano ? ` (${p.tamano})` : ''}`,
      cantidad: Number(p.cantidad),
      importe: Number(p.importe),
    })),
    tablets: { usadas: Number(tablets[0]?.usadas ?? 0), conectadas: Number(tablets[0]?.conectadas ?? 0) },
  };
}

async function imprimirCorte(r: ResumenTurno, corto: string, reimpresion = false) {
  try {
    await imprimirLineas(lineasTicketCorte(r, corto, reimpresion));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'No se pudo imprimir.' };
  }
}

function soloRoles(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      res.status(403).json({ error: 'Sin permiso.' });
      return;
    }
    next();
  };
}

function conBase(_req: Request, res: Response, next: NextFunction) {
  if (!pool || !mysqlDisponible()) {
    res.status(503).json({ error: 'La base de datos no está disponible.' });
    return;
  }
  next();
}

export const turnosRouter = Router();
turnosRouter.use(requireAuth, conBase);

/** Turno abierto (para cualquier sesión). */
turnosRouter.get('/actual', async (_req, res) => {
  res.json({ turno: await turnoAbierto() });
});

/** Caja: resumen del turno abierto (lo que se verá en el corte). */
turnosRouter.get('/resumen', soloRoles('admin', 'cajero'), async (_req, res) => {
  const turno = await turnoAbierto();
  res.json({ resumen: turno ? await resumenTurno(turno.idTurno) : null });
});

/** Caja: turnos cerrados (cortes anteriores), los más recientes primero. */
turnosRouter.get('/historial', soloRoles('admin', 'cajero'), async (_req, res) => {
  const [turnos] = await pool!.query<RowDataPacket[]>(
    `SELECT t.idTurno, COALESCE(u.nombre, t.idUsuario) AS abrio, t.fecha_inicio, t.fecha_fin,
            COUNT(CASE WHEN o.estatus = 2 THEN 1 END) AS ordenes_cobradas,
            COALESCE(SUM(CASE WHEN o.estatus = 2 THEN o.total END), 0) AS total_vendido
       FROM turnos t
       LEFT JOIN usuarios u ON u.id = t.idUsuario
       LEFT JOIN orden o ON o.idTurno = t.idTurno
      WHERE t.estatus = 0
      GROUP BY t.idTurno, u.nombre, t.idUsuario, t.fecha_inicio, t.fecha_fin
      ORDER BY t.idTurno DESC
      LIMIT 50`,
  );
  res.json({
    turnos: turnos.map((t) => ({ ...t, ordenes_cobradas: Number(t.ordenes_cobradas), total_vendido: Number(t.total_vendido) })),
  });
});

/** Caja: resumen de un turno cualquiera (para ver un corte anterior). */
turnosRouter.get('/:idTurno/resumen', soloRoles('admin', 'cajero'), async (req, res) => {
  const resumen = await resumenTurno(Number(req.params.idTurno));
  if (!resumen) {
    res.status(404).json({ error: 'El turno no existe.' });
    return;
  }
  res.json({ resumen });
});

/**
 * Caja: corte de turno. Cierra el turno abierto (estatus 0, fecha_fin), cierra las sesiones de las tablets
 * e imprime el ticket de corte. No se permite si quedan órdenes por cobrar (PAGANDO o ABIERTA con productos).
 */
turnosRouter.post('/cerrar', soloRoles('admin', 'cajero'), async (req, res) => {
  const conexion = await pool!.getConnection();
  try {
    await conexion.beginTransaction();
    const [abiertos] = await conexion.query<TurnoFila[]>(
      'SELECT idTurno, idUsuario, fecha_inicio, fecha_fin, estatus FROM turnos WHERE estatus = 1 LIMIT 1 FOR UPDATE',
    );
    const turno = abiertos[0];
    if (!turno) {
      await conexion.rollback();
      res.status(409).json({ error: 'No hay turno abierto.', sinTurno: true });
      return;
    }
    const previo = await resumenTurno(turno.idTurno, conexion);
    if (previo && previo.pendientes.length > 0) {
      await conexion.rollback();
      res.status(409).json({
        error: `Hay ${previo.pendientes.length} ${previo.pendientes.length === 1 ? 'orden' : 'órdenes'} sin cobrar. Cóbralas antes del corte.`,
        pendientes: previo.pendientes,
      });
      return;
    }
    const ahora = new Date();
    await conexion.execute('UPDATE turnos SET estatus = 0, fecha_fin = ?, actualizado_en = ? WHERE idTurno = ?', [ahora, ahora, turno.idTurno]);
    await conexion.execute('UPDATE sesiones_tablet SET cerrada_en = ?, actualizado_en = ? WHERE turno_id = ? AND cerrada_en IS NULL', [
      ahora,
      ahora,
      turno.idTurno,
    ]);
    await conexion.commit();

    const resumen = (await resumenTurno(turno.idTurno))!;
    res.json({ resumen, impresion: await imprimirCorte(resumen, req.usuario!.nombre) });
  } catch (err) {
    await conexion.rollback();
    console.error('[turnos] No se pudo cerrar el turno:', err);
    res.status(500).json({ error: 'No se pudo cerrar el turno.' });
  } finally {
    conexion.release();
  }
});

/** Caja: reimprimir el corte de un turno cerrado. */
turnosRouter.post('/:idTurno/imprimir-corte', soloRoles('admin', 'cajero'), async (req, res) => {
  const resumen = await resumenTurno(Number(req.params.idTurno));
  if (!resumen || resumen.turno.estatus !== 0) {
    res.status(409).json({ error: 'Ese turno no está cerrado.' });
    return;
  }
  res.json({ impresion: await imprimirCorte(resumen, req.usuario!.nombre, true) });
});

/**
 * Caja: inicia el turno (turnos.estatus = 1); si ya hay uno abierto, devuelve ese.
 * Un candado de MySQL (GET_LOCK) evita que dos cajas abran dos turnos al mismo tiempo.
 */
turnosRouter.post('/iniciar', soloRoles('admin', 'cajero'), async (req, res) => {
  const conexion = await pool!.getConnection();
  try {
    await conexion.query("SELECT GET_LOCK('restaurarte_iniciar_turno', 10)");
    const existente = await turnoAbierto(conexion);
    if (existente) {
      res.json({ turno: existente, nuevo: false });
      return;
    }
    const ahora = new Date();
    await conexion.execute(
      'INSERT INTO turnos (idUsuario, fecha_inicio, fecha_fin, estatus, creado_en, actualizado_en) VALUES (?, ?, NULL, 1, ?, ?)',
      [req.usuario!.id, ahora, ahora, ahora],
    );
    res.status(201).json({ turno: await turnoAbierto(conexion), nuevo: true });
  } catch (err) {
    console.error('[turnos] No se pudo iniciar el turno:', err);
    res.status(500).json({ error: 'No se pudo iniciar el turno.' });
  } finally {
    await conexion.query("SELECT RELEASE_LOCK('restaurarte_iniciar_turno')").catch(() => {});
    conexion.release();
  }
});

/** Tablet: al iniciar sesión se abre su sesión dentro del turno de caja. Requiere turno abierto. */
turnosRouter.post('/sesion-tablet', soloRoles('tablet'), async (req, res) => {
  const tabletId = req.usuario!.tablet?.id;
  if (!tabletId) {
    res.status(400).json({ error: 'Esta cuenta no tiene una tablet registrada.' });
    return;
  }
  const conexion = await pool!.getConnection();
  try {
    await conexion.beginTransaction();
    const turno = await turnoAbierto(conexion);
    if (!turno) {
      await conexion.rollback();
      res.status(409).json({ error: 'La caja no ha iniciado turno.', sinTurno: true });
      return;
    }
    let sesion = await sesionTabletAbierta(tabletId, turno.idTurno, conexion);
    let nueva = false;
    if (!sesion) {
      const ahora = new Date();
      // Una sesión que quedó abierta de un turno anterior se cierra.
      await conexion.execute('UPDATE sesiones_tablet SET cerrada_en = ?, actualizado_en = ? WHERE tablet_id = ? AND cerrada_en IS NULL', [
        ahora,
        ahora,
        tabletId,
      ]);
      await conexion.execute<ResultSetHeader>(
        `INSERT INTO sesiones_tablet (turno_id, tablet_id, usuario_id, iniciada_en, creado_en, actualizado_en)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [turno.idTurno, tabletId, req.usuario!.id, ahora, ahora, ahora],
      );
      sesion = await sesionTabletAbierta(tabletId, turno.idTurno, conexion);
      nueva = true;
    }
    await conexion.commit();
    res.status(nueva ? 201 : 200).json({ turno, sesion, nueva });
  } catch (err) {
    await conexion.rollback();
    console.error('[turnos] No se pudo iniciar la sesión de la tablet:', err);
    res.status(500).json({ error: 'No se pudo iniciar la sesión de la tablet.' });
  } finally {
    conexion.release();
  }
});

/** Tablet: al cerrar sesión se cierra su sesión del turno. */
turnosRouter.post('/sesion-tablet/cerrar', soloRoles('tablet'), async (req, res) => {
  const tabletId = req.usuario!.tablet?.id;
  if (tabletId) {
    const ahora = new Date();
    await pool!.execute('UPDATE sesiones_tablet SET cerrada_en = ?, actualizado_en = ? WHERE tablet_id = ? AND cerrada_en IS NULL', [
      ahora,
      ahora,
      tabletId,
    ]);
  }
  res.json({ ok: true });
});
