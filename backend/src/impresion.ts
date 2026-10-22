import { existsSync } from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { config } from './config.js';
import { requireAuth } from './auth.js';
import { lineasTicketCocina, validarTicketCocina, type TicketCocina } from './ticketCocina.js';
import { encabezadoRestaurante } from './ticketMarca.js';
import { agenteRemoto, pedirAlAgenteRemoto } from './agenteRemoto.js';

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
  // Agente conectado por internet (la computadora con las impresoras, instalada con el instalador): va primero.
  if (agenteRemoto()) {
    const { status, data } = await pedirAlAgenteRemoto(ruta, init?.method ?? 'GET', init?.body ? JSON.parse(String(init.body)) : undefined);
    if (status >= 400) throw Object.assign(new Error(data?.error || 'Error del agente de impresión.'), { status });
    return data;
  }
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
    throw Object.assign(
      new Error('No se pudo conectar con el agente de impresión. ¿Está corriendo en la PC de la impresora?'),
      { status: 503 },
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Error del agente de impresión.'), { status: res.status });
  return data;
}

/** Manda líneas ya armadas a la impresora (por el agente de impresión). */
export type DestinoImpresion = 'cocina' | 'caja';
const esDestino = (destino: unknown): destino is DestinoImpresion => destino === 'cocina' || destino === 'caja';

export function imprimirLineas(lineas: LineaTicket[], destino: DestinoImpresion = 'caja') {
  return llamarAgente('/imprimir', { method: 'POST', body: JSON.stringify({ lineas, destino }) });
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
    res.json({ agente: true, equipo: agenteRemoto()?.equipo ?? null, ...(await llamarAgente('/impresoras')) });
  } catch (err: any) {
    res.status(err.status === 503 ? 200 : err.status || 500).json({ agente: false, error: err.message });
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
    res.json({ agente: true, ...estado });
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
  // Un envío que solo trae extras (cobros libres) no tiene nada que preparar: no se gasta papel en cocina.
  if ((ticket as TicketCocina).productos.length === 0) {
    res.json({ omitido: true });
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
