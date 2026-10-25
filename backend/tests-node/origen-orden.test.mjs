import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import test from 'node:test';

test('registrar una llamada no la mezcla con un pedido por nombre del mismo cliente', async (t) => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'origen-orden-'));
  process.env.DB_HOST = '127.0.0.1';
  process.env.ADMIN_PASSWORD = 'prueba-local-origen';
  process.env.JWT_SECRET = 'prueba-local-origen-orden-clave-temporal';
  const { pool } = await import('../src/db.ts');
  const ordenes = [];
  const consulta = async (sql, valores = []) => {
    if (sql.includes('FROM usuarios u') || sql.includes('GREATEST(t.fecha_inicio')) return [[]];
    if (sql.includes('FROM turnos')) return [[{ idTurno: 1, fecha_inicio: new Date() }]];
    if (sql.startsWith('SHOW COLUMNS')) return [[{ Field: 'origen' }]];
    if (sql.includes('COALESCE(MAX(CAST')) return [[{ ultimo: ordenes.length }]];
    if (sql.includes('AND nombre = ?')) return [ordenes.filter((o) => o.nombre === valores[1] && (!valores[2] || o.origen === valores[2]))];
    if (sql.includes('WHERE idOrden = ?')) return [ordenes.filter((o) => o.id === valores[0])];
    throw new Error(`Consulta sin simular: ${sql}`);
  };
  pool.query = consulta;
  pool.getConnection = async () => ({
    query: consulta, async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
    async execute(sql, valores) {
      if (sql.startsWith('INSERT INTO orden')) {
        const id = ordenes.length + 1;
        ordenes.push({ id, codigo: valores[0], nombre: valores[1], tipo_venta_id: valores[2], estatus: 0 });
        return [{ insertId: id }];
      }
      if (sql.startsWith('UPDATE orden SET origen')) {
        ordenes.find((o) => o.id === valores[1]).origen = valores[0];
        return [{ affectedRows: 1 }];
      }
      throw new Error(`Escritura sin simular: ${sql}`);
    },
  });
  const { inicializarUsuarios, buscarPorId } = await import('../src/usuarios.ts');
  await inicializarUsuarios();
  const { emitirToken } = await import('../src/auth.ts');
  const token = emitirToken(buscarPorId('u-admin'));
  const { mesasRouter } = await import('../src/mesas.ts');
  const app = express(); app.use(express.json()); app.use('/api/mesas', mesasRouter);
  const servidor = app.listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  t.after(async () => { servidor.closeAllConnections(); await new Promise((r) => servidor.close(r)); await pool.end(); });
  const registrar = async (origen, paraLlevar) => {
    const res = await fetch(`http://127.0.0.1:${servidor.address().port}/api/mesas`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ nombre: 'Ana', tipo_venta_id: paraLlevar ? 2 : 1, origen }),
    });
    return { status: res.status, ...await res.json() };
  };
  const nombre = await registrar('nombre', true);
  const llamada = await registrar('llamada', false);
  assert.equal(nombre.status, 201);
  assert.equal(llamada.status, 201);
  assert.notEqual(nombre.mesa.id, llamada.mesa.id);
  assert.equal(nombre.mesa.origen, 'nombre');
  assert.equal(llamada.mesa.origen, 'llamada');
  const repetida = await registrar('llamada', false);
  assert.equal(repetida.status, 200);
  assert.equal(repetida.mesa.id, llamada.mesa.id);
  assert.equal((await registrar('invalido', false)).status, 400);
});
