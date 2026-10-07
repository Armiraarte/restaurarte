// Administración de usuarios (solo admin): /api/usuarios
import { getToken, Rol, Usuario } from './authService';

export type TipoAcceso = 'password' | 'pin';

/** Tablet vinculada a una cuenta de tablet. BD: tablets (usuario_id → usuarios.id, creado_por → usuarios.id). */
export interface TabletRegistrada {
  id: string; // "tablet-01"
  numero: string; // "01"
  nombre: string; // "TABLET 01"
  ubicacion: string;
  creadoPor: string; // id del administrador que la dio de alta
}

export interface UsuarioPlantilla extends Usuario {
  acceso?: TipoAcceso;
  creadoEn?: string;
  tablet?: TabletRegistrada;
}

export type RolCreable = Extract<Rol, 'admin' | 'tablet'>;

async function pedir<T>(metodo: 'GET' | 'POST', cuerpo?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch('/api/usuarios', {
      method: metodo,
      headers: {
        Authorization: `Bearer ${getToken() ?? ''}`,
        ...(cuerpo ? { 'Content-Type': 'application/json' } : {}),
      },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'No se pudo completar la operación.');
  return data as T;
}

export async function listarUsuarios(): Promise<{ usuarios: UsuarioPlantilla[]; siguienteNumeroTablet: string }> {
  return pedir<{ usuarios: UsuarioPlantilla[]; siguienteNumeroTablet: string }>('GET');
}

export async function crearUsuario(datos: {
  nombre: string;
  usuario: string;
  password: string;
  rol: RolCreable;
  acceso: TipoAcceso;
  /** Solo tablets: número (único) y ubicación. Quien la registra lo toma el servidor de la sesión. */
  numeroTablet?: string;
  ubicacion?: string;
}): Promise<UsuarioPlantilla> {
  const { usuario } = await pedir<{ usuario: UsuarioPlantilla }>('POST', datos);
  return usuario;
}
