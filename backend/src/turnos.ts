// Turnos (tablas `turnos` y `sesiones_tablet` de Laravel, migración 2026_10_10_000006):
//   - Turno de caja (idTurno, idUsuario, fecha_inicio, fecha_fin, estatus 1 abierto / 0 cerrado): lo inicia
//     un admin o cajero con «Iniciar turno» (migración 000019). Solo uno abierto a la vez.
//   - Sesión de tablet: se abre al iniciar sesión la tablet, dentro del turno de caja abierto.
// Las mesas que registra la tablet se ligan al turno (mesas.turno_id) y a la sesión (mesas.sesion_tablet_id).
// Cierre del turno (tabla cierres_turno, migración 000028): el corte de caja guarda su registro y cierra el
// turno. Si nadie hizo el corte y el turno sigue abierto al pasar la medianoche, se cierra solo la siguiente
// vez que alguna pantalla consulta el turno, con fecha de esa medianoche y registro de tipo 'automatico'.
import { Router, type Request, type Response, type NextFunction } from 'express';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { requireAuth } from './auth.js';
import { pool } from './db.js';
import { mysqlDisponible } from './usuarios.js';
import { imprimirLineas } from './impresion.js';
import { lineasTicketCorte } from './ticketCorte.js';
import { emitirEvento } from './eventos.js';
import { siguienteMedianoche } from './horario.js';
import { cerrarSesionesTablet } from './sesionesTablet.js';
import { olvidarTabletsEnLinea } from './tablets.js';

/** Al cerrar el turno se cierra la sesión de todas las tablets: vuelven a elegir tablet y esperan el siguiente turno. */
function cerrarTablets() {
  const cerradas = cerrarSesionesTablet();
  olvidarTabletsEnLinea(cerradas);
  if (cerradas.length > 0) console.log(`[turnos] Corte: se cerró la sesión de ${cerradas.length} tablet(s).`);
}

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

/**
 * Turno de caja abierto, o null. Antes cierra el que se haya quedado abierto de un día anterior,
 * así cualquier pantalla que consulte el turno ya no lo ve (ver cerrarTurnosVencidos).
 */
export async function turnoAbierto(db: Consultor = pool!): Promise<TurnoFila | null> {
  await cerrarTurnosVencidos();
  const [filas] = await db.query<TurnoFila[]>(
    'SELECT idTurno, idUsuario, fecha_inicio, fecha_fin, estatus FROM turnos WHERE estatus = 1 LIMIT 1',
  );
  return filas[0] ?? null;
}

/* ---------- Cierre del turno: corte o automático a la medianoche ---------- */

/**
 * Cierra el turno y guarda el registro del cierre (cierres_turno) con lo vendido y lo que quedó sin cobrar.
 * Va dentro de la transacción de quien lo llama, con la fila del turno ya bloqueada.
 */
