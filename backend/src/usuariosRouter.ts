// Administración de usuarios: solo para el rol admin (módulo Configuración → Usuarios).
import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireAuth } from './auth.js';
import {
  buscarPorUsuario,
  crearUsuario,
  ErrorUsuarios,
  listarUsuarios,
  numeroTabletOcupado,
  siguienteNumeroTablet,
  type Rol,
  type TipoAcceso,
} from './usuarios.js';

// Tipos que se pueden crear desde Configuración.
const ROLES_CREABLES: Rol[] = ['admin', 'tablet'];
const FORMATO_USUARIO = /^[a-z0-9._-]{3,32}$/;
const MIN_PASSWORD = 6;
const FORMATO_PIN = /^\d{4,6}$/;
const FORMATO_NUMERO_TABLET = /^\d{1,3}$/;

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.usuario?.rol !== 'admin') {
    res.status(403).json({ error: 'Solo un administrador puede administrar usuarios.' });
    return;
  }
  next();
}

export const usuariosRouter = Router();
usuariosRouter.use(requireAuth, requireAdmin);

usuariosRouter.get('/', (_req, res) => {
  res.json({ usuarios: listarUsuarios(), siguienteNumeroTablet: siguienteNumeroTablet() });
});

usuariosRouter.post('/', async (req, res) => {
  const { usuario, nombre, rol, password } = req.body ?? {};
  const acceso: TipoAcceso = req.body?.acceso === 'pin' ? 'pin' : 'password';

  if (typeof nombre !== 'string' || !nombre.trim()) {
    res.status(400).json({ error: 'El nombre es obligatorio.' });
    return;
  }
  if (typeof usuario !== 'string' || !FORMATO_USUARIO.test(usuario.trim().toLowerCase())) {
    res.status(400).json({ error: 'El usuario debe tener de 3 a 32 caracteres: letras, números, punto, guion o guion bajo.' });
    return;
  }
  if (!ROLES_CREABLES.includes(rol)) {
    res.status(400).json({ error: 'Tipo de usuario no válido.' });
    return;
  }
  if (acceso === 'pin') {
    if (typeof password !== 'string' || !FORMATO_PIN.test(password)) {
      res.status(400).json({ error: 'El PIN debe tener de 4 a 6 números.' });
      return;
    }
  } else if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
    res.status(400).json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.` });
    return;
  }
  if (buscarPorUsuario(usuario)) {
    res.status(409).json({ error: 'Ese nombre de usuario ya existe.' });
    return;
  }

  // Tablet: número (único) y ubicación. Se registra quién la dio de alta (BD: tablets.creado_por).
  let tablet: { numero: string; ubicacion: string; creadoPor: string } | undefined;
  if (rol === 'tablet') {
    const numero = String(req.body?.numeroTablet ?? '').trim();
    if (!FORMATO_NUMERO_TABLET.test(numero) || Number(numero) < 1) {
      res.status(400).json({ error: 'El número de tablet debe ser un número del 1 al 999.' });
      return;
    }
    if (numeroTabletOcupado(numero)) {
      res.status(409).json({ error: 'Ese número de tablet ya está registrado.' });
      return;
    }
    const ubicacion = typeof req.body?.ubicacion === 'string' ? req.body.ubicacion.slice(0, 100) : '';
    tablet = { numero, ubicacion, creadoPor: req.usuario!.id };
  }

  try {
    const creado = await crearUsuario({ usuario, nombre, rol, password, acceso }, tablet);
    res.status(201).json({ usuario: creado });
  } catch (err) {
    if (err instanceof ErrorUsuarios) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error('[usuarios] No se pudo guardar el usuario:', err);
    res.status(500).json({ error: 'No se pudo guardar el usuario.' });
  }
});
