import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import test from 'node:test';
import { calcularQuitar } from '../src/quitarDelPedido.ts';

test('quitar el renglón completo o algunas piezas conserva el precio por pieza', () => {
  // 3 hamburguesas DOBLE CARNE con papas: (50 + 20 + 30) c/u.
  const hamburguesas = { cantidad: 3, subtotal: 300, opciones: { papas: {} } };
  assert.deepEqual(calcularQuitar(hamburguesas), { borrar: true, piezas: 3, importe: 300 });
  assert.deepEqual(calcularQuitar(hamburguesas, 3), { borrar: true, piezas: 3, importe: 300 });
  assert.deepEqual(calcularQuitar(hamburguesas, 1), { borrar: false, piezas: 1, importe: 100, cantidad: 2, subtotal: 200 });
  assert.deepEqual(calcularQuitar({ cantidad: 4, subtotal: 90, opciones: null }, 3), { borrar: false, piezas: 3, importe: 67.5, cantidad: 1, subtotal: 22.5 });
});

test('no se quitan más piezas de las que hay, ni parte de unas MIXTAS', () => {
  assert.match(calcularQuitar({ cantidad: 2, subtotal: 30, opciones: null }, 3).error, /solo tiene 2 piezas/);
  assert.match(calcularQuitar({ cantidad: 2, subtotal: 30, opciones: null }, 0).error, /cuántas piezas/);
  assert.match(calcularQuitar({ cantidad: 2, subtotal: 30, opciones: null }, 1.5).error, /cuántas piezas/);
  assert.match(calcularQuitar({ cantidad: 2, subtotal: 30, opciones: null }, '1').error, /cuántas piezas/);
  const mixtas = { cantidad: 10, subtotal: 130, opciones: { reparto: [{ nombre: 'BBQ', cantidad: 4 }, { nombre: 'Buffalo', cantidad: 6 }] } };
  assert.match(calcularQuitar(mixtas, 4).error, /MIXTAS se quitan completas/);
  assert.deepEqual(calcularQuitar(mixtas), { borrar: true, piezas: 10, importe: 130 });
});

