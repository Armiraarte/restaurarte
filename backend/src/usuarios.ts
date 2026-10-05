import bcrypt from 'bcryptjs';
import { config } from './config.js';

export type Rol = 'admin' | 'cajero' | 'mesero' | 'cocina';

export interface Usuario {
  id: string;
  usuario: string;
  nombre: string;
  rol: Rol;
  passwordHash: string;
}

export type UsuarioPublico = Omit<Usuario, 'passwordHash'>;

// Almacenamiento en memoria hasta que se agregue la base de datos.
const usuarios: Usuario[] = [];

export async function inicializarUsuarios() {
  if (config.admin.password === 'admin123') {
    console.warn('[usuarios] Usando contraseña por defecto para el admin. Define ADMIN_PASSWORD en .env.');
  }
  usuarios.push({
    id: 'u-admin',
    usuario: config.admin.usuario.toLowerCase(),
    nombre: config.admin.nombre,
    rol: 'admin',
    passwordHash: await bcrypt.hash(config.admin.password, 10),
  });
}

export function buscarPorUsuario(usuario: string): Usuario | undefined {
  return usuarios.find((u) => u.usuario === usuario.trim().toLowerCase());
}

export function buscarPorId(id: string): Usuario | undefined {
  return usuarios.find((u) => u.id === id);
}

export function aPublico({ passwordHash: _, ...resto }: Usuario): UsuarioPublico {
  return resto;
}
