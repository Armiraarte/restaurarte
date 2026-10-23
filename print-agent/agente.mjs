// Agente de impresión: corre en la PC de Windows donde está conectada la impresora.
// Docker no puede ver impresoras USB en Windows, así que el backend le pide a este agente que imprima.
//
//   GET /impresoras -> impresoras y asignaciones de cocina/caja
//   PUT /asignacion -> { destino, impresora } guarda la asignación
//   POST /imprimir -> { lineas: [...], destino: 'cocina' | 'caja' }
//   POST /sincronizar -> vuelve a buscar las impresoras y reinicia los procesos de impresión
//
// Variables: PRINT_AGENT_PORT (9101), IMPRESORA_TICKETS (nombre exacto; si no, se busca una térmica),
// PRINT_AGENT_TOKEN (opcional; si se define, el backend debe mandarlo en el header X-Agent-Token).
// SERVIDOR_URL (opcional, p. ej. https://losdiablitos.restaurarte.com.mx): el agente se conecta él mismo al
// servidor con PRINT_AGENT_TOKEN y recibe ahí los tickets (ver conexionServidor.mjs); así no hace falta el túnel.
import http from 'node:http';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { writeFile, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { AsignacionesImpresoras, esDestino } from './asignaciones.mjs';
import { TrabajadorImpresion } from './trabajador.mjs';
import { conectarAlServidor, estadoConexion } from './conexionServidor.mjs';

/** Sin señal del servidor por más de esto (con internet caído o la conexión atorada): reinicio limpio del agente. */
const SIN_SERVIDOR_MS = 3 * 60_000;

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
const SERVIDOR_URL = variable('SERVIDOR_URL').replace(/\/$/, '');
const asignaciones = new AsignacionesImpresoras(path.join(DIR, 'data/asignaciones.json'), variable('IMPRESORA_TICKETS'));

// Un proceso de impresión permanente por impresora (ver trabajador.mjs): cocina y caja imprimen al mismo tiempo.
const trabajadores = {
  cocina: new TrabajadorImpresion('cocina', path.join(DIR, 'servidor-impresion.ps1')),
  caja: new TrabajadorImpresion('caja', path.join(DIR, 'servidor-impresion.ps1')),
};

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

  const raw = /axiohm|apos/i.test(`${ticket.nombre} ${ticket.driver}`);
  const datos = { impresora: ticket.nombre, anchoMm: 72, lineas };
  try {
    // Lo normal: el proceso de impresión de esa impresora, ya preparado (respuesta casi inmediata).
    await trabajadores[destino].imprimir({ modo: raw ? 'raw' : 'driver', ticket: datos });
  } catch (err) {
    if (!err.sinProceso) throw err;
    // El proceso no pudo arrancar: se imprime como antes, con un PowerShell nuevo para este ticket.
    console.error(`[agente] ${err.message} Se usa el método anterior.`);
    await imprimirConScript(raw ? 'imprimir-raw.ps1' : 'imprimir.ps1', datos);
  }
  return ticket;
}

