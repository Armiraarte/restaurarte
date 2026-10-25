// Conexión del agente con el servidor por internet (sin túnel SSH): el agente abre GET /api/agente/conexion y por
// ahí le llegan los pedidos ({ id, ruta, metodo, cuerpo }); cada respuesta se manda a POST /api/agente/respuesta/:id.
// Si la conexión se cae (internet, reinicio del servidor, la laptop se suspendió) se vuelve a conectar sola.

import { setTimeout as dormir } from 'node:timers/promises';

const SIN_SENAL_MS = 45_000; // dos latidos perdidos: se abre una conexión nueva
const ESPERAS_MS = [1_000, 2_000, 3_000, 5_000];
const REEMPLAZADO_MS = 5 * 60_000; // otra computadora tomó la impresión: se vuelve a intentar en 5 min

/**
 * Cómo va la conexión, para que el agente se reinicie solo si lleva mucho sin servidor (ver agente.mjs).
 * ultimaSenal: la última vez que llegó algo del servidor (los latidos cuentan); al arrancar, la hora de arranque.
 */
export const estadoConexion = { conectado: false, ultimaSenal: Date.now(), reemplazado: false };

export async function conectarAlServidor({ url, token, equipo, atender, signal, tiempos = {}, registro = console }) {
  const encabezados = { 'X-Agent-Token': token, 'X-Agent-Equipo': equipo };
  const esperar = (ms) => dormir(ms, undefined, { signal }).catch((err) => { if (!signal?.aborted) throw err; });
  const esperas = tiempos.esperasMs ?? ESPERAS_MS;
  let intentos = 0;
  let reemplazado = false;

  async function responder(id, resultado) {
    for (let intento = 0; intento < 3; intento++) {
      try {
        if (signal?.aborted) return;
        const res = await fetch(`${url}/api/agente/respuesta/${encodeURIComponent(id)}`, {
          method: 'POST',
          headers: { ...encabezados, 'Content-Type': 'application/json' },
          body: JSON.stringify(resultado),
          signal: AbortSignal.any([AbortSignal.timeout(15_000), ...(signal ? [signal] : [])]),
        });
        if (res.ok || res.status === 404) return; // 404: el servidor ya dejó de esperar esa respuesta
      } catch {}
      await esperar(1_000);
    }
    registro.error(`[conexion] No se pudo entregar la respuesta ${id} al servidor.`);
  }

  function procesar(datos) {
    let pedido;
    try {
      pedido = JSON.parse(datos);
    } catch {
      return;
    }
    if (pedido?.reemplazado) {
      reemplazado = true;
      return;
    }
    if (!pedido?.id) return;
    // Un fallo del trabajador tampoco debe detener la conexión ni reenviar el ticket.
    Promise.resolve().then(() => atender(pedido))
      .catch((err) => ({ status: 500, data: { error: err?.message || 'No se pudo atender la petición.' } }))
      .then((resultado) => responder(pedido.id, resultado));
  }

  while (!signal?.aborted) {
    const control = new AbortController();
    let vigilante;
    let revision;
    const detener = () => control.abort();
    signal?.addEventListener('abort', detener, { once: true });
    const limpiar = () => {
      clearTimeout(vigilante);
      clearTimeout(revision);
      signal?.removeEventListener('abort', detener);
      control.abort();
    };
    const reiniciarVigilante = () => {
      clearTimeout(vigilante);
      vigilante = setTimeout(() => control.abort(new Error('Sin señal del servidor.')), tiempos.sinSenalMs ?? SIN_SENAL_MS);
    };
    // Una conexión puede quedar abierta en Windows después de perder internet o salir de suspensión.
    // Una consulta corta e independiente descubre la caída sin esperar el cierre del socket viejo.
    const comprobarConexion = async () => {
      try {
        const res = await fetch(`${url}/api/agente/estado`, {
          headers: { ...encabezados, Connection: 'close' },
          signal: AbortSignal.any([control.signal, AbortSignal.timeout(tiempos.consultaMs ?? 4_000)]),
        });
        if (!res.ok) throw new Error(`El servidor respondió ${res.status}.`);
        const estado = await res.json();
        if (!estado.conectado) throw new Error('El servidor perdió la conexión de impresión.');
        if (estado.agente?.equipo && estado.agente.equipo !== equipo) {
          reemplazado = true;
          throw new Error('Otra computadora está imprimiendo.');
        }
      } catch (err) {
        if (!control.signal.aborted) control.abort(err);
      } finally {
        if (!control.signal.aborted) revision = setTimeout(comprobarConexion, tiempos.revisionMs ?? 5_000);
      }
    };
    try {
      reiniciarVigilante();
      const res = await fetch(`${url}/api/agente/conexion`, {
        headers: { ...encabezados, Accept: 'text/event-stream' },
        signal: control.signal,
      });
      if (res.status === 401) throw new Error('El servidor rechazó el token del agente (PRINT_AGENT_TOKEN).');
      if (!res.ok || !res.body) throw new Error(`El servidor respondió ${res.status}.`);
      registro.log(`[conexion] Conectado a ${url} como "${equipo}".`);
      intentos = 0;
      Object.assign(estadoConexion, { conectado: true, ultimaSenal: Date.now(), reemplazado: false });
      revision = setTimeout(comprobarConexion, tiempos.revisionMs ?? 5_000);

      const decodificador = new TextDecoder();
      let pendiente = '';
      for await (const parte of res.body) {
        reiniciarVigilante();
        estadoConexion.ultimaSenal = Date.now();
        pendiente += decodificador.decode(parte, { stream: true });
        let fin;
        while ((fin = pendiente.indexOf('\n\n')) !== -1) {
          const mensaje = pendiente.slice(0, fin);
          pendiente = pendiente.slice(fin + 2);
          const datos = mensaje
            .split('\n')
            .filter((linea) => linea.startsWith('data:'))
            .map((linea) => linea.slice(5).trimStart())
            .join('\n');
          if (datos) procesar(datos);
        }
      }
      throw new Error('El servidor cerró la conexión.');
    } catch (err) {
      limpiar(); // cancela la consulta y los temporizadores antes de esperar el siguiente intento
      estadoConexion.conectado = false;
      if (signal?.aborted) break;
      if (reemplazado) {
        reemplazado = false;
        registro.error('[conexion] Otra computadora se conectó como agente de impresión. Esperando sin quitarle la conexión.');
        estadoConexion.reemplazado = true; // esperar a propósito no es una falla: no se reinicia el agente
        await esperar(tiempos.reemplazadoMs ?? REEMPLAZADO_MS);
        Object.assign(estadoConexion, { reemplazado: false, ultimaSenal: Date.now() });
        continue;
      }
      const espera = esperas[Math.min(intentos++, esperas.length - 1)];
      registro.error(`[conexion] ${err?.cause?.message || err.message} Reintento en ${espera / 1000} s.`);
      await esperar(espera);
    } finally {
      limpiar();
    }
  }
}
