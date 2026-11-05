import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';

process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'ticket-cobro-mix-'));
process.env.DB_HOST = '127.0.0.1';
process.env.ADMIN_PASSWORD = 'prueba-local-ticket-mix';
process.env.JWT_SECRET = 'prueba-local-ticket-mix-clave-temporal';
process.env.PRINT_AGENT_URL = 'http://127.0.0.1:9';
const { productosTicketCobro, lineasTicketCobro } = await import('../src/ticketCobro.ts');
const { calcularCuentasDivididas, guardarCuentasDivididas, reconciliarDivision } = await import('../src/cuentasDivididas.ts');
const { lineasTicketCuentaDividida } = await import('../src/ticketCuentaDividida.ts');

const renglon = (d) => ({ idProducto: 1, categoria: 'Tacos', nombre: 'Pollo', tamano: null, cantidad: 1, subtotal: 18,
  sin_queso: false, con_queso: false, carne_extra: 0, opciones: null, mix_grupo: null, ...d });
const detalle = [
  renglon({ idDetalle_Orden: 1, mix_grupo: 7 }),
  renglon({ idDetalle_Orden: 2 }),
  renglon({ idDetalle_Orden: 3, idProducto: 2, categoria: 'Sopes', nombre: 'Papa', subtotal: 15, mix_grupo: 7 }),
  renglon({ idDetalle_Orden: 4, mix_grupo: 9 }),
  renglon({ idDetalle_Orden: 5, cantidad: 2, subtotal: 36, mix_grupo: 7 }),
  renglon({ idDetalle_Orden: 6, cantidad: 2, subtotal: 36 }),
  renglon({ idDetalle_Orden: 7, sin_queso: true, mix_grupo: 7 }),
  renglon({ idDetalle_Orden: 8, idProducto: 3, categoria: 'Alitas', nombre: 'MIXTAS', cantidad: 3, subtotal: 39, mix_grupo: 9,
    opciones: { reparto: [{ nombre: 'BBQ', cantidad: 1 }, { nombre: 'Buffalo', cantidad: 2 }] } }),
];
const extras = [
  { id: 1, descripcion: 'Queso extra', importe: 10, mix_grupo: 7 },
  { id: 2, descripcion: 'Aderezo', importe: 5, mix_grupo: 9 },
  { id: 3, descripcion: 'Desechables', importe: 3, mix_grupo: null },
  { id: 4, descripcion: 'Extra sin producto', importe: 2, mix_grupo: 44 },
];
const base = { idOrden: 7, etiqueta: 'Mesa 5', paraLlevar: false, abiertaPor: 'Tablet 01', cobro: 'Caja', fecha: new Date(), total: 218, recibido: 250, cambio: 32 };
const textos = (lineas) => lineas.map((l) => [l.texto, l.derecha].filter(Boolean).join(' | ')).filter(Boolean);

test('cobro: separa mixes y productos sueltos, conserva opciones, cantidades e importes entre envíos', () => {
  const productos = productosTicketCobro(detalle);
  assert.deepEqual(productos.filter((p) => p.nombre === 'Tacos Pollo').map((p) => [p.mix_grupo ?? null, p.cantidad, p.importe]),
    [[7, 3, 54], [null, 3, 54], [9, 1, 18]]);
  const lineas = lineasTicketCobro({ ...base, productos, extras });
  const contenido = textos(lineas);
  const inicio = contenido.indexOf('MIX');
  assert.deepEqual(contenido.slice(inicio, contenido.indexOf('TOTAL | $218.00')), [
    'MIX', '3  Tacos Pollo | $54.00', '1  Sopes Papa | $15.00', '1  Tacos Pollo SIN QUESO | $18.00', '+ Queso extra | $10.00',
    '3  Tacos Pollo | $54.00', 'MIX', '1  Tacos Pollo | $18.00', '3  Alitas 1 BBQ + 2 Buffalo | $39.00', '+ Aderezo | $5.00',
    'EXTRAS', 'Desechables | $3.00', 'Extra sin producto | $2.00',
  ]);
  assert.equal(lineas.filter((l) => l.derecha && /^\$/.test(l.derecha) && l.texto !== 'TOTAL' && l.texto !== 'Efectivo' && l.texto !== 'Cambio')
    .reduce((s, l) => s + Math.round(Number(l.derecha.slice(1)) * 100), 0), 21800);
  assert.ok(contenido.includes('Cambio | $32.00'));
  assert.ok(lineas.filter((l) => l.texto === 'MIX').every((l) => l.negrita));
  assert.ok(!lineas.some((l, i) => i > 0 && l.separador && lineas[i - 1].separador));
  const copia = textos(lineasTicketCobro({ ...base, productos, extras, reimpresion: true, recibido: null, cambio: null }));
  assert.ok(copia.includes('*** REIMPRESIÓN ***'));
  assert.equal(copia.filter((l) => l === 'MIX').length, 2);
  assert.ok(!copia.some((l) => /Efectivo|Cambio/.test(l)));
});

