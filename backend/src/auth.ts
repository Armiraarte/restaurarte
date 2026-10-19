import { Router, type Request, type Response, type NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { aPublico, buscarPorId, buscarPorUsuario, type Usuario, type UsuarioPublico } from './usuarios.js';
import { abrirSesionTablet, estadoSesionTablet } from './sesionesTablet.js';

declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioPublico;
      /** Solo cuentas de tablet: id de su sesión (ver sesionesTablet.ts). */
      sesionId?: string;
    }
  }
}

// Hash fijo para comparar cuando el usuario no existe y no revelar por tiempo de respuesta si existe.
export const HASH_FALSO = bcrypt.hashSync('usuario-inexistente', 10);

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { usuario, password } = req.body ?? {};
  if (typeof usuario !== 'string' || typeof password !== 'string' || !usuario.trim() || !password) {
    res.status(400).json({ error: 'Usuario y contraseña son obligatorios.' });
    return;
  }

  const encontrado = buscarPorUsuario(usuario);
  const valido = await bcrypt.compare(password, encontrado?.passwordHash ?? HASH_FALSO);
  if (!encontrado || !valido) {
    res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    return;
  }

  // Una cuenta de tablet solo puede estar abierta en un dispositivo a la vez.
  let sid: string | undefined;
  if (encontrado.rol === 'tablet') {
    sid = abrirSesionTablet(encontrado.id) ?? undefined;
    if (!sid) {
      res.status(409).json({
        error: `${encontrado.nombre} ya tiene la sesión abierta en otro dispositivo. Cierra sesión ahí para entrar aquí.`,
      });
      return;
    }
  }

  res.json({ token: emitirToken(encontrado, sid), usuario: aPublico(encontrado) });
});

/** Token de sesión; las tablets llevan el id de su sesión (sid, ver sesionesTablet.ts). */
export function emitirToken(usuario: Usuario, sid?: string): string {
  return jwt.sign({ sub: usuario.id, rol: usuario.rol, ...(sid && { sid }) }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

/** Usuario dueño del token o, si ya no sirve, la respuesta 401. */
export function usuarioDelToken(
  token: string,
): { usuario: Usuario; sesionId?: string } | { error: string; sesionReemplazada?: true; sesionCerrada?: true } {
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
  } catch {
    return { error: 'Sesión inválida o expirada.' };
  }
  const usuario = payload.sub ? buscarPorId(payload.sub) : undefined;
  if (!usuario) return { error: 'Sesión inválida o expirada.' };
  if (usuario.rol !== 'tablet') return { usuario };

  // Token de tablet de antes de la sesión única: se vuelve a iniciar sesión una vez.
  if (typeof payload.sid !== 'string') return { error: 'Sesión inválida o expirada.' };
  const estado = estadoSesionTablet(usuario.id, payload.sid);
  if (estado === 'reemplazada') {
    return { error: `Se inició sesión con ${usuario.nombre} en otro dispositivo.`, sesionReemplazada: true };
  }
  if (estado === 'cerrada') {
    // La tablet lo trata igual que una sesión reemplazada: vuelve a elegir tablet (y espera el siguiente turno).
    return { error: 'Se hizo el corte de turno. Elige tu tablet cuando caja inicie el siguiente turno.', sesionReemplazada: true, sesionCerrada: true };
  }
  return { usuario, sesionId: payload.sid };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'No autenticado.' });
    return;
  }

  const resultado = usuarioDelToken(token);
  if ('error' in resultado) {
    res.status(401).json(resultado);
    return;
  }
  req.usuario = aPublico(resultado.usuario);
  req.sesionId = resultado.sesionId;
  next();
}

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ usuario: req.usuario });
});
