import crypto from 'node:crypto';

function leerJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET es obligatorio en producción y debe tener al menos 32 caracteres.');
  }
  console.warn('[config] JWT_SECRET no definido: se usa uno aleatorio (las sesiones se pierden al reiniciar).');
  return crypto.randomBytes(48).toString('hex');
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  jwtSecret: leerJwtSecret(),
  jwtExpiresIn: (process.env.JWT_EXPIRES_IN || '12h') as `${number}h`,
  admin: {
    usuario: process.env.ADMIN_USUARIO || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
    nombre: process.env.ADMIN_NOMBRE || 'Administrador',
  },
};
