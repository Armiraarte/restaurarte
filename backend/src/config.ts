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
  // Carpeta para los datos que la API guarda en disco (usuarios creados desde Configuración).
  dataDir: process.env.DATA_DIR || 'data',
  jwtSecret: leerJwtSecret(),
  jwtExpiresIn: (process.env.JWT_EXPIRES_IN || '12h') as `${number}h`,
  printAgent: {
    url: (process.env.PRINT_AGENT_URL || 'http://localhost:9101').replace(/\/$/, ''),
    token: process.env.PRINT_AGENT_TOKEN || '',
  },
  admin: {
    usuario: process.env.ADMIN_USUARIO || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
    nombre: process.env.ADMIN_NOMBRE || 'Administrador',
  },
};
