import assert from 'node:assert/strict';
import http from 'node:http';
import { once, EventEmitter } from 'node:events';
import test from 'node:test';
import { conectarAlServidor, estadoConexion } from '../conexionServidor.mjs';

async function escenario(t, opciones = {}) {
  const eventos = new EventEmitter();
  let conexiones = 0, stream, consultas = 0;
  const respuestas = [];
  let estado = () => ({ conectado: true, agente: { equipo: 'Isidro' } });
  const servidor = http.createServer(async (req, res) => {
    if (req.url === '/api/agente/conexion') {
      stream = res; conexiones++;
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write('retry: 3000\n\n');
      eventos.emit('conexion');
    } else if (req.url === '/api/agente/estado') {
      consultas++;
      const datos = estado();
      if (datos === null) return; // red colgada: la consulta debe vencer sola
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(datos));
    } else {
      let cuerpo = '';
      for await (const parte of req) cuerpo += parte;
      respuestas.push(JSON.parse(cuerpo));
      res.end('{}');
      eventos.emit('respuesta');
    }
  });
  servidor.listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  const control = new AbortController();
  const errores = [];
  const primera = once(eventos, 'conexion');
  const tarea = conectarAlServidor({
    url: `http://127.0.0.1:${servidor.address().port}`, token: 'prueba', equipo: 'Isidro',
    atender: opciones.atender ?? (async () => ({ status: 200, data: {} })), signal: control.signal,
    tiempos: { revisionMs: 25, consultaMs: 50, sinSenalMs: 2000, esperasMs: [10, 20], reemplazadoMs: 10000 },
    registro: { log() {}, error(m) { errores.push(m); eventos.emit('errorRegistrado'); } },
  });
  t.after(async () => {
    control.abort(); await tarea;
    servidor.closeAllConnections();
    await new Promise((resolve) => servidor.close(resolve));
  });
  await primera;
  return { eventos, control, tarea, respuestas, errores,
    get stream() { return stream; }, get conexiones() { return conexiones; }, get consultas() { return consultas; },
    estado(fn) { estado = fn; },
  };
}

test('se reconecta después del cierre del servidor y cada petición de impresión se atiende una sola vez', { timeout: 5000 }, async (t) => {
  let impresiones = 0;
  const e = await escenario(t, { atender: async () => { impresiones++; return { status: 200, data: { ok: true } }; } });
  const recibida = once(e.eventos, 'respuesta');
  e.stream.write('data: {"id":"ticket-1","ruta":"/imprimir","metodo":"POST","cuerpo":{}}\n\n');
  await recibida;
  const reconectada = once(e.eventos, 'conexion');
  e.stream.end();
  await reconectada;
  assert.equal(e.conexiones, 2);
  assert.equal(impresiones, 1);
  assert.equal(e.respuestas.length, 1);
});

test('descubre una conexión vieja abierta cuando el servidor ya no reconoce al agente', { timeout: 5000 }, async (t) => {
  const e = await escenario(t);
  const reconectada = once(e.eventos, 'conexion');
  e.estado(() => e.conexiones === 1 ? { conectado: false, agente: null } : { conectado: true, agente: { equipo: 'Isidro' } });
  await reconectada;
  assert.equal(e.conexiones, 2);
  assert.ok(e.consultas >= 1);
});

test('una consulta de salud colgada vence y abre una conexión nueva', { timeout: 5000 }, async (t) => {
  const e = await escenario(t);
  const reconectada = once(e.eventos, 'conexion');
  e.estado(() => e.conexiones === 1 ? null : { conectado: true, agente: { equipo: 'Isidro' } });
  await reconectada;
  assert.equal(e.conexiones, 2);
});

test('respeta a otra computadora que tomó la impresión y permite detener la espera', { timeout: 5000 }, async (t) => {
  const e = await escenario(t);
  const aviso = once(e.eventos, 'errorRegistrado');
  e.stream.end('data: {"reemplazado":true}\n\n');
  await aviso;
  assert.equal(estadoConexion.reemplazado, true);
  e.control.abort();
  await e.tarea;
  assert.equal(e.conexiones, 1);
  assert.equal(estadoConexion.conectado, false);
});
