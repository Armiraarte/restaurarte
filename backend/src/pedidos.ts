// Menú y pedidos desde MySQL (tablas de Laravel: categorias, producto, complementos,
// producto_has_complemento, orden y orden_has_detalle). La tabla comanda ya no se usa (se eliminó);
// lo que va a cocina sale en el ticket de cocina impreso.
//
//   GET   /api/menu                         categorías activas con sus productos (grupo, precio) y complementos
//                                           (lo agotado se lee aparte: /api/agotados; un pedido que lo traiga se rechaza)
//   GET   /api/ordenes/:idOrden             la orden con su detalle y total
//   POST  /api/ordenes/:idOrden/pedido      { items: [{ idProducto, cantidad, sin?, mezcla?, reparto?, sinQueso?, conQueso?, carneExtra?, mixGrupo? }] }
//                                           reparto = MIXTAS (cualquier categoría): [{ nombre, cantidad }] por sabor, en un solo renglón; cada pieza a su precio
//                                           complementosExtra = IDs de complementos EXTRA (doble toque); +$1 c/u por pieza
//                                           nota = comentario del platillo (hasta 200 caracteres); en cocina sale como NOTA
//                                           Cada producto conserva precio, opciones y grupo MIX en orden_has_detalle.
//                                           sinQueso = Quesadillas y Hamburguesas: SIN QUESO
//                                           carneExtra = solo Hamburguesas: 1 doble, 2 triple; +$20 c/u por pieza
//   POST  /api/ordenes/:idOrden/pedir-cuenta  orden.estatus 0 (ABIERTA) → 1 (PAGANDO): la caja hace el cobro
//   POST  /api/ordenes/:idOrden/cobrar      { recibido } orden.estatus 1 (PAGANDO) → 2 (PAGADO) e imprime el ticket de cobro
//   POST  /api/ordenes/:idOrden/ticket-cobro  { recibido? } reimprime el ticket de cobro de una orden pagada
//                                           (sin recibido, p. ej. desde Ventas, no imprime efectivo ni cambio)
import { Router, type Request, type Response, type NextFunction } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { requireAuth } from './auth.js';
import { pool } from './db.js';
import { mysqlDisponible } from './usuarios.js';
import { turnoAbierto } from './turnos.js';
import { imprimirLineas } from './impresion.js';
import { lineasTicketCobro } from './ticketCobro.js';
import { guardarDetallePedido, itemsValidos, terminoPermitido, type ItemPedido, type PapasPedido, type ProductosReparto, type RepartoPedido } from './detallePedido.js';
import { extrasValidos, guardarExtrasPedido, recalcularTotalOrden } from './extrasPedido.js';
import { agotadosActuales, estaAgotado } from './agotados.js';
import { esOrigenOrden, origenOrden } from './origenOrden.js';

// Opciones por renglón; las mismas constantes que OrdenDetalle en Laravel.
/** Categorías que ofrecen SIN QUESO. */
const CATEGORIAS_SIN_QUESO = ['Tacos', 'Sopes', 'Quesadillas', 'Hamburguesas', 'Lonches'];
const CATEGORIAS_CON_QUESO = ['Tacos', 'Sopes', 'Quesadillas', 'Hamburguesas', 'Lonches'];
/** La única categoría con DOBLE / TRIPLE CARNE. */
const CATEGORIA_CARNE_EXTRA = 'Hamburguesas';

/** Texto de la carne extra para tickets: 1 → DOBLE CARNE, 2 → TRIPLE CARNE. */
const textoCarneExtra = (n: number) => (n === 1 ? 'DOBLE CARNE' : n === 2 ? 'TRIPLE CARNE' : '');

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

/** orden.nombre "5" → "Mesa 5"; un nombre de cliente se deja igual (mismo criterio que el frontend). */
const etiquetaOrden = (nombre: string) => (/^\d+$/.test(nombre) ? `Mesa ${nombre}` : nombre);

export const pedidosRouter = Router();
pedidosRouter.use(requireAuth, conBase, soloRoles('tablet', 'admin', 'cajero', 'cocina'));

