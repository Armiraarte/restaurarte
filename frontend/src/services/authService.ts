export type Rol = 'admin' | 'cajero' | 'mesero' | 'cocina' | 'tablet';

export interface Usuario {
  id: string;
  usuario: string;
  nombre: string;
  rol: Rol;
  /** Solo cuentas de tablet: su tablet (BD: tablets). */
  tablet?: { id: string; numero: string; nombre: string; ubicacion: string };
}

/** Cuentas que pueden abrir la app de meseros (/tablet). Las demás entran por la caja. */
export const ROLES_APP_MESEROS: Rol[] = ['tablet', 'admin'];

const TOKEN_KEY = 'pos_token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function leerError(res: Response, porDefecto: string): Promise<string> {
  try {
    const data = await res.json();
    return data.error || porDefecto;
  } catch {
    return porDefecto;
  }
}

export async function login(usuario: string, password: string): Promise<Usuario> {
  let res: Response;
  try {
    res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, password }),
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor.');
  }

  if (!res.ok) throw new Error(await leerError(res, 'No se pudo iniciar sesión.'));

  const data: { token: string; usuario: Usuario } = await res.json();
  localStorage.setItem(TOKEN_KEY, data.token);
  return data.usuario;
}

/** Devuelve el usuario de la sesión guardada, o null si no hay sesión válida. */
export async function obtenerSesion(): Promise<Usuario | null> {
  const token = getToken();
  if (!token) return null;

  const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) {
    logout();
    return null;
  }
  if (!res.ok) throw new Error('No se pudo verificar la sesión.');

  const data: { usuario: Usuario } = await res.json();
  return data.usuario;
}

export function logout() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // sin almacenamiento disponible: no hay nada que limpiar
  }
}
