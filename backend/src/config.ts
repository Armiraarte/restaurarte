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
  // Dirección donde escucha la API. En el servidor: 127.0.0.1, así solo se llega por nginx (HTTPS).
  // Sin definir escucha en todas las interfaces (PC del restaurante y Docker).
  host: process.env.HOST || undefined,
  // Carpeta para los datos que la API guarda en disco (usuarios creados desde Configuración).
  dataDir: process.env.DATA_DIR || 'data',
  jwtSecret: leerJwtSecret(),
  jwtExpiresIn: (process.env.JWT_EXPIRES_IN || '12h') as `${number}h`,
  printAgent: {
    url: (process.env.PRINT_AGENT_URL || 'http://localhost:9101').replace(/\/$/, ''),
    token: process.env.PRINT_AGENT_TOKEN || '',
  },
  // Solo en la PC de desarrollo (.env local, p. ej. MESA_PRUEBA=10): una mesa de prueba cuyas órdenes se guardan
  // fuera del turno (orden.idTurno NULL), así producción no las ve en sus listas, ventas ni corte. Sin definir, no existe.
  mesaPrueba: /^\d+$/.test(process.env.MESA_PRUEBA ?? '') ? String(Number(process.env.MESA_PRUEBA)) : null,
  // Monitor de la computadora de las impresoras (monitorImpresion.ts). Solo lo ven estos usuarios.
  // En la PC de desarrollo, MONITOR_REMOTO_URL y MONITOR_REMOTO_TOKEN (el PRINT_AGENT_TOKEN de producción)
  // hacen que se vigile la conexión de la laptop con producción, que es a donde se conecta.
  monitor: {
    usuarios: (process.env.MONITOR_USUARIOS || 'zeerickz').split(',').map((u) => u.trim().toLowerCase()).filter(Boolean),
    remotoUrl: (process.env.MONITOR_REMOTO_URL || '').replace(/\/$/, ''),
    remotoToken: process.env.MONITOR_REMOTO_TOKEN || '',
  },
  admin: {
    usuario: process.env.ADMIN_USUARIO || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
    nombre: process.env.ADMIN_NOMBRE || 'Administrador',
  },
};
