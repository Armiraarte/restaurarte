import { Router } from 'express';
import { config } from './config.js';
import { requireAuth } from './auth.js';
import { lineasTicketCocina, validarTicketCocina, type TicketCocina } from './ticketCocina.js';

// La impresora está conectada por USB a la PC de Windows; el backend (en Docker) no la ve,
// así que reenvía todo al agente de impresión que corre en esa PC (carpeta print-agent/).

export interface LineaTicket {
  texto?: string;
  derecha?: string;
  alinear?: 'izquierda' | 'centro' | 'derecha';
  negrita?: boolean;
  grande?: boolean;
  separador?: boolean;
}

async function llamarAgente(ruta: string, init?: RequestInit) {
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

function ticketDePrueba(usuario: string): LineaTicket[] {
  const fecha = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
  return [
    { texto: 'RESTAURARTE', alinear: 'centro', grande: true },
    { texto: 'PRUEBA DE IMPRESIÓN', alinear: 'centro', negrita: true },
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

impresionRouter.get('/estado', async (_req, res) => {
  try {
    res.json({ agente: true, ...(await llamarAgente('/impresoras')) });
  } catch (err: any) {
    res.status(err.status === 503 ? 200 : err.status || 500).json({ agente: false, error: err.message });
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
    const data = await llamarAgente('/imprimir', {
      method: 'POST',
      body: JSON.stringify({ lineas: lineasTicketCocina(ticket as TicketCocina) }),
    });
    res.json(data);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

impresionRouter.post('/prueba', async (req, res) => {
  try {
    const data = await llamarAgente('/imprimir', {
      method: 'POST',
      body: JSON.stringify({ lineas: ticketDePrueba(req.usuario!.nombre) }),
    });
    res.json(data);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});
