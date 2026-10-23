// Monitor de la computadora de las impresoras (la laptop del restaurante, p. ej. «Isidro»): cuándo se conecta y se
// desconecta, y cada impresión (bien o con falla), para ver qué pasa sin ir a la laptop. Solo lo ven los usuarios
// de MONITOR_USUARIOS (por defecto zeerickz).
//
//   GET /api/monitor/impresion  →  { ahora, fuente, revision, eventos }   (los últimos 7 días)
//
// En el servidor, agenteRemoto.ts e impresion.ts anotan cada cosa al momento. En la PC de desarrollo la laptop no
// se conecta aquí sino a producción: con MONITOR_REMOTO_URL y MONITOR_REMOTO_TOKEN se consulta cada 15 s su estado
// allá (/api/agente/estado) y se anotan los cambios; lo que pase con el agente local de esa PC no se anota.
// Los eventos se guardan en data/monitor-impresion.json para que no se pierdan al reiniciar.
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { config } from './config.js';
import { requireAuth } from './auth.js';

export type TipoEvento = 'conectado' | 'desconectado' | 'impresion' | 'falla' | 'servidor';

export interface EventoMonitor {
  tipo: TipoEvento;
  hora: string; // ISO 8601
  equipo?: string | null;
  destino?: string;
  ms?: number;
  detalle?: string;
}

const MAX_EVENTOS = 3000;
const VENTANA_MS = 7 * 24 * 60 * 60_000;
const REVISION_REMOTA_MS = 15_000;
const ARCHIVO = path.join(config.dataDir, 'monitor-impresion.json');
const remotoActivo = Boolean(config.monitor.remotoUrl && config.monitor.remotoToken);

let eventos: EventoMonitor[] = (() => {
  try {
    const datos = JSON.parse(readFileSync(ARCHIVO, 'utf8'));
    return Array.isArray(datos) ? datos.slice(-MAX_EVENTOS) : [];
  } catch {
    return [];
  }
})();

let guardado: ReturnType<typeof setTimeout> | null = null;
function guardarPronto() {
  if (guardado) return;
  guardado = setTimeout(async () => {
    guardado = null;
    try {
      await mkdir(path.dirname(ARCHIVO), { recursive: true });
      await writeFile(ARCHIVO, JSON.stringify(eventos));
    } catch (err) {
      console.error('[monitor] No se pudo guardar el historial:', (err as Error).message);
    }
  }, 2_000);
  guardado.unref();
}

/**
 * Anota algo que pasó. `local`: lo vio este servidor (agente conectado aquí, impresiones de aquí). Con el monitor
 * remoto activo (PC de desarrollo) eso no es la laptop del restaurante y no se anota.
 */
export function anotarEvento(evento: Omit<EventoMonitor, 'hora'> & { hora?: Date | string | number }, { local = true } = {}) {
  if (local && remotoActivo) return;
  eventos.push({ ...evento, hora: new Date(evento.hora ?? Date.now()).toISOString() });
  if (eventos.length > MAX_EVENTOS) eventos = eventos.slice(-MAX_EVENTOS);
  guardarPronto();
}

/** Lo anotado en los últimos 7 días, del más viejo al más nuevo. */
export const eventosRecientes = () => {
  const desde = Date.now() - VENTANA_MS;
  return eventos.filter((e) => Date.parse(e.hora) >= desde);
};

/** Último evento de conexión (conectado / desconectado / servidor reiniciado). */
const ultimoDeConexion = () => [...eventos].reverse().find((e) => e.tipo === 'conectado' || e.tipo === 'desconectado' || e.tipo === 'servidor');

// ---------- Monitor remoto (PC de desarrollo): estado de la laptop en producción ----------

const revision: { hora: string | null; error: string | null } = { hora: null, error: null };

async function revisarRemoto() {
  try {
    const res = await fetch(`${config.monitor.remotoUrl}/api/agente/estado`, {
      headers: { 'X-Agent-Token': config.monitor.remotoToken },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(res.status === 401 ? 'Producción rechazó el token del monitor.' : `Producción respondió ${res.status}.`);
    const datos = (await res.json()) as { conectado?: boolean; agente?: { equipo?: string; desde?: string } | null };
    const ultimo = ultimoDeConexion();
    const estaba = ultimo?.tipo === 'conectado';
    if (datos.conectado && datos.agente) {
      const { equipo = null, desde } = datos.agente;
      // Otra conexión distinta a la anotada: se cayó y volvió entre dos revisiones (o es la primera vez que se ve).
      const mismaConexion = estaba && ultimo?.equipo === equipo && desde && Math.abs(Date.parse(ultimo.hora) - Date.parse(desde)) < 1_000;
      if (!mismaConexion) {
        if (estaba) anotarEvento({ tipo: 'desconectado', equipo: ultimo?.equipo, hora: desde, detalle: 'Se cayó y volvió entre dos revisiones.' }, { local: false });
        anotarEvento({ tipo: 'conectado', equipo, hora: desde }, { local: false });
      }
    } else if (estaba) {
      anotarEvento({ tipo: 'desconectado', equipo: ultimo?.equipo }, { local: false });
    }
    revision.error = null;
  } catch (err) {
    revision.error = (err as Error).message;
  } finally {
    revision.hora = new Date().toISOString();
  }
}

if (remotoActivo) {
  revisarRemoto();
  setInterval(revisarRemoto, REVISION_REMOTA_MS).unref();
} else {
  // Al reiniciar, este servidor ya no tiene a la laptop conectada hasta que vuelva (lo hace sola en segundos).
  anotarEvento({ tipo: 'servidor', detalle: 'El servidor se reinició.' });
}

// ---------- Ruta ----------

export const monitorRouter = Router();
monitorRouter.use(requireAuth);

monitorRouter.get('/impresion', (req, res) => {
  if (!config.monitor.usuarios.includes(req.usuario!.usuario.toLowerCase())) {
    res.status(403).json({ error: 'Este monitor solo lo puede ver el usuario autorizado.' });
    return;
  }
  res.json({
    ahora: new Date().toISOString(),
    // 'produccion': la PC de desarrollo vigila la laptop en producción; 'este-servidor': la laptop se conecta aquí.
    fuente: remotoActivo ? 'produccion' : 'este-servidor',
    revision: remotoActivo ? revision : null,
    eventos: eventosRecientes(),
  });
});
