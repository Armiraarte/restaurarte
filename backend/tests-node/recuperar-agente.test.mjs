import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import test from 'node:test';

test('un ticket espera el regreso de Isidro y se envía una sola vez, conservando las asignaciones', { timeout: 10000 }, async (t) => {
  process.env.PRINT_AGENT_TOKEN = 'prueba-local-recuperacion-impresoras';
  process.env.PRINT_AGENT_URL = 'http://127.0.0.1:9';
  process.env.JWT_SECRET = 'prueba-local-recuperacion-impresoras';
  process.env.DATA_DIR = await mkdtemp(path.join(os.tmpdir(), 'impresoras-recuperacion-'));
  const { estadoImpresorasGuardado } = await import('../src/estadoImpresoras.ts');
  const copia = { impresoras: [{ nombre: 'Star', conectada: true, usb: true }], asignaciones: { cocina: 'Star', caja: null } };
  await estadoImpresorasGuardado.registrar('Isidro', copia);
  const { agenteRemotoRouter } = await import('../src/agenteRemoto.ts');
  const { imprimirLineas } = await import('../src/impresion.ts');
  const app = express();
  app.use(express.json());
  app.use('/api/agente', agenteRemotoRouter);
  const servidor = app.listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const control = new AbortController();
  t.after(() => {
    control.abort(); servidor.closeAllConnections();
    return new Promise((resolve) => servidor.close(resolve));
  });
  // Todavía no hay agente; el trabajo espera antes de despacharse.
  const impresion = imprimirLineas([{ texto: 'Pedido de prueba' }], 'cocina');
  const res = await fetch(`${base}/api/agente/conexion`, {
    headers: { 'X-Agent-Token': process.env.PRINT_AGENT_TOKEN, 'X-Agent-Equipo': 'Isidro' }, signal: control.signal,
  });
  let impresiones = 0;
  const leer = (async () => {
    const decoder = new TextDecoder();
    let pendiente = '';
    try {
      for await (const parte of res.body) {
        pendiente += decoder.decode(parte, { stream: true });
        let fin;
        while ((fin = pendiente.indexOf('\n\n')) !== -1) {
          const mensaje = pendiente.slice(0, fin); pendiente = pendiente.slice(fin + 2);
          const datos = mensaje.split('\n').find((l) => l.startsWith('data:'));
          if (!datos) continue;
          const pedido = JSON.parse(datos.slice(5));
          if (pedido.ruta === '/imprimir') impresiones++;
          await fetch(`${base}/api/agente/respuesta/${pedido.id}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Agent-Token': process.env.PRINT_AGENT_TOKEN },
            body: JSON.stringify({ status: 200, data: pedido.ruta === '/impresoras' ? copia : { ok: true, impresora: 'Star' } }),
          });
        }
      }
    } catch (err) { if (!control.signal.aborted) throw err; }
  })();
  assert.equal((await impresion).impresora, 'Star');
  assert.equal(impresiones, 1);
  assert.equal(estadoImpresorasGuardado.sinConexion('Sin comunicación').asignaciones.cocina, 'Star');
  control.abort();
  await leer;
});
