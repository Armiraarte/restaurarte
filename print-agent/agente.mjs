// Agente de impresión: corre en la PC de Windows donde está conectada la impresora.
// Docker no puede ver impresoras USB en Windows, así que el backend le pide a este agente que imprima.
//
//   GET /impresoras -> impresoras y asignaciones de cocina/caja
//   PUT /asignacion -> { destino, impresora } guarda la asignación
//   POST /imprimir -> { lineas: [...], destino: 'cocina' | 'caja' }
//
// Variables: PRINT_AGENT_PORT (9101), IMPRESORA_TICKETS (nombre exacto; si no, se busca una térmica),
// PRINT_AGENT_TOKEN (opcional; si se define, el backend debe mandarlo en el header X-Agent-Token).
import http from 'node:http';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { writeFile, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { AsignacionesImpresoras, esDestino } from './asignaciones.mjs';

const DIR = import.meta.dirname;
let variables = {};
try {
  variables = parseEnv(readFileSync(path.join(DIR, '../.env'), 'utf8'));
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}
const variable = (nombre) => process.env[nombre] ?? variables[nombre] ?? '';
const PUERTO = Number(variable('PRINT_AGENT_PORT')) || 9101;
const TOKEN = variable('PRINT_AGENT_TOKEN');
const asignaciones = new AsignacionesImpresoras(path.join(DIR, 'data/asignaciones.json'), variable('IMPRESORA_TICKETS'));

function powershell(script, args = []) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(DIR, script), ...args],
      { windowsHide: true, timeout: 30_000, encoding: 'utf8' },
      (err, stdout, stderr) => {
        if (err) reject(new Error((stderr || err.message).trim()));
        else resolve(stdout.trim());
      },
    );
  });
}

// Pedirle a Windows la lista de impresoras (impresoras.ps1) tarda de 4 a 25 s. Se guarda y se renueva en
// segundo plano cada minuto: imprimir y el panel de impresoras usan la lista guardada y responden al momento.
const RENOVAR_LISTA_MS = 60_000;
let listaGuardada = null;
let listaEnCurso = null; // consulta en marcha: las peticiones que llegan mientras tanto la comparten

function consultarImpresoras() {
  listaEnCurso ??= powershell('impresoras.ps1')
    .then((salida) => (listaGuardada = JSON.parse(salida)))
    .finally(() => {
      listaEnCurso = null;
    });
  return listaEnCurso;
}

async function listarImpresoras({ actualizar = false } = {}) {
  return asignaciones.estado(!actualizar && listaGuardada ? listaGuardada : await consultarImpresoras());
}

async function imprimir(lineas, destino) {
  let ticket;
  try {
    ticket = asignaciones.elegir(destino, (await listarImpresoras()).impresoras);
  } catch {
    // La lista guardada puede tener hasta un minuto: si la impresora no aparece o no estaba conectada, se revisa de nuevo.
    ticket = asignaciones.elegir(destino, (await listarImpresoras({ actualizar: true })).impresoras);
  }

  const dir = await mkdtemp(path.join(tmpdir(), 'ticket-'));
  const archivo = path.join(dir, 'ticket.json');
  try {
    await writeFile(archivo, JSON.stringify({ impresora: ticket.nombre, anchoMm: 72, lineas }), 'utf8');
    const script = /axiohm|apos/i.test(`${ticket.nombre} ${ticket.driver}`) ? 'imprimir-raw.ps1' : 'imprimir.ps1';
    await powershell(script, ['-Archivo', archivo]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  return ticket;
}

function responder(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function leerJson(req) {
  const partes = [];
  let bytes = 0;
  for await (const parte of req) {
    bytes += parte.length;
    if (bytes > 1_000_000) throw Object.assign(new Error('Ticket demasiado grande.'), { status: 413 });
    partes.push(parte);
  }
  try {
    const datos = JSON.parse(Buffer.concat(partes).toString('utf8') || '{}');
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) throw new Error('Se esperaba un objeto.');
    return datos;
  } catch {
    throw Object.assign(new Error('El cuerpo debe ser JSON válido.'), { status: 400 });
  }
}

const servidor = http.createServer(async (req, res) => {
  try {
    if (TOKEN && req.headers['x-agent-token'] !== TOKEN) return responder(res, 401, { error: 'Token inválido.' });

    if (req.method === 'GET' && req.url === '/impresoras') {
      return responder(res, 200, await listarImpresoras());
    }

    if (req.method === 'PUT' && req.url === '/asignacion') {
      const { destino, impresora } = await leerJson(req);
      if (!esDestino(destino)) return responder(res, 400, { error: 'El destino debe ser cocina o caja.' });
      const { impresoras } = await listarImpresoras();
      return responder(res, 200, await asignaciones.asignar(destino, impresora, impresoras));
    }

    if (req.method === 'POST' && req.url === '/imprimir') {
      const { lineas, destino = 'caja' } = await leerJson(req);
      if (!esDestino(destino)) return responder(res, 400, { error: 'El destino debe ser cocina o caja.' });
      if (!Array.isArray(lineas) || lineas.length === 0) return responder(res, 400, { error: 'El ticket no tiene líneas.' });
      const impresora = await imprimir(lineas, destino);
      console.log(`[agente] Ticket de ${destino} enviado a "${impresora.nombre}"`);
      return responder(res, 200, { ok: true, impresora: impresora.nombre, destino });
    }

    responder(res, 404, { error: 'Ruta no encontrada.' });
  } catch (err) {
    console.error('[agente]', err.message);
    responder(res, err.status || 500, { error: err.message });
  }
});

servidor.listen(PUERTO, () => {
  console.log(`[agente] Agente de impresión escuchando en http://localhost:${PUERTO}`);
});

// Lista de impresoras lista desde el arranque y renovada cada minuto.
const renovarLista = () => consultarImpresoras().catch((err) => console.error('[agente]', err.message));
renovarLista();
setInterval(renovarLista, RENOVAR_LISTA_MS);
