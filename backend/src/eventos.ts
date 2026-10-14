// Avisos en vivo (Server-Sent Events): cuando alguien registra algo, todas las pantallas abiertas
// (caja web y tablets) se enteran al momento y vuelven a leer de la base, sin refrescar la página.
//
//   GET /api/eventos?token=…   conexión abierta; llegan mensajes `data: {"tipo":"ordenes"}`
//
// Tipos:
//   ordenes → se creó una orden, se envió un pedido, se pidió la cuenta, cambió una comanda…
//   turno   → se inició/cerró el turno o una sesión de tablet
// EventSource no permite mandar el header Authorization, por eso el token va en la URL.
import { Router, type NextFunction, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { buscarPorId } from './usuarios.js';

export type TipoEvento = 'ordenes' | 'turno';

const clientes = new Set<Response>();

/** Avisa a todas las pantallas conectadas. */
export function emitirEvento(...tipos: TipoEvento[]) {
  for (const tipo of tipos) {
    const mensaje = `data: ${JSON.stringify({ tipo, en: Date.now() })}\n\n`;
    for (const res of clientes) res.write(mensaje);
  }
}

/** Middleware: después de cualquier escritura que salió bien (POST/PATCH/PUT/DELETE con 2xx), avisa. */
export const avisarCambios =
  (...tipos: TipoEvento[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') {
      res.on('finish', () => {
        if (res.statusCode < 400) emitirEvento(...tipos);
      });
    }
    next();
  };

export const eventosRouter = Router();

eventosRouter.get('/', (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  try {
    const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
    if (!payload.sub || !buscarPorId(payload.sub)) throw new Error('Usuario no encontrado');
  } catch {
    res.status(401).json({ error: 'Sesión inválida o expirada.' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 3000\n\n'); // si se cae, el navegador reintenta a los 3 s
  clientes.add(res);

  // Latido para que proxies y redes Wi-Fi no cierren la conexión por inactividad.
  const latido = setInterval(() => res.write(': latido\n\n'), 25_000);
  req.on('close', () => {
    clearInterval(latido);
    clientes.delete(res);
  });
});
