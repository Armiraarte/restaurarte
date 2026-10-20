// Conexión del agente con el servidor por internet (sin túnel SSH): el agente abre GET /api/agente/conexion y por
// ahí le llegan los pedidos ({ id, ruta, metodo, cuerpo }); cada respuesta se manda a POST /api/agente/respuesta/:id.
// Si la conexión se cae (internet, reinicio del servidor, la laptop se suspendió) se vuelve a conectar sola.

const SIN_SENAL_MS = 60_000; // el servidor manda un latido cada 20 s: un minuto sin nada es una conexión muerta
const ESPERAS_MS = [1_000, 2_000, 5_000, 10_000, 30_000];
const REEMPLAZADO_MS = 5 * 60_000; // otra computadora tomó la impresión: se vuelve a intentar en 5 min

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function conectarAlServidor({ url, token, equipo, atender }) {
  const encabezados = { 'X-Agent-Token': token, 'X-Agent-Equipo': equipo };
  let intentos = 0;
  let reemplazado = false;

  async function responder(id, resultado) {
    for (let intento = 0; intento < 3; intento++) {
      try {
        const res = await fetch(`${url}/api/agente/respuesta/${encodeURIComponent(id)}`, {
          method: 'POST',
          headers: { ...encabezados, 'Content-Type': 'application/json' },
          body: JSON.stringify(resultado),
          signal: AbortSignal.timeout(15_000),
        });
        if (res.ok || res.status === 404) return; // 404: el servidor ya dejó de esperar esa respuesta
      } catch {}
      await esperar(1_000);
    }
    console.error(`[conexion] No se pudo entregar la respuesta ${id} al servidor.`);
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
    atender(pedido).then((resultado) => responder(pedido.id, resultado));
  }

  while (true) {
    const control = new AbortController();
    let vigilante;
    const reiniciarVigilante = () => {
      clearTimeout(vigilante);
      vigilante = setTimeout(() => control.abort(new Error('Sin señal del servidor.')), SIN_SENAL_MS);
    };
    try {
      reiniciarVigilante();
      const res = await fetch(`${url}/api/agente/conexion`, {
        headers: { ...encabezados, Accept: 'text/event-stream' },
        signal: control.signal,
      });
      if (res.status === 401) throw new Error('El servidor rechazó el token del agente (PRINT_AGENT_TOKEN).');
      if (!res.ok || !res.body) throw new Error(`El servidor respondió ${res.status}.`);
      console.log(`[conexion] Conectado a ${url} como "${equipo}".`);
      intentos = 0;

      const decodificador = new TextDecoder();
      let pendiente = '';
      for await (const parte of res.body) {
        reiniciarVigilante();
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
      if (reemplazado) {
        reemplazado = false;
        console.error('[conexion] Otra computadora se conectó como agente de impresión. Reintento en 5 min.');
        await esperar(REEMPLAZADO_MS);
        continue;
      }
      const espera = ESPERAS_MS[Math.min(intentos++, ESPERAS_MS.length - 1)];
      console.error(`[conexion] ${err?.cause?.message || err.message} Reintento en ${espera / 1000} s.`);
      await esperar(espera);
    } finally {
      clearTimeout(vigilante);
      control.abort();
    }
  }
}