/* ---------- Menú ---------- */

pedidosRouter.get('/menu', async (_req, res) => {
  const [terminos] = await pool!.query<RowDataPacket[]>('SELECT id, nombre FROM termino WHERE estatus = 1 ORDER BY id');
  const [categorias] = await pool!.query<RowDataPacket[]>('SELECT id, nombre FROM categorias WHERE estatus = 1 ORDER BY id');
  const [productos] = await pool!.query<RowDataPacket[]>(
    'SELECT id, categoria_id, nombre, tamano, grupo, precio, imagen FROM producto WHERE estatus = 1 ORDER BY categoria_id, id',
  );
  const [complementos] = await pool!.query<RowDataPacket[]>(
    `SELECT phc.producto_id, c.id, c.nombre
       FROM producto_has_complemento phc JOIN complementos c ON c.id = phc.complemento_id
      WHERE c.estatus = 1 ORDER BY c.nombre, c.id`,
  );

  const complementosDe = new Map<number, { id: number; nombre: string }[]>();
  for (const c of complementos) {
    complementosDe.set(c.producto_id, [...(complementosDe.get(c.producto_id) ?? []), { id: c.id, nombre: c.nombre }]);
  }
  const categoriaPapas = categorias.find((c) => c.nombre === 'Papas a la Francesa');
  const papas = productos.find((p) => p.categoria_id === categoriaPapas?.id && p.tamano === 'Orden completa');

  res.json({
    terminos,
    papas: papas ? { idProducto: papas.id, nombre: papas.nombre, tamano: papas.tamano, precio: Number(papas.precio) } : null,
    categorias: categorias.map((cat) => ({
      id: cat.id,
      nombre: cat.nombre,
      productos: productos
        .filter((p) => p.categoria_id === cat.id)
        .map((p) => ({
          id: p.id,
          nombre: p.nombre,
          tamano: p.tamano,
          grupo: p.grupo,
          precio: Number(p.precio),
          imagen: p.imagen,
          complementos: (complementosDe.get(p.id) ?? []).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })),
        })),
    })),
  });
});

/* ---------- Órdenes ---------- */

async function ordenConDetalle(idOrden: number) {
  const [ordenes] = await pool!.query<RowDataPacket[]>(
    `SELECT o.*,
            t.nombre AS abierta_por
       FROM orden o
       LEFT JOIN sesiones_tablet st ON st.id = o.idSesion_tablet
       LEFT JOIN tablets t ON t.id = st.tablet_id
      WHERE o.idOrden = ?`,
    [idOrden],
  );
  if (!ordenes[0]) return null;
  const [detalle] = await pool!.query<RowDataPacket[]>(
    `SELECT d.idDetalle_Orden, d.idProducto, c.nombre AS categoria, p.nombre, p.tamano, d.cantidad,
            d.sin_queso, d.con_queso, d.carne_extra, d.mix_grupo, d.opciones, d.termino_id, te.nombre AS termino, d.subtotal, d.creado_en
       FROM orden_has_detalle d
       JOIN producto p ON p.id = d.idProducto
       JOIN categorias c ON c.id = p.categoria_id
       LEFT JOIN termino te ON te.id = d.termino_id
      WHERE d.idOrden = ? ORDER BY d.idDetalle_Orden`,
    [idOrden],
  );
  const o = ordenes[0];
  const detalles: RowDataPacket[] = detalle.map((d) => ({ ...d, opciones: typeof d.opciones === 'string' ? JSON.parse(d.opciones) : d.opciones }));
  const origen = origenOrden(o.nombre, o.origen ?? detalles.find((d) => d.opciones?.comanda?.tipoPedido)?.opciones?.comanda?.tipoPedido);
  const [extras] = await pool!.query<RowDataPacket[]>(
    'SELECT id, descripcion, importe, creado_en FROM orden_extra WHERE idOrden = ? ORDER BY id', [idOrden],
  );
  return {
    extras: extras.map((e) => ({ ...e, importe: Number(e.importe) })),
    // Sin sesión de tablet = la abrió la caja.
    orden: { ...o, origen, total: Number(o.total), etiqueta: etiquetaOrden(o.nombre), abierta_por: o.abierta_por ?? 'Caja' },
    detalle: detalles.map((d) => ({
      ...d,
      sin_queso: Boolean(d.sin_queso),
      con_queso: Boolean(d.con_queso),
      mix_grupo: d.mix_grupo == null ? null : Number(d.mix_grupo),
      opciones: typeof d.opciones === 'string' ? JSON.parse(d.opciones) : d.opciones,
      carne_extra: Number(d.carne_extra),
      subtotal: Number(d.subtotal),
    })),
  };
}