// Base simulada: nunca toca la base real.
test('la caja quita productos y extras de la cuenta y el total se recalcula; cocina y órdenes pagadas no', async (t) => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'quitar-del-pedido-'));
  process.env.DB_HOST = '127.0.0.1';
  process.env.ADMIN_PASSWORD = 'prueba-local-quitar';
  process.env.JWT_SECRET = 'prueba-local-quitar-del-pedido-clave-temporal';
  process.env.PRINT_AGENT_URL = 'http://127.0.0.1:9';
  const { pool } = await import('../src/db.ts');
  const orden = { idOrden: 7, nombre: '5', total: '0.00', tipo_orden: 1, estatus: 1, origen: 'mesa', idSesion_tablet: null };
  const fila = (idDetalle_Orden, nombre, cantidad, subtotal, opciones = null) => ({
    idDetalle_Orden, idProducto: idDetalle_Orden, categoria: 'Tacos', nombre, tamano: null, cantidad, sin_queso: 0, con_queso: 0,
    carne_extra: 0, mix_grupo: null, opciones: opciones && JSON.stringify(opciones), termino_id: null, termino: null, subtotal: subtotal.toFixed(2), creado_en: new Date(),
  });
  let detalle = [fila(1, 'Pollo', 3, 54), fila(2, 'Barbacoa', 1, 18)];
  let extras = [{ id: 9, descripcion: 'Tortillas', importe: '10.00', mix_grupo: null, creado_en: new Date() }];
  const recalcular = () => {
    orden.total = (detalle.reduce((a, d) => a + Number(d.subtotal), 0) + extras.reduce((a, e) => a + Number(e.importe), 0)).toFixed(2);
  };
  recalcular();
  const consulta = async (sql, valores = []) => {
    if (sql.includes('FROM usuarios u')) {
      return [[
        { id: 'u-caja', usuario: 'caja', nombre: 'Caja 1', rol: 'cajero', password_hash: 'x', acceso: null, creado_en: null },
        { id: 'u-cocina', usuario: 'cocina', nombre: 'Cocina', rol: 'cocina', password_hash: 'x', acceso: null, creado_en: null },
      ]];
    }
    if (sql.includes('information_schema.tables')) return [[{ 1: 1 }]];
    if (sql.includes('FROM orden_cuenta_dividida')) return [[]];
    if (sql.includes('FROM orden WHERE idOrden = ? FOR UPDATE')) return [valores[0] === orden.idOrden ? [{ idOrden: orden.idOrden, estatus: orden.estatus }] : []];
    if (sql.includes('FROM orden o')) return [[{ ...orden }]];
    if (sql.includes('orden_has_detalle') && sql.includes('FOR UPDATE')) {
      const d = detalle.find((x) => x.idDetalle_Orden === valores[0] && valores[1] === orden.idOrden);
      return [d ? [{ cantidad: d.cantidad, subtotal: d.subtotal, opciones: d.opciones, categoria: d.categoria, nombre: d.nombre, tamano: d.tamano }] : []];
    }
    if (sql.includes('FROM orden_has_detalle d')) return [detalle.map((d) => ({ ...d }))];
    if (sql.includes('FROM orden_extra WHERE id = ?')) return [extras.filter((e) => e.id === valores[0]).map((e) => ({ descripcion: e.descripcion, importe: e.importe }))];
    if (sql.includes('FROM orden_extra')) return [extras.map((e) => ({ ...e }))];
    throw new Error(`Consulta sin simular: ${sql}`);
  };
  pool.query = consulta;
  pool.getConnection = async () => ({
    query: consulta, async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
    async execute(sql, valores) {
      if (sql.startsWith('DELETE FROM orden_has_detalle')) { detalle = detalle.filter((d) => d.idDetalle_Orden !== valores[0]); return [{}]; }
      if (sql.startsWith('UPDATE orden_has_detalle SET cantidad')) {
        const d = detalle.find((x) => x.idDetalle_Orden === valores[3]);
        d.cantidad = valores[0];
        d.subtotal = valores[1];
        return [{}];
      }
      if (sql.startsWith('DELETE FROM orden_extra')) { extras = extras.filter((e) => e.id !== valores[0]); return [{}]; }
      if (sql.startsWith('UPDATE orden SET total')) { recalcular(); return [{}]; }
      throw new Error(`Escritura sin simular: ${sql}`);
    },
  });
  const { inicializarUsuarios, buscarPorId } = await import('../src/usuarios.ts');
  await inicializarUsuarios();
  const { emitirToken } = await import('../src/auth.ts');
  const { pedidosRouter } = await import('../src/pedidos.ts');
  const app = express(); app.use(express.json()); app.use('/api', pedidosRouter);
  const servidor = app.listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  t.after(async () => { servidor.closeAllConnections(); await new Promise((r) => servidor.close(r)); await pool.end(); });
  const quitar = async (ruta, cuerpo = {}, usuario = 'u-caja') => {
    const res = await fetch(`http://127.0.0.1:${servidor.address().port}/api/ordenes/${ruta}/quitar`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${emitirToken(buscarPorId(usuario))}` }, body: JSON.stringify(cuerpo),
    });
    return { status: res.status, ...await res.json() };
  };

  // Cocina no puede quitar nada.
  const cocina = await quitar('7/detalle/1', {}, 'u-cocina');
  assert.equal(cocina.status, 403);
  assert.equal(orden.total, '82.00');

  // Mandaron 3 tacos y eran 2: se quita 1 y el renglón conserva su precio por pieza.
  const una = await quitar('7/detalle/1', { piezas: 1 });
  assert.equal(una.status, 200);
  assert.deepEqual(una.quitado, { piezas: 1, importe: 18 });
  assert.deepEqual(una.detalle.map((d) => [d.nombre, d.cantidad, d.subtotal]), [['Pollo', 2, 36], ['Barbacoa', 1, 18]]);
  assert.equal(una.orden.total, 64, 'El total se recalcula');

  // El renglón completo y el extra.
  const barbacoa = await quitar('7/detalle/2');
  assert.equal(barbacoa.status, 200);
  assert.deepEqual(barbacoa.detalle.map((d) => d.nombre), ['Pollo']);
  const extra = await quitar('7/extras/9');
  assert.equal(extra.status, 200);
  assert.equal(extra.extras.length, 0);
  assert.equal(extra.orden.total, 36);

  // Lo que ya no está, o de otra orden.
  assert.equal((await quitar('7/detalle/2')).status, 404);
  assert.equal((await quitar('8/detalle/1')).status, 404);
  assert.equal((await quitar('7/extras/9')).status, 404);
  assert.equal((await quitar('7/detalle/1', { piezas: 5 })).status, 400);

  // Pagada: ya no se toca.
  orden.estatus = 2;
  const pagada = await quitar('7/detalle/1');
  assert.equal(pagada.status, 409);
  assert.match(pagada.error, /ya se cobró/);
  assert.equal(detalle.length, 1);
  assert.equal(orden.total, '36.00');
});
