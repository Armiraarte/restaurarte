import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import test from 'node:test';

// Base simulada: nunca toca la base real. La impresora no existe, así que imprimir falla y se avisa.
test('dividir la cuenta guarda Cuenta 1…N, la manda a Cajas (PAGANDO) y devuelve la orden actualizada', async (t) => {
  process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'dividir-cuenta-'));
  process.env.DB_HOST = '127.0.0.1';
  process.env.ADMIN_PASSWORD = 'prueba-local-dividir';
  process.env.JWT_SECRET = 'prueba-local-dividir-cuenta-clave-temporal';
  process.env.PRINT_AGENT_URL = 'http://127.0.0.1:9';
  const { pool } = await import('../src/db.ts');
  const orden = { idOrden: 7, nombre: '5', total: '100.00', tipo_orden: 1, estatus: 0, origen: 'mesa', idSesion_tablet: null };
  let cuentas = [];
  const consulta = async (sql, valores = []) => {
    if (sql.includes('FROM usuarios u') || sql.includes('GREATEST(t.fecha_inicio')) return [[]];
    if (sql.includes('FROM turnos')) return [[{ idTurno: 1, fecha_inicio: new Date() }]];
    if (sql.startsWith('SHOW COLUMNS')) return [[{ Field: 'origen' }]];
    if (sql.includes('information_schema.tables')) return [[{ 1: 1 }]];
    if (sql.includes('FROM orden o')) return [[{ ...orden }]];
    if (sql.includes('FROM orden_has_detalle d')) {
      return [[{ idDetalle_Orden: 1, idProducto: 3, categoria: 'Tacos', nombre: 'Pollo', tamano: null, cantidad: 5, sin_queso: 0, con_queso: 0,
        carne_extra: 0, mix_grupo: null, opciones: null, termino_id: null, termino: null, subtotal: '100.00', creado_en: new Date() }]];
    }
    if (sql.includes('FROM orden_extra')) return [[]];
    if (sql.includes('FROM orden_cuenta_dividida')) return [cuentas];
    if (sql.includes('FROM orden WHERE idOrden = ? FOR UPDATE')) return [[{ idOrden: valores[0] }]];
    throw new Error(`Consulta sin simular: ${sql}`);
  };
  pool.query = consulta;
  pool.getConnection = async () => ({
    query: consulta, async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
    async execute(sql, valores) {
      if (sql.startsWith('DELETE FROM orden_cuenta_dividida')) { cuentas = []; return [{}]; }
      if (sql.includes('INSERT INTO orden_cuenta_dividida')) {
        const [, numero, personas, modo, importe, total_orden, contenido, creado_por, creado_en] = valores;
        cuentas.push({ numero, personas, modo, importe, total_orden, contenido, creado_por, creado_en });
        return [{}];
      }
      if (sql.startsWith('UPDATE orden SET estatus = 1')) {
        if (orden.estatus === 0) orden.estatus = 1;
        return [{ affectedRows: 1 }];
      }
      throw new Error(`Escritura sin simular: ${sql}`);
    },
  });
  const { inicializarUsuarios, buscarPorId } = await import('../src/usuarios.ts');
  await inicializarUsuarios();
  const { emitirToken } = await import('../src/auth.ts');
  const token = emitirToken(buscarPorId('u-admin'));
  const { pedidosRouter } = await import('../src/pedidos.ts');
  const app = express(); app.use(express.json()); app.use('/api', pedidosRouter);
  const servidor = app.listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  t.after(async () => { servidor.closeAllConnections(); await new Promise((r) => servidor.close(r)); await pool.end(); });
  const dividir = async (cuerpo) => {
    const res = await fetch(`http://127.0.0.1:${servidor.address().port}/api/ordenes/7/dividir`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(cuerpo),
    });
    return { status: res.status, ...await res.json() };
  };

  // La pantalla vio otro total: no se guarda ni se manda a Cajas.
  const vieja = await dividir({ modo: 'iguales', personas: 3, total: 90 });
  assert.equal(vieja.status, 409);
  assert.match(vieja.error, /cambió/);
  assert.equal(orden.estatus, 0);
  assert.equal(cuentas.length, 0);

  const r = await dividir({ modo: 'iguales', personas: 3, total: 100 });
  assert.equal(r.status, 201);
  assert.equal(orden.estatus, 1, 'La orden pasa a PAGANDO: aparece en Cajas');
  assert.equal(r.orden.estatus, 1, 'La pantalla recibe la orden ya en Cajas');
  assert.deepEqual(r.cuentas.map((c) => [c.numero, c.importe]), [[1, 33.34], [2, 33.33], [3, 33.33]]);
  assert.equal(r.cuentas_divididas.length, 3);
  assert.equal(r.impresion.ok, false, 'Sin impresora: las cuentas quedan guardadas y se avisa');

  // Volver a dividir (ya en Cajas) reemplaza las cuentas y la orden sigue por cobrar.
  const otra = await dividir({ modo: 'iguales', personas: 2, total: 100 });
  assert.equal(otra.status, 201);
  assert.equal(cuentas.length, 2);
  assert.equal(orden.estatus, 1);
});
