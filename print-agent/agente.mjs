// Agente de impresión: corre en la PC de Windows donde está conectada la impresora.
// Docker no puede ver impresoras USB en Windows, así que el backend le pide a este agente que imprima.
//
//   GET  /impresoras  -> impresoras de Windows y cuál se usa para tickets
//   POST /imprimir    -> { lineas: [...] } imprime un ticket
//
// Variables: PRINT_AGENT_PORT (9101), IMPRESORA_TICKETS (nombre exacto; si no, se busca una térmica),
// PRINT_AGENT_TOKEN (opcional; si se define, el backend debe mandarlo en el header X-Agent-Token).
import http from 'node:http';
import { execFile } from 'node:child_process';
import { writeFile, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PUERTO = Number(process.env.PRINT_AGENT_PORT) || 9101;
const TOKEN = process.env.PRINT_AGENT_TOKEN || '';
const DIR = import.meta.dirname;
// Nombres típicos de impresoras térmicas de tickets.
const PATRON_TERMICA = /tsp|star|epson tm|tm-t|pos|ticket|thermal|termica|xprinter|80mm|58mm/i;

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

async function listarImpresoras() {
  const impresoras = JSON.parse(await powershell('impresoras.ps1'));
  const elegida =
    (process.env.IMPRESORA_TICKETS && impresoras.find((i) => i.nombre === process.env.IMPRESORA_TICKETS)) ||
    impresoras.find((i) => PATRON_TERMICA.test(`${i.nombre} ${i.driver}`)) ||
    null;
  return { impresoras, ticket: elegida };
}

async function imprimir(lineas) {
  const { ticket } = await listarImpresoras();
  if (!ticket) throw Object.assign(new Error('No se detectó ninguna impresora de tickets en Windows.'), { status: 404 });
  if (!ticket.conectada) {
    throw Object.assign(new Error(`La impresora "${ticket.nombre}" está instalada pero no está conectada.`), { status: 409 });
  }

  const dir = await mkdtemp(path.join(tmpdir(), 'ticket-'));
  const archivo = path.join(dir, 'ticket.json');
  try {
    await writeFile(archivo, JSON.stringify({ impresora: ticket.nombre, anchoMm: 72, lineas }), 'utf8');
    await powershell('imprimir.ps1', ['-Archivo', archivo]);
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
  let cuerpo = '';
  for await (const parte of req) {
    cuerpo += parte;
    if (cuerpo.length > 1_000_000) throw Object.assign(new Error('Ticket demasiado grande.'), { status: 413 });
  }
  return JSON.parse(cuerpo || '{}');
}

const servidor = http.createServer(async (req, res) => {
  try {
    if (TOKEN && req.headers['x-agent-token'] !== TOKEN) return responder(res, 401, { error: 'Token inválido.' });

    if (req.method === 'GET' && req.url === '/impresoras') {
      return responder(res, 200, await listarImpresoras());
    }

    if (req.method === 'POST' && req.url === '/imprimir') {
      const { lineas } = await leerJson(req);
      if (!Array.isArray(lineas) || lineas.length === 0) return responder(res, 400, { error: 'El ticket no tiene líneas.' });
      const impresora = await imprimir(lineas);
      console.log(`[agente] Ticket enviado a "${impresora.nombre}"`);
      return responder(res, 200, { ok: true, impresora: impresora.nombre });
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
