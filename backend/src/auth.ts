import { Router, type Request, type Response, type NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { aPublico, buscarPorId, buscarPorUsuario, type UsuarioPublico } from './usuarios.js';

declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioPublico;
    }
  }
}

// Hash fijo para comparar cuando el usuario no existe y no revelar por tiempo de respuesta si existe.
const HASH_FALSO = bcrypt.hashSync('usuario-inexistente', 10);

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

  const token = jwt.sign({ sub: encontrado.id, rol: encontrado.rol }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
  res.json({ token, usuario: aPublico(encontrado) });
});

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'No autenticado.' });
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
    const usuario = payload.sub ? buscarPorId(payload.sub) : undefined;
    if (!usuario) throw new Error('Usuario no encontrado');
    req.usuario = aPublico(usuario);
    next();
  } catch {
    res.status(401).json({ error: 'Sesión inválida o expirada.' });
  }
}

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ usuario: req.usuario });
});