async function registrarCierre(
  conexion: PoolConnection,
  idTurno: number,
  cierre: { tipo: 'corte' | 'automatico'; usuarioId: string | null; fin: Date },
) {
  const r = (await resumenTurno(idTurno, conexion))!;
  const ahora = new Date();
  await conexion.execute(
    `INSERT INTO cierres_turno (turno_id, tipo, usuario_id, cerrado_en, ordenes_cobradas, total_vendido, ordenes_pendientes, creado_en, actualizado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [idTurno, cierre.tipo, cierre.usuarioId, cierre.fin, r.ordenes.pagadas, r.totalVendido.toFixed(2), r.pendientes.length, ahora, ahora],
  );
  await conexion.execute('UPDATE turnos SET estatus = 0, fecha_fin = ?, actualizado_en = ? WHERE idTurno = ?', [cierre.fin, ahora, idTurno]);
  await conexion.execute('UPDATE sesiones_tablet SET cerrada_en = ?, actualizado_en = ? WHERE turno_id = ? AND cerrada_en IS NULL', [
    cierre.fin,
    ahora,
    idTurno,
  ]);
}

// Ya se revisó y no hay turnos vencidos hasta esta hora (la siguiente medianoche): no se vuelve a consultar.
let sinVencidosHasta = 0;
let revisando: Promise<void> | null = null;

/**
 * Si nadie hizo el corte, el turno abierto se cierra solo a la medianoche que sigue a su último movimiento
 * (apertura o última orden), con registro 'automatico'. En la operación normal es la medianoche del día en que
 * se trabajó: las pantallas consultan el turno cada pocos segundos, así que pasando las 12 ya no se puede
 * registrar nada en él. Contar desde el último movimiento evita cerrar a media jornada un turno que ya cruzó
 * una medianoche y se sigue usando. Las órdenes sin cobrar se cuentan en el registro y pasan al siguiente turno
 * (ver /iniciar). Después de revisar no se vuelve a consultar la base hasta la siguiente medianoche.
 */
export function cerrarTurnosVencidos(): Promise<void> {
  if (!pool || !mysqlDisponible() || Date.now() < sinVencidosHasta) return Promise.resolve();
  revisando ??= (async () => {
    const [abiertos] = await pool!.query<RowDataPacket[]>(
      `SELECT t.idTurno, GREATEST(t.fecha_inicio, COALESCE(MAX(o.actualizado_en), t.fecha_inicio)) AS ultimo_movimiento
         FROM turnos t LEFT JOIN orden o ON o.idTurno = t.idTurno
        WHERE t.estatus = 1
        GROUP BY t.idTurno, t.fecha_inicio`,
    );
    const ahora = Date.now();
    const vencidos = abiertos
      .map((t) => ({ idTurno: Number(t.idTurno), fin: siguienteMedianoche(new Date(t.ultimo_movimiento)) }))
      .filter((t) => t.fin.getTime() <= ahora);
    let cerrados = 0;
    for (const turno of vencidos) {
      const conexion = await pool!.getConnection();
      try {
        await conexion.beginTransaction();
        // Otra petición pudo cerrarlo mientras tanto (o la caja hizo el corte): se vuelve a revisar con la fila bloqueada.
        const [sigue] = await conexion.query<TurnoFila[]>('SELECT idTurno FROM turnos WHERE idTurno = ? AND estatus = 1 FOR UPDATE', [
          turno.idTurno,
        ]);
        if (sigue[0]) {
          await registrarCierre(conexion, turno.idTurno, { tipo: 'automatico', usuarioId: null, fin: turno.fin });
          cerrados++;
        }
        await conexion.commit();
      } catch (err) {
        await conexion.rollback();
        throw err;
      } finally {
        conexion.release();
      }
    }
    if (cerrados > 0) {
      console.log(`[turnos] Cierre automático a la medianoche: ${cerrados} turno(s) que seguían abiertos.`);
      cerrarTablets();
      emitirEvento('turno', 'ordenes'); // las pantallas abiertas pasan a «sin turno»
    }
    // Un turno abierto solo puede vencer a partir de la siguiente medianoche: hasta entonces no se revisa.
    sinVencidosHasta = siguienteMedianoche(new Date(ahora)).getTime();
  })()
    .catch((err) => console.error('[turnos] No se pudo hacer el cierre automático:', err))
    .finally(() => {
      revisando = null;
    });
  return revisando;
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
  /** Registro del cierre (cierres_turno); null mientras el turno está abierto. */
  cierre: { tipo: 'corte' | 'automatico'; cerro: string | null; cerrado_en: Date; ordenes_pendientes: number } | null;
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
  const [cierres] = await db.query<RowDataPacket[]>(
    `SELECT ct.tipo, u.nombre AS cerro, ct.cerrado_en, ct.ordenes_pendientes
       FROM cierres_turno ct LEFT JOIN usuarios u ON u.id = ct.usuario_id WHERE ct.turno_id = ?`,
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
    cierre: cierres[0]
      ? {
          tipo: cierres[0].tipo,
          cerro: cierres[0].cerro ?? null,
          cerrado_en: cierres[0].cerrado_en,
          ordenes_pendientes: Number(cierres[0].ordenes_pendientes),
        }
      : null,
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
            ct.tipo AS cierre_tipo, uc.nombre AS cerro, COALESCE(ct.ordenes_pendientes, 0) AS ordenes_pendientes,
            COUNT(CASE WHEN o.estatus = 2 THEN 1 END) AS ordenes_cobradas,
            COALESCE(SUM(CASE WHEN o.estatus = 2 THEN o.total END), 0) AS total_vendido
       FROM turnos t
       LEFT JOIN usuarios u ON u.id = t.idUsuario
       LEFT JOIN cierres_turno ct ON ct.turno_id = t.idTurno
       LEFT JOIN usuarios uc ON uc.id = ct.usuario_id
       LEFT JOIN orden o ON o.idTurno = t.idTurno
      WHERE t.estatus = 0
      GROUP BY t.idTurno, u.nombre, t.idUsuario, t.fecha_inicio, t.fecha_fin, ct.tipo, uc.nombre, ct.ordenes_pendientes
      ORDER BY t.idTurno DESC
      LIMIT 50`,
  );
  res.json({
    turnos: turnos.map((t) => ({
      ...t,
      ordenes_cobradas: Number(t.ordenes_cobradas),
      total_vendido: Number(t.total_vendido),
      ordenes_pendientes: Number(t.ordenes_pendientes),
    })),
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
    // Registro del cierre (quién hizo el corte y lo vendido) y cierre del turno, en la misma transacción.
    await registrarCierre(conexion, turno.idTurno, { tipo: 'corte', usuarioId: req.usuario!.id, fin: new Date() });
    await conexion.commit();
    cerrarTablets();

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
    const [creado] = await conexion.execute<ResultSetHeader>(
      'INSERT INTO turnos (idUsuario, fecha_inicio, fecha_fin, estatus, creado_en, actualizado_en) VALUES (?, ?, NULL, 1, ?, ?)',
      [req.usuario!.id, ahora, ahora, ahora],
    );
    // Órdenes que quedaron sin cobrar cuando un turno se cerró solo (nadie hizo el corte): pasan a este turno
    // para que aparezcan en Cajas y se puedan cobrar.
    const [traidas] = await conexion.execute<ResultSetHeader>(
      `UPDATE orden SET idTurno = ?, actualizado_en = ?
        WHERE (estatus = 1 OR (estatus = 0 AND total > 0))
          AND idTurno IN (SELECT turno_id FROM cierres_turno WHERE tipo = 'automatico')`,
      [creado.insertId, ahora],
    );
    if (traidas.affectedRows > 0) {
      console.log(`[turnos] ${traidas.affectedRows} orden(es) sin cobrar de un cierre automático pasan al turno ${creado.insertId}.`);
    }
    res.status(201).json({ turno: await turnoAbierto(conexion), nuevo: true, ordenesTraidas: traidas.affectedRows });
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
    // La tablet llama aquí cada vez que recibe un aviso de "turno". Si la sesión ya estaba abierta no
    // cambió nada: no se avisa, o la tablet respondería a su propio aviso en bucle (3 vueltas por segundo).
    if (!nueva) res.locals.sinCambios = true;
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
