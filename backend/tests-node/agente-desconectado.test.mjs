import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('sin la computadora de las impresoras, el aviso dice cuál es, desde qué hora y qué hacer', async (t) => {
  process.env.PRINT_AGENT_TOKEN = 't'.repeat(40);
  process.env.PRINT_AGENT_URL = 'http://127.0.0.1:9'; // nadie escucha ahí: el respaldo por túnel también falla
  process.env.JWT_SECRET = 'prueba-local-impresoras-clave-de-32-caracteres';
  process.env.DATA_DIR = await mkdtemp(path.join(tmpdir(), 'monitor-')); // el monitor no escribe en data/ real
  delete process.env.MONITOR_REMOTO_URL;
  const { agenteRemotoRouter, agenteDesconectado } = await import('../src/agenteRemoto.ts');
  const { imprimirLineas } = await import('../src/impresion.ts');
  const { eventosRecientes } = await import('../src/monitorImpresion.ts');

  const app = express();
  app.use('/api/agente', agenteRemotoRouter);
  const servidor = app.listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  t.after(() => new Promise((resolve) => servidor.close(resolve)));

  // Nunca se ha conectado ninguna: el aviso de siempre.
  assert.equal(agenteDesconectado(), null);
  await assert.rejects(imprimirLineas([{ texto: 'x' }], 'cocina'), { status: 503, message: /¿Está corriendo en la PC de la impresora\?/ });

  // La laptop se conecta y luego se va.
  const control = new AbortController();
  const res = await fetch(`http://127.0.0.1:${servidor.address().port}/api/agente/conexion`, {
    headers: { 'X-Agent-Token': process.env.PRINT_AGENT_TOKEN, 'X-Agent-Equipo': 'Isidro' },
    signal: control.signal,
  });
  assert.equal(res.status, 200);
  assert.equal(agenteDesconectado(), null, 'Conectada no hay aviso de desconexión');
  control.abort();
  for (let i = 0; i < 100 && !agenteDesconectado(); i++) await new Promise((r) => setTimeout(r, 20));

  assert.equal(agenteDesconectado()?.equipo, 'Isidro');
  await assert.rejects(imprimirLineas([{ texto: 'x' }], 'cocina'), (err) => {
    assert.equal(err.status, 503);
    assert.match(err.message, /«Isidro»/);
    assert.match(err.message, /desconectada desde las \d{1,2}:\d{2}/);
    assert.match(err.message, /Reconectar impresoras/);
    return true;
  });

  // Monitor: quedó anotado el reinicio, la conexión, la desconexión y los tickets que fallaron.
  const tipos = eventosRecientes().map((e) => e.tipo);
  assert.deepEqual(tipos, ['servidor', 'falla', 'conectado', 'desconectado', 'falla']);
  const [conexion, desconexion] = eventosRecientes().filter((e) => e.equipo === 'Isidro');
  assert.equal(conexion.tipo, 'conectado');
  assert.equal(desconexion.tipo, 'desconectado');
  assert.ok(Date.parse(desconexion.hora) >= Date.parse(conexion.hora));
  assert.equal(eventosRecientes().at(-1).destino, 'cocina');
});