pedidosRouter.get('/ordenes/:idOrden', async (req, res) => {
  const datos = await ordenConDetalle(Number(req.params.idOrden));
  if (!datos) {
    res.status(404).json({ error: 'La orden no existe.' });
    return;
  }
  res.json(datos);
});

/** Cocina: comandas del turno, incluidas las cuentas cobradas, agrupables por mesa. */
pedidosRouter.get('/cocina', soloRoles('admin', 'cajero', 'cocina'), async (_req, res) => {
  const turno = await turnoAbierto();
  if (!turno) {
    res.json({ turno: null, ordenes: [] });
    return;
  }
  const [ordenes] = await pool!.query<RowDataPacket[]>(
    `SELECT o.*, o.idOrden AS id,
            COUNT(DISTINCT e.creado_en) AS envios, MAX(e.creado_en) AS ultimo_envio, MAX(e.origen_pedido) AS origen_detalle
       FROM orden o
       JOIN (
         SELECT d.idOrden, d.creado_en, JSON_UNQUOTE(JSON_EXTRACT(d.opciones, '$.comanda.tipoPedido')) AS origen_pedido FROM orden_has_detalle d
         JOIN producto p ON p.id = d.idProducto JOIN categorias c ON c.id = p.categoria_id
         WHERE c.nombre <> 'Bebidas'
         UNION ALL SELECT idOrden, creado_en, NULL FROM orden_extra
       ) e ON e.idOrden = o.idOrden
      WHERE o.idTurno = ?
      GROUP BY o.idOrden
      ORDER BY o.nombre REGEXP '^[0-9]+$' DESC, CAST(o.nombre AS UNSIGNED), o.nombre, o.idOrden`,
    [turno.idTurno],
  );
  res.json({ turno: { idTurno: turno.idTurno }, ordenes: ordenes.map((o) => ({ ...o, origen: origenOrden(o.nombre, o.origen ?? o.origen_detalle) })) });
});

/** Pedir la cuenta: la orden pasa a PAGANDO (1) para que la caja la cobre. Solo si está abierta y tiene algo pedido. */
pedidosRouter.post('/ordenes/:idOrden/pedir-cuenta', async (req, res) => {
  const idOrden = Number(req.params.idOrden);
  const actual = await ordenConDetalle(idOrden);
  if (!actual) {
    res.status(404).json({ error: 'La orden no existe.' });
    return;
  }
  if (actual.detalle.length === 0 && actual.extras.length === 0) {
    res.status(409).json({ error: 'La orden no tiene productos; no hay cuenta que cobrar.' });
    return;
  }
  if (Number((actual.orden as { estatus?: number }).estatus) === 2) {
    res.status(409).json({ error: 'Esta orden ya está pagada.' });
    return;
  }
  await pool!.execute('UPDATE orden SET estatus = 1, actualizado_en = ? WHERE idOrden = ? AND estatus = 0', [new Date(), idOrden]);
  res.json(await ordenConDetalle(idOrden));
});

/* ---------- Cobro ---------- */

const redondear = (n: number) => Math.round(n * 100) / 100;

