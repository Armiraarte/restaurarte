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
    if (sql.includes('FROM orden WHERE idOrden = ? FOR UPDATE')) return [[{ ...orden, idOrden: valores[0] }]];
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
      if (sql.startsWith('UPDATE orden_cuenta_dividida SET recibido')) {
        const [recibido, cobrada_por, pagada_en, , numero] = valores;
        const cuenta = cuentas.find((c) => c.numero === numero && !c.pagada_en);
        if (cuenta) Object.assign(cuenta, { recibido, cobrada_por, pagada_en });
        return [{ affectedRows: cuenta ? 1 : 0 }];
      }
      if (sql.startsWith('UPDATE orden SET estatus = 2')) {
        if (orden.estatus === 1) orden.estatus = 2;
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

  // En Cajas cada cuenta se cobra por separado.
  const enviar = async (ruta, cuerpo) => {
    const res = await fetch(`http://127.0.0.1:${servidor.address().port}/api/ordenes/7/${ruta}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(cuerpo ?? {}),
    });
    return { status: res.status, ...await res.json() };
  };
  const poco = await enviar('cuentas-divididas/1/cobrar', { recibido: 40 });
  assert.equal(poco.status, 400);
  assert.match(poco.error, /al menos \$50\.00/);

  const primera = await enviar('cuentas-divididas/1/cobrar', { recibido: 100 });
  assert.equal(primera.status, 200);
  assert.deepEqual(primera.cobro, { numero: 1, personas: 2, total: 50, recibido: 100, cambio: 50, ordenPagada: false });
  assert.equal(orden.estatus, 1, 'Falta la Cuenta 2: la orden sigue en Cajas');
  assert.equal(cuentas[0].cobrada_por, 'Administrador');
  assert.equal(primera.impresion.ok, false, 'Sin impresora el cobro queda hecho y se avisa');

  assert.match((await enviar('cuentas-divididas/1/cobrar', { recibido: 100 })).error, /Cuenta 1 ya se cobró/);
  assert.equal((await enviar('cuentas-divididas/3/cobrar', { recibido: 100 })).status, 404);
  const redividir = await dividir({ modo: 'iguales', personas: 3, total: 100 });
  assert.equal(redividir.status, 409);
  assert.match(redividir.error, /Ya se cobró la Cuenta 1/);
  assert.equal(cuentas.length, 2, 'La división cobrada en parte no se reemplaza');
  assert.match((await enviar('cobrar', { recibido: 100 })).error, /cobra en Cajas las cuentas que faltan/);

  const ultima = await enviar('cuentas-divididas/2/cobrar', { recibido: 50 });
  assert.equal(ultima.status, 200);
  assert.equal(ultima.cobro.ordenPagada, true);
  assert.equal(ultima.cobro.cambio, 0);
  assert.equal(orden.estatus, 2, 'Con todas cobradas la orden queda PAGADO');
  assert.equal(ultima.orden.estatus, 2);

  const reimpresion = await enviar('cuentas-divididas/2/ticket-cobro');
  assert.equal(reimpresion.status, 200);
  assert.equal(reimpresion.impresion.ok, false);
  assert.equal((await enviar('cuentas-divididas/1/ticket-cobro')).status, 200);

  // Reimprimir desde Ventas: un ticket por cuenta con lo que pagó cada quien, no uno solo con toda la orden.
  const tickets = [];
  const fetchReal = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (!String(url).startsWith('http://127.0.0.1:9/')) return fetchReal(url, init);
    tickets.push(JSON.parse(init.body).lineas.map((l) => [l.texto, l.derecha].filter(Boolean).join(' | ')));
    return new Response(JSON.stringify({ ok: true, impresora: 'Caja' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  t.after(() => { globalThis.fetch = fetchReal; });
  const ventas = await enviar('ticket-cobro');
  assert.equal(ventas.status, 200);
  assert.deepEqual(ventas.impresion, { ok: true, impresas: 2 });
  assert.equal(tickets.length, 2, 'Un ticket por cuenta');
  for (const esperado of ['CUENTA 1 DE 2 · PAGADA', '*** REIMPRESIÓN ***', 'Atendió: Caja | Cobró: Administrador', 'TOTAL A PAGAR | $50.00', 'Efectivo | $100.00', 'Cambio | $50.00']) {
    assert.ok(tickets[0].includes(esperado), esperado);
  }
  for (const esperado of ['CUENTA 2 DE 2 · PAGADA', 'TOTAL A PAGAR | $50.00', 'Efectivo | $50.00', 'Cambio | $0.00']) {
    assert.ok(tickets[1].includes(esperado), esperado);
  }
  assert.ok(!tickets.flat().some((l) => /CUENTA DIVIDIDA EN/.test(l)), 'Ya no sale el ticket con toda la orden');
});