/** Método anterior: un PowerShell nuevo por ticket (más lento; solo si el proceso permanente no arranca). */
async function imprimirConScript(script, datos) {
  const dir = await mkdtemp(path.join(tmpdir(), 'ticket-'));
  const archivo = path.join(dir, 'ticket.json');
  try {
    await writeFile(archivo, JSON.stringify(datos), 'utf8');
    await powershell(script, ['-Archivo', archivo]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const respuesta = (status, data) => ({ status, data });

/** Atiende una petición (del servidor local o de la conexión con el servidor) y devuelve { status, data }. */
async function atender(metodo, ruta, leerCuerpo) {
  try {
    if (metodo === 'GET' && ruta === '/impresoras') {
      return respuesta(200, await listarImpresoras());
    }

    if (metodo === 'PUT' && ruta === '/asignacion') {
      const { destino, impresora } = await leerCuerpo();
      if (!esDestino(destino)) return respuesta(400, { error: 'El destino debe ser cocina o caja.' });
      const { impresoras } = await listarImpresoras();
      return respuesta(200, await asignaciones.asignar(destino, impresora, impresoras));
    }

    // «Sincronizar» (Configuración > Impresoras): vuelve a buscar las impresoras en Windows y reinicia limpio
    // el proceso de impresión de cocina y de caja (sirve si una impresora se desconectó y se volvió a conectar).
    if (metodo === 'POST' && ruta === '/sincronizar') {
      await consultarImpresoras();
      const reinicios = await Promise.allSettled(Object.values(trabajadores).map((t) => t.reiniciar()));
      const fallas = reinicios.filter((r) => r.status === 'rejected').map((r) => r.reason?.message);
      if (fallas.length) console.error('[agente] Sincronizar:', fallas.join(' · '));
      console.log('[agente] Sincronizado: impresoras revisadas y procesos de impresión reiniciados.');
      return respuesta(200, await listarImpresoras());
    }

    if (metodo === 'POST' && ruta === '/imprimir') {
      const { lineas, destino = 'caja' } = await leerCuerpo();
      if (!esDestino(destino)) return respuesta(400, { error: 'El destino debe ser cocina o caja.' });
      if (!Array.isArray(lineas) || lineas.length === 0) return respuesta(400, { error: 'El ticket no tiene líneas.' });
      const impresora = await imprimir(lineas, destino);
      console.log(`[agente] Ticket de ${destino} enviado a "${impresora.nombre}"`);
      return respuesta(200, { ok: true, impresora: impresora.nombre, destino });
    }

    return respuesta(404, { error: 'Ruta no encontrada.' });
  } catch (err) {
    console.error('[agente]', err.message);
    return respuesta(err.status || 500, { error: err.message });
  }
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
  if (TOKEN && req.headers['x-agent-token'] !== TOKEN) return responder(res, 401, { error: 'Token inválido.' });
  const { status, data } = await atender(req.method, req.url, () => leerJson(req));
  responder(res, status, data);
});

// Conectado al servidor por internet, el puerto local solo se abre para esta computadora (sin aviso del firewall).
servidor.listen(PUERTO, SERVIDOR_URL ? '127.0.0.1' : undefined, () => {
  console.log(`[agente] Agente de impresión escuchando en http://localhost:${PUERTO}`);
});

if (SERVIDOR_URL) {
  if (!TOKEN) console.error('[agente] Falta PRINT_AGENT_TOKEN: no se puede conectar al servidor.');
  else {
    conectarAlServidor({
      url: SERVIDOR_URL,
      token: TOKEN,
      equipo: os.hostname(),
      atender: ({ metodo, ruta, cuerpo }) => atender(metodo, ruta, async () => {
        if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) throw Object.assign(new Error('Se esperaba un objeto.'), { status: 400 });
        return cuerpo;
      }),
    });

    // Si lleva 3 minutos sin poder hablar con el servidor, el agente se cierra y agente-siempre.ps1 lo vuelve a
    // abrir limpio a los 3 s (conexiones, DNS y procesos de impresión nuevos). Así no hace falta reiniciar la laptop.
    setInterval(() => {
      if (estadoConexion.reemplazado || Date.now() - estadoConexion.ultimaSenal < SIN_SERVIDOR_MS) return;
      console.error(`[agente] ${SIN_SERVIDOR_MS / 60_000} min sin el servidor: se reinicia el agente.`);
      process.exit(1);
    }, 30_000);
  }
}

// Lista de impresoras lista desde el arranque y renovada cada minuto.
const renovarLista = () => consultarImpresoras().catch((err) => console.error('[agente]', err.message));
renovarLista();
setInterval(renovarLista, RENOVAR_LISTA_MS);

// Los procesos de impresión se preparan desde el arranque: el primer ticket ya no espera a que carguen.
for (const [destino, trabajador] of Object.entries(trabajadores)) {
  trabajador
    .preparar()
    .then(() => console.log(`[agente] Impresión de ${destino} lista.`))
    .catch((err) => console.error('[agente]', err.message));
}
