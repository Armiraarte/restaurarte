import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import test from 'node:test';

test('envía cobros a caja y pedidos a cocina sin cambiar el contenido del ticket', async (t) => {
  const recibidos = [];
  let fallo = false;
  const agente = http.createServer(async (req, res) => {
    const partes = [];
    for await (const parte of req) partes.push(parte);
    const body = JSON.parse(Buffer.concat(partes).toString('utf8'));
    recibidos.push({ ruta: req.url, ...body });
    res.writeHead(fallo ? 409 : 200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(fallo ? { error: 'Impresora de cocina desconectada.' } : { ok: true, destino: body.destino }));
  });
  agente.listen(0, '127.0.0.1');
  await once(agente, 'listening');
  t.after(() => new Promise((resolve) => agente.close(resolve)));
  process.env.PRINT_AGENT_URL = `http://127.0.0.1:${agente.address().port}`;
  process.env.JWT_SECRET = 'prueba-local-impresoras-clave-de-32-caracteres';
  const { imprimirLineas } = await import('../src/impresion.ts');
  const lineas = [{ texto: 'Quesadilla con piña y café', derecha: '$80.00' }];
  await imprimirLineas(lineas);
  await imprimirLineas(lineas, 'cocina');
  await imprimirLineas(lineas, 'caja');
  assert.deepEqual(recibidos.map(({ destino }) => destino), ['caja', 'cocina', 'caja']);
  assert.ok(recibidos.every((pedido) => pedido.ruta === '/imprimir'));
  assert.ok(recibidos.every((pedido) => JSON.stringify(pedido.lineas) === JSON.stringify(lineas)));
  fallo = true;
  await assert.rejects(imprimirLineas(lineas, 'cocina'), { status: 409, message: 'Impresora de cocina desconectada.' });
});
