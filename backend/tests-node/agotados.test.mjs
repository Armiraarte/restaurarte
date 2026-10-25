import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';

// Todo se ejecuta contra HTTP y una base simulada; no conecta a MySQL ni imprime tickets.
const carpeta = mkdtempSync(path.join(os.tmpdir(), 'restaurarte-agotados-'));
process.env.DATA_DIR = carpeta;
process.env.DB_HOST = '127.0.0.1';
process.env.ADMIN_PASSWORD = 'prueba-local-agotados';
process.env.JWT_SECRET = 'prueba-local-agotados-sin-acceso-a-produccion';

const productos = [
  { id: 1, nombre: 'Papa', tamano: null, precio: 15, categoria_id: 3, categoria: 'Quesadillas' },
  { id: 2, nombre: 'Frijol', tamano: null, precio: 15, categoria_id: 3, categoria: 'Quesadillas' },
  { id: 10, nombre: 'Res', tamano: null, precio: 50, categoria_id: 9, categoria: 'Hamburguesas' },
  { id: 47, nombre: 'Papas a la Francesa', tamano: 'Orden completa', precio: 30, categoria_id: 11, categoria: 'Papas a la Francesa' },
];
const usuarios = [
  { id: 'u-cocina', usuario: 'cocina', nombre: 'Cocina', rol: 'cocina', password_hash: '' },
  { id: 'u-tablet', usuario: 'tablet', nombre: 'Tablet', rol: 'tablet', password_hash: '' },
];
const { pool } = await import('../src/db.ts');
let escrituras = 0;
let reversiones = 0;
pool.query = async (sql, valores) => {
  if (sql.includes('FROM usuarios u')) return [usuarios];
  if (sql.startsWith('SELECT id FROM producto')) return [productos.filter((p) => p.id === valores[0])];
  throw new Error(`Consulta no prevista: ${sql}`);
};
pool.getConnection = async () => ({
  async beginTransaction() {},
  async rollback() { reversiones++; },
  release() {},
  async commit() { throw new Error('Un pedido agotado no debe confirmarse'); },
  async execute() { escrituras++; throw new Error('Un pedido agotado no debe guardarse'); },
  async query(sql, valores) {
    if (sql.includes('FROM orden WHERE')) return [[{ idOrden: 100, estatus: 0 }]];
    if (sql.includes('WHERE p.id IN')) return [productos.filter((p) => valores[0].includes(p.id))];
    if (sql.includes('WHERE categoria_id IN')) return [productos];
    if (sql.includes('FROM producto_has_complemento')) return [[]];
    if (sql.includes("c.nombre = 'Papas a la Francesa'")) return [[productos.find((p) => p.id === 47)]];
    throw new Error(`Consulta no prevista: ${sql}`);
  },
});

const { inicializarUsuarios, buscarPorId } = await import('../src/usuarios.ts');
await inicializarUsuarios();
const { emitirToken } = await import('../src/auth.ts');
const { abrirSesionTablet } = await import('../src/sesionesTablet.ts');
const { agotadosRouter, estaAgotado } = await import('../src/agotados.ts');
const { pedidosRouter } = await import('../src/pedidos.ts');
const app = express();
app.use(express.json());
app.use('/api/agotados', agotadosRouter);
app.use('/api', pedidosRouter);
const servidor = app.listen(0, '127.0.0.1');
await once(servidor, 'listening');
const base = `http://127.0.0.1:${servidor.address().port}`;
const token = emitirToken(buscarPorId('u-cocina'));
const tablet = emitirToken(buscarPorId('u-tablet'), abrirSesionTablet('u-tablet'));
const pedir = async (ruta, { method = 'GET', body, sesion = token } = {}) => {
  const res = await fetch(`${base}/api${ruta}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(sesion && { Authorization: `Bearer ${sesion}` }) },
    ...(body && { body: JSON.stringify(body) }),
  });
  return { status: res.status, data: await res.json() };
};
const marcar = (id, agotado = true) => pedir(`/agotados/${id}`, { method: 'PUT', body: { agotado } });

test.after(async () => {
  servidor.closeAllConnections();
  await new Promise((resolve) => servidor.close(resolve));
  await pool.end();
});

test('agotados: permisos, validación, persistencia y recuperación al reiniciar', async () => {
  assert.equal((await pedir('/agotados', { sesion: null })).status, 401);
  assert.equal((await pedir('/agotados', { sesion: tablet })).status, 200);
  assert.equal((await pedir('/agotados/2', { method: 'PUT', sesion: tablet, body: { agotado: true } })).status, 403);
  assert.equal((await pedir('/agotados', { method: 'DELETE', sesion: tablet })).status, 403);
  assert.equal((await pedir('/agotados/2', { method: 'PUT', body: { agotado: 'true' } })).status, 400);
  assert.equal((await marcar(999)).status, 404);
  assert.equal((await marcar(2)).status, 200);
  assert.equal(estaAgotado(2), true);
  const guardado = JSON.parse(readFileSync(path.join(carpeta, 'agotados.json'), 'utf8'));
  assert.equal(guardado[0].idProducto, 2);
  assert.equal(guardado[0].por, 'Cocina');
  const recuperado = await import('../src/agotados.ts?reinicio');
  assert.equal(recuperado.estaAgotado(2), true);
  assert.equal((await marcar(2)).data.agotados.length, 1, 'Repetir no duplica el producto');
  assert.equal((await marcar(2, false)).status, 200);
  assert.deepEqual(JSON.parse(readFileSync(path.join(carpeta, 'agotados.json'), 'utf8')), []);
});

test('agotados: rechaza producto, mezcla, MIXTAS y CON PAPAS antes de guardar el pedido', async () => {
  await marcar(2);
  await marcar(47);
  const casos = [
    { idProducto: 2, cantidad: 1 },
    { idProducto: 1, cantidad: 1, mezcla: ['Papa', 'Frijol'] },
    { idProducto: 1, cantidad: 3, reparto: [{ nombre: 'Papa', cantidad: 1 }, { nombre: 'Frijol', cantidad: 2 }] },
    { idProducto: 10, cantidad: 1, conPapas: true },
  ];
  for (const item of casos) {
    const respuesta = await pedir('/ordenes/100/pedido', { method: 'POST', body: { items: [item] } });
    assert.equal(respuesta.status, 409, JSON.stringify(respuesta.data));
    assert.match(respuesta.data.error, /termin/);
    assert.equal(respuesta.data.agotados.length, 2);
  }
  assert.equal(escrituras, 0);
  assert.equal(reversiones, casos.length);
  assert.equal((await pedir('/agotados', { method: 'DELETE' })).status, 200);
  assert.deepEqual((await pedir('/agotados')).data.agotados, []);
  assert.equal(estaAgotado(47), false);
});