/** Imprime el ticket de cobro; si la impresora falla, el cobro ya quedó hecho y solo se avisa. */
async function imprimirTicketCobro(idOrden: number, recibido: number | null, cobro: string, reimpresion = false) {
  const datos = await ordenConDetalle(idOrden);
  if (!datos) return { ok: false, error: 'La orden no existe.' };
  const o = datos.orden as unknown as { idOrden: number; etiqueta: string; tipo_orden: number; abierta_por: string; total: number };
  // Para el cliente se junta el mismo producto aunque se haya pedido en varios envíos
  // (las quesadillas sin queso van en su propio renglón).
  const porProducto = new Map<string, { cantidad: number; nombre: string; importe: number }>();
  type Renglon = { idProducto: number; categoria: string; nombre: string; tamano: string | null; cantidad: number; sin_queso: boolean; con_queso: boolean; carne_extra: number; subtotal: number; opciones: { mezcla?: string[]; reparto?: RepartoPedido[]; papas?: PapasPedido; complementosExtra?: { nombre: string }[] } | null };
  for (const d of datos.detalle as unknown as Renglon[]) {
    // MIXTAS: "4 BBQ + 6 Buffalo"; mezcla sin cantidades: "Papa con Frijol".
    const nombre = d.opciones?.reparto?.length
      ? d.opciones.reparto.map((r) => `${r.cantidad} ${r.nombre}`).join(' + ')
      : d.opciones?.mezcla && d.opciones.mezcla.length > 1 ? d.opciones.mezcla.join(' con ') : d.nombre;
    const extra = d.opciones?.complementosExtra?.length ? `EXTRA ${d.opciones.complementosExtra.map((c) => c.nombre).join(' Y ').toUpperCase()}` : '';
    const clave = `${d.idProducto}-${d.sin_queso ? 1 : 0}-${d.con_queso ? 1 : 0}-${d.carne_extra}-${nombre}-${d.opciones?.papas ? 1 : 0}-${extra}`;
    const opciones = [d.sin_queso ? 'SIN QUESO' : '', d.con_queso ? 'CON QUESO' : '', textoCarneExtra(d.carne_extra), d.opciones?.papas ? 'CON PAPAS' : '', extra].filter(Boolean).join(' ');
    const p = porProducto.get(clave) ?? {
      cantidad: 0,
      // Papas: «Orden de papas» / «Media orden de papas», sin repetir «Papas a la Francesa».
      nombre: d.categoria === 'Papas a la Francesa'
        ? (d.tamano === 'Media orden' ? 'Media orden de papas' : 'Orden de papas')
        : `${d.categoria} ${nombre}${d.tamano ? ` (${d.tamano})` : ''}${opciones ? ` ${opciones}` : ''}`,
      importe: 0,
    };
    p.cantidad += d.cantidad;
    p.importe = redondear(p.importe + d.subtotal);
    porProducto.set(clave, p);
  }
  try {
    await imprimirLineas(
      lineasTicketCobro({
        idOrden: o.idOrden,
        etiqueta: o.etiqueta,
        paraLlevar: o.tipo_orden === 2,
        abiertaPor: o.abierta_por,
        cobro,
        fecha: new Date(),
        productos: [...porProducto.values()],
        extras: datos.extras as unknown as { descripcion: string; importe: number }[],
        total: o.total,
        recibido,
        cambio: recibido === null ? null : redondear(recibido - o.total),
        reimpresion,
      }),
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'No se pudo imprimir.' };
  }
}

/** Cobrar: la orden que pidió la cuenta (PAGANDO) pasa a PAGADO e imprime el ticket de cobro. */
pedidosRouter.post('/ordenes/:idOrden/cobrar', soloRoles('admin', 'cajero'), async (req, res) => {
  const idOrden = Number(req.params.idOrden);
  const recibido = redondear(Number(req.body?.recibido));
  const actual = await ordenConDetalle(idOrden);
  if (!actual) {
    res.status(404).json({ error: 'La orden no existe.' });
    return;
  }
  if (!(await turnoAbierto())) {
    res.status(409).json({ error: 'Inicia el turno para poder cobrar.', sinTurno: true });
    return;
  }
  const { estatus, total } = actual.orden as unknown as { estatus: number; total: number };
  if (estatus !== 1) {
    res.status(409).json({ error: estatus === 2 ? 'Esta orden ya está pagada.' : 'La orden no ha pedido la cuenta.' });
    return;
  }
  if (!Number.isFinite(recibido) || recibido < total) {
    res.status(400).json({ error: `El monto recibido debe ser de al menos $${total.toFixed(2)}.` });
    return;
  }
  const [resultado] = await pool!.execute<import('mysql2/promise').ResultSetHeader>(
    'UPDATE orden SET estatus = 2, actualizado_en = ? WHERE idOrden = ? AND estatus = 1',
    [new Date(), idOrden],
  );
  if (resultado.affectedRows === 0) {
    res.status(409).json({ error: 'Esta orden ya se cobró en otra caja.' });
    return;
  }
  const impresion = await imprimirTicketCobro(idOrden, recibido, req.usuario!.nombre);
  res.json({ ...(await ordenConDetalle(idOrden)), cobro: { total, recibido, cambio: redondear(recibido - total) }, impresion });
});

