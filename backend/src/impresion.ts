import { existsSync } from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { config } from './config.js';
import { requireAuth } from './auth.js';
import { lineasTicketCocina, validarTicketCocina, type TicketCocina } from './ticketCocina.js';
import { encabezadoRestaurante } from './ticketMarca.js';
import { agenteDesconectado, agenteRemoto, esperarAgenteRemoto, pedirAlAgenteRemoto } from './agenteRemoto.js';
import { anotarEvento } from './monitorImpresion.js';
import { estadoImpresorasGuardado } from './estadoImpresoras.js';

// La impresora está conectada por USB a la PC de Windows; el backend (en Docker) no la ve,
// así que reenvía todo al agente de impresión que corre en esa PC (carpeta print-agent/).

export interface LineaTicket {
  imagen?: 'logo-completo';
  anchoMm?: number;
  texto?: string;
  derecha?: string;
  alinear?: 'izquierda' | 'centro' | 'derecha';
  negrita?: boolean;
  grande?: boolean;
  pequeno?: boolean;
  escala?: number; // multiplica el tamaño de la letra (1.5 = 50% más grande)
  separador?: boolean;
}

async function llamarAgente(ruta: string, init?: RequestInit) {
  const usaAgenteRemoto = !!(agenteDesconectado() || estadoImpresorasGuardado.equipo());
  if (!agenteRemoto() && usaAgenteRemoto && init?.method && init.method !== 'GET') await esperarAgenteRemoto();
  // Agente conectado por internet (la computadora con las impresoras, instalada con el instalador): va primero.
  if (agenteRemoto()) {
    const { status, data } = await pedirAlAgenteRemoto(ruta, init?.method ?? 'GET', init?.body ? JSON.parse(String(init.body)) : undefined);
    if (status >= 400) throw Object.assign(new Error(data?.error || 'Error del agente de impresión.'), { status });
    return data;
  }
  // Si ya se usaba la laptop por internet, no esperar 35 s ni cambiar al túnel de otra computadora.
  if (usaAgenteRemoto) throw Object.assign(new Error(mensajeSinAgente()), { status: 503 });
  // Si no, el agente de la PC por el túnel SSH (PRINT_AGENT_URL).
  let res: Response;
  try {
    res = await fetch(`${config.printAgent.url}${ruta}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(config.printAgent.token ? { 'X-Agent-Token': config.printAgent.token } : {}),
      },
      signal: AbortSignal.timeout(35_000),
    });
  } catch {
    throw Object.assign(new Error(mensajeSinAgente()), { status: 503 });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Error del agente de impresión.'), { status: res.status });
  return data;
}

/**
 * Sin computadora de impresoras: dice cuál se desconectó y desde qué hora, y qué hacer (ícono «Reconectar impresoras»
 * que deja el instalador en su escritorio). Si nunca se conectó ninguna, el aviso de antes (túnel desde la PC).
 */
function mensajeSinAgente(): string {
  const ultima = agenteDesconectado();
  if (!ultima) {
    const equipo = estadoImpresorasGuardado.equipo();
    return equipo
      ? `La computadora de las impresoras («${equipo}») no está conectada. Abre «Reconectar impresoras» en su escritorio. Las asignaciones están conservadas.`
      : 'No se pudo conectar con el agente de impresión. ¿Está corriendo en la PC de la impresora?';
  }
  const fecha = new Date(ultima.hora);
  const zona = { timeZone: 'America/Mexico_City' } as const;
  const hoy = fecha.toLocaleDateString('es-MX', zona) === new Date().toLocaleDateString('es-MX', zona);
  const hora = fecha.toLocaleTimeString('es-MX', { ...zona, hour: 'numeric', minute: '2-digit' });
  const cuando = hoy ? `las ${hora}` : `el ${fecha.toLocaleDateString('es-MX', { ...zona, day: 'numeric', month: 'long' })} a las ${hora}`;
  return `La computadora de las impresoras («${ultima.equipo}») está desconectada desde ${cuando}. ` +
    'Revisa que esté encendida y sin suspender, y toca «Reconectar impresoras» en su escritorio.';
}

/** Manda líneas ya armadas a la impresora (por el agente de impresión). */
export type DestinoImpresion = 'cocina' | 'caja';
const esDestino = (destino: unknown): destino is DestinoImpresion => destino === 'cocina' || destino === 'caja';

export async function imprimirLineas(lineas: LineaTicket[], destino: DestinoImpresion = 'caja') {
  const inicio = Date.now();
  // Monitor de impresión: cada ticket queda anotado con su resultado y lo que tardó.
  try {
    const data = await llamarAgente('/imprimir', { method: 'POST', body: JSON.stringify({ lineas, destino }) });
    anotarEvento({ tipo: 'impresion', destino, ms: Date.now() - inicio, equipo: agenteRemoto()?.equipo ?? null, detalle: data?.impresora });
    return data;
  } catch (err) {
    anotarEvento({ tipo: 'falla', destino, ms: Date.now() - inicio, equipo: agenteRemoto()?.equipo ?? null, detalle: (err as Error).message });
    throw err;
  }
}

function ticketDePrueba(usuario: string, destino: DestinoImpresion): LineaTicket[] {
  const fecha = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
  return [
    ...encabezadoRestaurante(),
    { texto: 'PRUEBA DE IMPRESIÓN', alinear: 'centro', negrita: true },
    { texto: destino === 'cocina' ? 'COCINA' : 'CAJA', alinear: 'centro', negrita: true },
    { separador: true },
    { texto: 'Fecha:', derecha: fecha },
    { texto: 'Usuario:', derecha: usuario },
    { separador: true },
    { texto: '1x Producto de prueba', derecha: '$100.00' },
    { texto: '2x Refresco', derecha: '$50.00' },
    { separador: true },
    { texto: 'TOTAL', derecha: '$150.00', negrita: true },
    { separador: true },
    { texto: 'Acentos: áéíóú ñ ¿¡', alinear: 'centro' },
    { texto: 'Si puedes leer esto, la impresora funciona.', alinear: 'centro' },
    { texto: '' },
  ];
}

export const impresionRouter = Router();
impresionRouter.use(requireAuth);

// Instalador de impresión (.exe: drivers e impresoras, Node.js y el agente conectado a este servidor) para la
// computadora donde se conectan las impresoras. Vive en la carpeta de datos del servidor (no en el repositorio, que es público): data/descargas/.
// Lo arma print-agent/instalador/crear-instalador.ps1 (lleva dentro el token del agente) y se sube a mano al servidor.
const INSTALADOR = path.join(config.dataDir, 'descargas', 'instalador-impresoras.exe');

impresionRouter.get('/instalador', (req, res) => {
  if (!['admin', 'cajero'].includes(req.usuario!.rol)) {
    res.status(403).json({ error: 'Solo administración o caja pueden descargar el instalador.' });
    return;
  }
  if (!existsSync(INSTALADOR)) {
    res.status(404).json({ error: 'El instalador de impresoras no está en el servidor.' });
    return;
  }
  res.download(INSTALADOR, 'Instalar-impresoras-SOFT-RESTAURANTE.exe');
});

impresionRouter.get('/estado', async (_req, res) => {
  try {
    // equipo: la computadora del agente conectado por internet (sin él, la PC del túnel).
    const datos = await llamarAgente('/impresoras');
    const equipo = agenteRemoto()?.equipo ?? null;
    await estadoImpresorasGuardado.registrar(equipo, datos);
    res.json({ agente: true, equipo, ...datos });
  } catch (err: any) {
    res.status(err.status === 503 ? 200 : err.status || 500).json(estadoImpresorasGuardado.sinConexion(err.message, agenteDesconectado()?.equipo));
  }
});

/**
 * «Sincronizar» (Configuración > Impresoras): la computadora de las impresoras vuelve a buscarlas en Windows y
 * reinicia limpio su impresión de cocina y caja. Si está desconectada, el mensaje dice cuál es y qué hacer.
 * Un agente instalado antes de este botón no conoce /sincronizar: a ese solo se le pide la lista de nuevo.
 */
impresionRouter.post('/sincronizar', async (_req, res) => {
  try {
    let datos;
    try {
      datos = await llamarAgente('/sincronizar', { method: 'POST', body: '{}' });
    } catch (err: any) {
      if (err.status !== 404) throw err;
      datos = await llamarAgente('/impresoras');
    }
    const equipo = agenteRemoto()?.equipo ?? null;
    await estadoImpresorasGuardado.registrar(equipo, datos);
    res.json({ agente: true, equipo, ...datos });
  } catch (err: any) {
    res.status(err.status === 503 ? 200 : err.status || 500).json(estadoImpresorasGuardado.sinConexion(err.message, agenteDesconectado()?.equipo));
  }
});

impresionRouter.put('/asignacion', async (req, res) => {
  if (!['admin', 'cajero'].includes(req.usuario!.rol)) {
    res.status(403).json({ error: 'Solo administración o caja pueden asignar impresoras.' });
    return;
  }
  const { destino, impresora } = req.body ?? {};
  if (!esDestino(destino) || typeof impresora !== 'string' || !impresora.trim()) {
    res.status(400).json({ error: 'Selecciona una impresora y un destino válido: cocina o caja.' });
    return;
  }
  try {
    const estado = await llamarAgente('/asignacion', { method: 'PUT', body: JSON.stringify({ destino, impresora }) });
    const equipo = agenteRemoto()?.equipo ?? null;
    await estadoImpresorasGuardado.registrar(equipo, estado);
    res.json({ agente: true, equipo, ...estado });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** Ticket de cocina: recibe el JSON (ver ticketCocina.ts), lo valida y lo imprime. */
impresionRouter.post('/cocina', async (req, res) => {
  const ticket = req.body?.ticket;
  const error = validarTicketCocina(ticket);
  if (error) {
    res.status(400).json({ error });
    return;
  }
  try {
    // Las bebidas se preparan en caja: su ticket sale en la impresora de caja; lo demás, en la de cocina.
    const destino: DestinoImpresion = (ticket as TicketCocina).area === 'bebidas' ? 'caja' : 'cocina';
    const data = await imprimirLineas(lineasTicketCocina(ticket as TicketCocina), destino);
    res.json(data);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

impresionRouter.post('/prueba', async (req, res) => {
  const destino = req.body?.destino ?? 'caja';
  if (!esDestino(destino)) {
    res.status(400).json({ error: 'El destino debe ser cocina o caja.' });
    return;
  }
  try {
    const data = await imprimirLineas(ticketDePrueba(req.usuario!.nombre, destino), destino);
    res.json(data);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});
