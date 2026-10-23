// Agente de impresión conectado por internet, sin túnel SSH: la computadora que tiene las impresoras abre una
// conexión hacia el servidor (como los avisos en vivo) y por ahí recibe los tickets. Así una laptop nueva queda
// lista con solo correr el instalador (Configuración > Impresoras > Descargar instalador).
//
//   GET  /api/agente/conexion        el agente se conecta (header X-Agent-Token = PRINT_AGENT_TOKEN). Llegan
//                                     mensajes `data: {"id","ruta","metodo","cuerpo"}` con lo que debe hacer.
//   POST /api/agente/respuesta/:id    el agente contesta { status, data }.
//   GET  /api/agente/estado           (con el token) si hay un agente conectado y de qué computadora.
//
// Si hay un agente conectado así, impresion.ts le manda todo a él; si no, usa el túnel de antes (PRINT_AGENT_URL).
// Solo puede haber uno: si se conecta otro, reemplaza al anterior.
import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { config } from './config.js';
import { anotarEvento } from './monitorImpresion.js';

interface Pendiente {
  resolve: (r: { status: number; data: unknown }) => void;
  reject: (err: Error) => void;
  tiempo: ReturnType<typeof setTimeout>;
}

let agente: { res: Response; equipo: string; desde: number; pendientes: Set<string> } | null = null;
const pendientes = new Map<string, Pendiente>();
/** La última computadora que se desconectó y cuándo: para decir en el panel cuál revisar y desde qué hora. */
let ultimaDesconexion: { equipo: string; hora: number } | null = null;

/** Computadora de las impresoras que está desconectada (y desde cuándo), o null si hay una conectada o nunca hubo. */
export const agenteDesconectado = () => (agente ? null : ultimaDesconexion);

function tokenValido(req: Request): boolean {
  const esperado = config.printAgent.token;
  const recibido = req.headers['x-agent-token'];
  if (!esperado || typeof recibido !== 'string' || recibido.length !== esperado.length) return false;
  return crypto.timingSafeEqual(Buffer.from(recibido), Buffer.from(esperado));
}

/** Computadora del agente conectado por internet, o null si no hay. */
export const agenteRemoto = () => (agente ? { equipo: agente.equipo, desde: new Date(agente.desde).toISOString() } : null);

/** Le pide algo al agente conectado (las mismas rutas que su servidor local: /impresoras, /imprimir…). */
export function pedirAlAgenteRemoto(ruta: string, metodo: string, cuerpo: unknown, tiempoMs = 35_000): Promise<{ status: number; data: any }> {
  const conectado = agente;
  if (!conectado) return Promise.reject(Object.assign(new Error('No hay agente de impresión conectado.'), { status: 503 }));
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const tiempo = setTimeout(() => {
      pendientes.delete(id);
      conectado.pendientes.delete(id);
      reject(Object.assign(new Error('El agente de impresión no respondió a tiempo.'), { status: 504 }));
    }, tiempoMs);
    pendientes.set(id, { resolve, reject, tiempo });
    conectado.pendientes.add(id);
    conectado.res.write(`data: ${JSON.stringify({ id, ruta, metodo, cuerpo })}\n\n`);
  });
}

export const agenteRemotoRouter = Router();

agenteRemotoRouter.get('/conexion', (req, res) => {
  if (!tokenValido(req)) {
    res.status(401).json({ error: 'Token del agente inválido.' });
    return;
  }
  const equipo = String(req.headers['x-agent-equipo'] ?? 'agente').slice(0, 80);
  // Otro agente se conectó: reemplaza al anterior, que espera un rato antes de volver a intentar (si no, los dos
  // se estarían quitando el lugar cada segundo).
  agente?.res.end(`data: ${JSON.stringify({ reemplazado: true })}

`);
  const conexion = { res, equipo, desde: Date.now(), pendientes: new Set<string>() };
  agente = conexion;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // nginx no debe juntar los mensajes
  });
  res.write('retry: 3000\n\n');
  // Latido para que nginx y la red no cierren la conexión por inactividad.
  const latido = setInterval(() => res.write(': latido\n\n'), 20_000);
  console.log(`[agente-remoto] Conectado: ${equipo}`);
  anotarEvento({ tipo: 'conectado', equipo, hora: conexion.desde });
  req.on('close', () => {
    clearInterval(latido);
    if (agente === conexion) {
      agente = null;
      ultimaDesconexion = { equipo, hora: Date.now() };
      console.log(`[agente-remoto] Desconectado: ${equipo}`);
      anotarEvento({ tipo: 'desconectado', equipo });
    }
    // Lo que esperaba respuesta de este agente ya no la va a tener.
    for (const id of conexion.pendientes) {
      const pendiente = pendientes.get(id);
      if (!pendiente) continue;
      pendientes.delete(id);
      clearTimeout(pendiente.tiempo);
      pendiente.reject(Object.assign(new Error('Se perdió la conexión con la computadora de las impresoras.'), { status: 503 }));
    }
  });
});

agenteRemotoRouter.post('/respuesta/:id', (req, res) => {
  if (!tokenValido(req)) {
    res.status(401).json({ error: 'Token del agente inválido.' });
    return;
  }
  const pendiente = pendientes.get(req.params.id);
  if (!pendiente) {
    res.status(404).json({ error: 'Esa petición ya no está pendiente.' });
    return;
  }
  pendientes.delete(req.params.id);
  agente?.pendientes.delete(req.params.id);
  clearTimeout(pendiente.tiempo);
  const status = Number(req.body?.status) || 500;
  pendiente.resolve({ status, data: req.body?.data ?? {} });
  res.json({ ok: true });
});

agenteRemotoRouter.get('/estado', (req, res) => {
  if (!tokenValido(req)) {
    res.status(401).json({ error: 'Token del agente inválido.' });
    return;
  }
  res.json({ conectado: !!agente, agente: agenteRemoto() });
});