/** Reimprimir el ticket de cobro de una orden ya pagada. */
pedidosRouter.post('/ordenes/:idOrden/ticket-cobro', soloRoles('admin', 'cajero'), async (req, res) => {
  const idOrden = Number(req.params.idOrden);
  const valor = Number(req.body?.recibido);
  const recibido = req.body?.recibido != null && Number.isFinite(valor) ? redondear(valor) : null;
  const actual = await ordenConDetalle(idOrden);
  if (!actual || (actual.orden as unknown as { estatus: number }).estatus !== 2) {
    res.status(409).json({ error: 'La orden no está pagada.' });
    return;
  }
  res.json({ impresion: await imprimirTicketCobro(idOrden, recibido, req.usuario!.nombre, true) });
});

/** Envía un pedido a cocina: guarda el detalle (orden_has_detalle) y recalcula el total de la orden. */
pedidosRouter.post('/ordenes/:idOrden/pedido', async (req, res) => {
  const idOrden = Number(req.params.idOrden);
  const items: ItemPedido[] = Array.isArray(req.body?.items)
    ? req.body.items
    : [];
  const extras = req.body?.extras ?? [];
  if (req.body?.origenPedido !== undefined && !esOrigenOrden(req.body.origenPedido)) {
    res.status(400).json({ error: 'Origen del pedido inválido.' });
    return;
  }
  if (!Number.isSafeInteger(idOrden) || idOrden < 1) {
    res.status(400).json({ error: 'Orden no válida.' });
    return;
  }
  if ((req.body?.items !== undefined && !Array.isArray(req.body.items)) || !extrasValidos(extras) || (items.length > 0 && !itemsValidos(items)) || (items.length === 0 && extras.length === 0)) {
    res.status(400).json({ error: 'Agrega productos válidos o extras con descripción e importe mayor que cero (hasta dos decimales).' });
    return;
  }

  const conexion = await pool!.getConnection();
  try {
    await conexion.beginTransaction();
    // Bloquea la orden para que dos tablets no descuadren el total al mismo tiempo.
    const [ordenes] = await conexion.query<RowDataPacket[]>('SELECT idOrden, estatus FROM orden WHERE idOrden = ? FOR UPDATE', [idOrden]);
    if (!ordenes[0]) {
      await conexion.rollback();
      res.status(404).json({ error: 'La orden no existe.' });
      return;
    }
    // El mismo bloqueo de fila protege el paso a cobro frente a pedidos de una pantalla desactualizada.
    const estatus = Number(ordenes[0].estatus);
    if (estatus !== 0) {
      await conexion.rollback();
      res.status(409).json({
        error: estatus === 2
          ? 'Esta orden ya se cobró; abre una orden nueva para esa mesa.'
          : 'Esta orden está en cobro; ya no se pueden agregar productos ni modificar el pedido.',
        ordenBloqueada: true,
        estatus,
      });
      return;
    }

    const ids = [...new Set(items.map((i) => i.idProducto))];
    const [productos] = await conexion.query<RowDataPacket[]>(
      `SELECT p.id, p.nombre, p.tamano, p.precio, p.categoria_id, c.nombre AS categoria
         FROM producto p JOIN categorias c ON c.id = p.categoria_id
        WHERE p.id IN (?) AND p.estatus = 1`,
      [ids.length ? ids : [0]],
    );
    const porId = new Map(productos.map((p) => [p.id as number, p]));
    const faltante = ids.find((id) => !porId.has(id));
    if (faltante) {
      await conexion.rollback();
      res.status(400).json({ error: `El producto ${faltante} no existe o no está disponible.` });
      return;
    }

    // Cada opción solo en su categoría: SIN QUESO en quesadillas y hamburguesas,
    // DOBLE / TRIPLE CARNE en hamburguesas.
    const categoriaDe = (i: (typeof items)[number]) => porId.get(i.idProducto)!.categoria as string;
    const fueraDeLugar =
      items.find((i) => i.sinQueso && !CATEGORIAS_SIN_QUESO.includes(categoriaDe(i))) ??
      items.find((i) => i.conQueso && !CATEGORIAS_CON_QUESO.includes(categoriaDe(i))) ??
      items.find((i) => i.conPapas && !['Lonches', 'Hamburguesas'].includes(categoriaDe(i))) ??
      items.find((i) => (i.carneExtra ?? 0) > 0 && categoriaDe(i) !== CATEGORIA_CARNE_EXTRA);
    if (fueraDeLugar) {
      await conexion.rollback();
      res.status(400).json({
        error: fueraDeLugar.sinQueso && !CATEGORIAS_SIN_QUESO.includes(categoriaDe(fueraDeLugar))
          ? `La opción SIN QUESO no está disponible para ${categoriaDe(fueraDeLugar)}.`
          : fueraDeLugar.conQueso && !CATEGORIAS_CON_QUESO.includes(categoriaDe(fueraDeLugar))
            ? `La opción CON QUESO no está disponible para ${categoriaDe(fueraDeLugar)}.`
            : fueraDeLugar.conPapas && !['Lonches', 'Hamburguesas'].includes(categoriaDe(fueraDeLugar))
              ? 'Solo las hamburguesas y lonches ofrecen CON PAPAS.'
              : `Solo las hamburguesas llevan carne extra (${categoriaDe(fueraDeLugar)}).`,
      });
      return;
    }

    if (items.some((i) => i.terminoId != null)) {
      const [terminos] = await conexion.query<RowDataPacket[]>('SELECT id, nombre FROM termino WHERE estatus = 1');
      const porTermino = new Map(terminos.map((t) => [t.id as number, t.nombre as string]));
      if (items.some((i) => i.terminoId != null && !terminoPermitido(categoriaDe(i), porTermino.get(i.terminoId)))) {
        await conexion.rollback();
        res.status(400).json({ error: 'El término no está disponible para este producto.' });
        return;
      }
    }

    // Productos de las categorías del pedido: los nombres de una mezcla y, en MIXTAS, el de cada sabor
    // (misma categoría y mismo tamaño), con el que se cobra cada pieza a su precio.
    const [rellenos] = await conexion.query<RowDataPacket[]>(
      'SELECT id, nombre, tamano, precio, categoria_id FROM producto WHERE categoria_id IN (?) AND estatus = 1',
      [[...new Set(productos.map((p) => p.categoria_id)), 0]],
    );
    const productosReparto: ProductosReparto = new Map();
    let saborFaltante = false;
    for (const i of items) {
      if (!i.reparto) continue;
      const base = porId.get(i.idProducto)!;
      const sabores = i.reparto.map((r) =>
        rellenos.find((p) => p.categoria_id === base.categoria_id && p.nombre === r.nombre && (p.tamano ?? null) === (base.tamano ?? null)));
      if (sabores.some((s) => !s)) saborFaltante = true;
      else productosReparto.set(i, sabores.map((s) => ({ id: s!.id as number, precio: Number(s!.precio) })));
    }
    // Lo que se terminó (apartado Agotados) no se puede comandar: ni solo, ni en una mezcla, ni en MIXTAS.
    const terminados = new Set<string>();
    for (const i of items) {
      const base = porId.get(i.idProducto)!;
      const delMismoTamano = (nombre: string) =>
        rellenos.filter((p) => p.categoria_id === base.categoria_id && p.nombre === nombre && (p.tamano ?? null) === (base.tamano ?? null));
      for (const p of [base, ...[...(i.mezcla ?? []), ...(i.reparto ?? []).map((r) => r.nombre)].flatMap(delMismoTamano)]) {
        if (estaAgotado(p.id)) terminados.add(`${base.categoria} ${p.nombre}${p.tamano ? ` (${p.tamano})` : ''}`);
      }
    }
    if (terminados.size) {
      await conexion.rollback();
      res.status(409).json({
        error: `Se terminó: ${[...terminados].join(', ')}. Quítalo del pedido para poder enviarlo.`,
        agotados: agotadosActuales(),
      });
      return;
    }
    const idsConSabores = [...new Set([...ids, ...[...productosReparto.values()].flat().map((s) => s.id)])];
    const [relaciones] = await conexion.query<RowDataPacket[]>(
      `SELECT phc.producto_id, c.id, c.nombre FROM producto_has_complemento phc
       JOIN complementos c ON c.id = phc.complemento_id WHERE phc.producto_id IN (?) AND c.estatus = 1 ORDER BY c.nombre, c.id`,
      [idsConSabores.length ? idsConSabores : [0]],
    );
    const complementos = new Map<number, { id: number; nombre: string }[]>();
    for (const c of relaciones) {
      complementos.set(c.producto_id, [...(complementos.get(c.producto_id) ?? []), { id: c.id, nombre: c.nombre }]);
    }
    // En MIXTAS se aceptan los complementos de todos los sabores.
    const ofrecidosDe = (i: ItemPedido) =>
      [i.idProducto, ...(productosReparto.get(i) ?? []).map((s) => s.id)].flatMap((id) => complementos.get(id) ?? []);
    if (saborFaltante || items.some((i) =>
      [...(i.sin ?? []), ...(i.complementosExtra ?? [])].some((id) => !ofrecidosDe(i).some((c) => c.id === id)) ||
      (i.mezcla ?? []).some((nombre) =>
        !rellenos.some((p) => p.categoria_id === porId.get(i.idProducto)!.categoria_id && p.nombre === nombre))
    )) {
      await conexion.rollback();
      res.status(400).json({ error: 'Las opciones no corresponden al producto. Vuelve a cargar el menú.' });
      return;
    }
    let papas: PapasPedido | null = null;
    if (items.some((i) => i.conPapas)) {
      const [filas] = await conexion.query<RowDataPacket[]>(
        `SELECT p.id, p.nombre, p.tamano, p.precio FROM producto p JOIN categorias c ON c.id = p.categoria_id
         WHERE c.nombre = 'Papas a la Francesa' AND p.tamano = 'Orden completa' AND p.estatus = 1 AND c.estatus = 1 LIMIT 1`,
      );
      if (!filas[0]) {
        await conexion.rollback();
        res.status(409).json({ error: 'La orden completa de papas no está disponible. Recarga el menú.' });
        return;
      }
      const p = filas[0];
      if (estaAgotado(p.id)) {
        await conexion.rollback();
        res.status(409).json({ error: 'Se terminaron las papas. Quita CON PAPAS para poder enviar el pedido.', agotados: agotadosActuales() });
        return;
      }
      papas = { idProducto: p.id, nombre: p.nombre, tamano: p.tamano, precio: Number(p.precio) };
    }
    const ahora = new Date();
    const guardados = await guardarDetallePedido(conexion, idOrden, items, porId, complementos, ahora, papas, productosReparto,
      req.usuario!.rol === 'tablet' ? req.usuario!.nombre : 'CAJA', req.body?.origenPedido);
    const extrasGuardados = await guardarExtrasPedido(conexion, idOrden, extras, ahora);
    await recalcularTotalOrden(conexion, idOrden, ahora);
    await conexion.commit();

    res.status(201).json({ ...(await ordenConDetalle(idOrden)), guardados, extrasGuardados });
  } catch (err) {
    await conexion.rollback();
    console.error('[pedidos] No se pudo registrar el pedido:', err);
    res.status(500).json({ error: 'No se pudo registrar el pedido.' });
  } finally {
    conexion.release();
  }
});
