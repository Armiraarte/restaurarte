// Tablets en línea y verificación de conexión.
// Cada tablet con sesión manda un "latido" cada pocos segundos; el admin ve cuáles están en línea
// y puede pedir una verificación: la tablet la recibe en su siguiente latido, muestra el aviso y responde.
// Es estado en vivo, por eso vive en memoria (no hace falta guardarlo en la base de datos).
import crypto from 'node:crypto';
import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireAuth } from './auth.js';
import { registrarConexionTablet } from './usuarios.js';
import { liberarSesionTablet } from './sesionesTablet.js';

/** IP real de la tablet: detrás de nginx o del proxy de Vite llega en X-Forwarded-For. */
function ipDe(req: Request): string {
  const reenviada = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(reenviada) ? reenviada[0] : reenviada)?.split(',')[0].trim() || req.socket.remoteAddress || '';
  return ip.replace(/^::ffff:/, '').slice(0, 45);
}

/** Sin latido en este tiempo, la tablet se considera desconectada. */
const EN_LINEA_MS = 15_000;

interface Verificacion {
  id: string;
  solicitadaEn: number;
  respondidaEn?: number;
}

interface TabletEnLinea {
  usuarioId: string;
  usuario: string;
  nombre: string;
  tablet: string | null; // número de tablet elegido en la app
  mesero: string | null;
  ultimoLatido: number;
  verificacion?: Verificacion;
}

const enLinea = new Map<string, TabletEnLinea>();

function soloRoles(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      res.status(403).json({ error: 'Sin permiso.' });
      return;
    }
    next();
  };
}

function aRespuesta(t: TabletEnLinea, ahora: number) {
  const v = t.verificacion;
  return {
    usuarioId: t.usuarioId,
    usuario: t.usuario,
    nombre: t.nombre,
    tablet: t.tablet,
    mesero: t.mesero,
    conectada: ahora - t.ultimoLatido < EN_LINEA_MS,
    ultimoLatido: new Date(t.ultimoLatido).toISOString(),
    verificacion: v
      ? {
          estado: v.respondidaEn ? 'verificada' : 'pendiente',
          solicitadaEn: new Date(v.solicitadaEn).toISOString(),
          respuestaMs: v.respondidaEn ? v.respondidaEn - v.solicitadaEn : null,
        }
      : null,
  };
}

export const tabletsRouter = Router();
tabletsRouter.use(requireAuth);

/** La tablet avisa que sigue en línea; si hay una verificación pendiente, se le entrega. */
tabletsRouter.post('/latido', soloRoles('tablet', 'admin'), (req, res) => {
  const u = req.usuario!;
  const { tablet, mesero } = req.body ?? {};
  const previo = enLinea.get(u.id);
  enLinea.set(u.id, {
    usuarioId: u.id,
    usuario: u.usuario,
    nombre: u.nombre,
    tablet: typeof tablet === 'string' && tablet ? tablet : null,
    mesero: typeof mesero === 'string' && mesero ? mesero : null,
    ultimoLatido: Date.now(),
    verificacion: previo?.verificacion,
  });

  // BD: tablets.ultima_conexion / ip / mesero / sesion_iniciada_en (solo cuentas de tablet; con límite de escrituras)
  void registrarConexionTablet(u.id, { ip: ipDe(req), mesero: typeof mesero === 'string' && mesero ? mesero : null });

  const v = previo?.verificacion;
  res.json({ verificacion: v && !v.respondidaEn ? { id: v.id } : null });
});

/** La tablet confirma que recibió la verificación. */
tabletsRouter.post('/verificacion/:id/confirmar', soloRoles('tablet', 'admin'), (req, res) => {
  const t = enLinea.get(req.usuario!.id);
  if (!t?.verificacion || t.verificacion.id !== req.params.id) {
    res.status(404).json({ error: 'Verificación no encontrada.' });
    return;
  }
  t.verificacion.respondidaEn ??= Date.now();
  t.ultimoLatido = Date.now();
  res.json({ ok: true });
});

/** Caja (admin o cajero): tablets que han iniciado sesión y su estado. */
tabletsRouter.get('/', soloRoles('admin', 'cajero'), (_req, res) => {
  const ahora = Date.now();
  const tablets = [...enLinea.values()]
    .filter((t) => t.usuarioId !== _req.usuario!.id) // el propio admin no se lista
    .map((t) => aRespuesta(t, ahora))
    .sort((a, b) => Number(b.conectada) - Number(a.conectada) || a.nombre.localeCompare(b.nombre));
  res.json({ tablets });
});

/** Admin: pide a una tablet que verifique su conexión. */
tabletsRouter.post('/:usuarioId/verificar', soloRoles('admin'), (req, res) => {
  const t = enLinea.get(String(req.params.usuarioId));
  if (!t || Date.now() - t.ultimoLatido >= EN_LINEA_MS) {
    res.status(409).json({ error: 'La tablet no está en línea.' });
    return;
  }
  t.verificacion = { id: crypto.randomUUID(), solicitadaEn: Date.now() };
  res.status(202).json({ tablet: aRespuesta(t, Date.now()) });
});

/** Corte de turno: esas cuentas dejan de aparecer en línea (sus sesiones ya se cerraron). */
export function olvidarTabletsEnLinea(usuarioIds: string[]) {
  for (const id of usuarioIds) enLinea.delete(id);
}

/** La tablet cerró sesión: deja de aparecer en línea y su cuenta queda libre para otro dispositivo. */
tabletsRouter.post('/salir', (req, res) => {
  enLinea.delete(req.usuario!.id);
  liberarSesionTablet(req.usuario!.id, req.sesionId);
  void registrarConexionTablet(req.usuario!.id, { ip: ipDe(req), mesero: null });
  res.json({ ok: true });
});