test('cuentas divididas: guarda el MIX con sus extras, imprime cada plato y reconcilia sin tomar piezas de otro MIX', async () => {
  const orden = { total: 102, detalle: [renglon({ idDetalle_Orden: 1, mix_grupo: 7 }), renglon({ idDetalle_Orden: 2, mix_grupo: 9 }),
    renglon({ idDetalle_Orden: 3 }), renglon({ idDetalle_Orden: 4, idProducto: 2, categoria: 'Bebidas', nombre: 'Coca-Cola', subtotal: 30 })],
    extras: [{ id: 1, descripcion: 'Queso', importe: 10, mix_grupo: 7 }, { id: 2, descripcion: 'Queso', importe: 5, mix_grupo: 9 },
      { id: 3, descripcion: 'Desechables', importe: 3, mix_grupo: null }] };
  const { cuentas } = calcularCuentasDivididas(orden, { modo: 'productos', personas: 2,
    asignadas: { '1-0': 0, '2-0': 0, '3-0': 0, '4-0': 1, 'extra-1': 0, 'extra-2': 0, 'extra-3': 0 } });
  assert.deepEqual(cuentas.map((c) => c.importe), [72, 30]);
  assert.deepEqual(cuentas[0].productos.map((p) => p.mix_grupo), [7, 9, null]);
  const guardadas = [];
  await guardarCuentasDivididas({ async execute(sql, v) { if (sql.includes('INSERT')) guardadas.push(JSON.parse(v[6])); return [{}]; } }, 7, cuentas, 'Tablet 01', new Date());
  assert.deepEqual(guardadas[0], { productos: cuentas[0].productos, extras: cuentas[0].extras });
  for (const reimpresion of [false, true]) {
    const contenido = textos(lineasTicketCuentaDividida({ ...base, cuenta: cuentas[0], reimpresion, cobro: { cobro: 'Ana', recibido: 100, cambio: 28 } }));
    assert.equal(contenido.filter((l) => l === 'MIX').length, 2);
    assert.ok(contenido.includes('+ Queso | $10.00'));
    assert.ok(contenido.includes('+ Queso | $5.00'));
    assert.ok(contenido.includes('TOTAL A PAGAR | $72.00'));
  }
  const sinSuelto = reconciliarDivision({ ...orden, total: 84, detalle: orden.detalle.filter((d) => d.idDetalle_Orden !== 3) }, cuentas);
  assert.deepEqual(sinSuelto.map((c) => c.importe), [54, 30]);
  assert.deepEqual(sinSuelto[0].productos.map((p) => p.mix_grupo), [7, 9]);
  const sinMix7 = reconciliarDivision({ ...orden, total: 74, detalle: orden.detalle.filter((d) => d.mix_grupo !== 7), extras: orden.extras.filter((e) => e.mix_grupo !== 7) }, cuentas);
  assert.deepEqual(sinMix7.map((c) => c.importe), [44, 30]);
  assert.deepEqual(sinMix7[0].productos.map((p) => p.mix_grupo), [9, null]);
});

test('reimpresión desde la API conserva los mixes de la base hasta el agente de caja', async (t) => {
  const { pool } = await import('../src/db.ts');
  pool.query = async (sql) => {
    if (sql.includes('FROM usuarios u') || sql.includes('GREATEST(t.fecha_inicio')) return [[]];
    if (sql.includes('information_schema.tables')) return [[{ 1: 1 }]];
    if (sql.includes('FROM orden o')) return [[{ idOrden: 7, nombre: '5', total: '218.00', tipo_orden: 1, estatus: 2, origen: 'mesa' }]];
    if (sql.includes('FROM orden_has_detalle d')) return [detalle];
    if (sql.includes('FROM orden_extra')) return [extras];
    if (sql.includes('FROM orden_cuenta_dividida')) return [[]];
    throw new Error(`Consulta sin simular: ${sql}`);
  };
  pool.execute = async () => { throw new Error('Reimprimir no debe escribir en la base.'); };
  const { inicializarUsuarios, buscarPorId } = await import('../src/usuarios.ts');
  await inicializarUsuarios();
  const { emitirToken } = await import('../src/auth.ts');
  const { pedidosRouter } = await import('../src/pedidos.ts');
  const app = express(); app.use(express.json()); app.use('/api', pedidosRouter);
  const servidor = app.listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  const fetchReal = globalThis.fetch;
  let ticket;
  globalThis.fetch = async (url, init) => {
    if (!String(url).startsWith('http://127.0.0.1:9/')) return fetchReal(url, init);
    ticket = JSON.parse(init.body);
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  };
  t.after(async () => { globalThis.fetch = fetchReal; servidor.closeAllConnections(); await new Promise((r) => servidor.close(r)); await pool.end(); });
  const res = await fetch(`http://127.0.0.1:${servidor.address().port}/api/ordenes/7/ticket-cobro`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${emitirToken(buscarPorId('u-admin'))}` }, body: '{}',
  });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).impresion.ok, true);
  assert.equal(ticket.destino, 'caja');
  assert.equal(ticket.lineas.filter((l) => l.texto === 'MIX').length, 2);
  assert.deepEqual(ticket.lineas.filter((l) => l.texto === '+ Queso extra').map((l) => l.derecha), ['$10.00']);
  assert.ok(textos(ticket.lineas).includes('TOTAL | $218.00'));
});
