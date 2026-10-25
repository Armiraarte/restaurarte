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
const oyentesSesion = new Set<(aviso: string) => void>();
let tokenInvalidado: string | null | undefined;

/** Una respuesta 401 cierra la sesión actual en todas las pantallas de esta pestaña. */
export function escucharSesionCerrada(oyente: (aviso: string) => void): () => void {
  oyentesSesion.add(oyente);
  return () => { oyentesSesion.delete(oyente); };
}

/** No confunde falta de internet ni permisos (403) con una sesión vencida. */
export async function fetchConSesion(ruta: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token ?? ''}`);
  const res = await fetch(ruta, { ...init, headers });
  if (res.status === 401 && getToken() === token && tokenInvalidado !== token) {
    const data = await res.clone().json().catch(() => ({}));
    // Una respuesta antigua nunca debe cerrar una sesión que se acaba de iniciar.
    if (getToken() === token && tokenInvalidado !== token) {
      tokenInvalidado = token;
      const aviso: string = data.sesionReemplazada && typeof data.error === 'string'
        ? data.error : 'Tu sesión venció o se cerró. Vuelve a iniciar sesión.';
      avisoSesion = aviso;
      logout();
      for (const oyente of oyentesSesion) oyente(aviso);
    }
  }
  return res;
}

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
  guardarToken(data.token);
  return data.usuario;
}

/**
 * Una cuenta de tablet solo puede estar abierta en un dispositivo: si se entró con ella en otro,
 * el servidor responde 401 con `sesionReemplazada` a las peticiones de este.
 */
export class SesionReemplazadaError extends Error {}

/** Lanza SesionReemplazadaError si la respuesta indica que la sesión se abrió en otro dispositivo. */
export async function revisarSesionReemplazada(res: Response): Promise<void> {
  if (res.status !== 401) return;
  const data = await res.clone().json().catch(() => ({}));
  if (data.sesionReemplazada) throw new SesionReemplazadaError(data.error || 'Se inició sesión con esta cuenta en otro dispositivo.');
}

// Motivo por el que obtenerSesion() no encontró sesión, para mostrarlo en el inicio de sesión.
let avisoSesion: string | null = null;

/** Devuelve (una sola vez) el aviso de la última sesión que el servidor cerró, o null. */
export function tomarAvisoSesion(): string | null {
  const aviso = avisoSesion;
  avisoSesion = null;
  return aviso;
}

/** Devuelve el usuario de la sesión guardada, o null si no hay sesión válida. */
export async function obtenerSesion(): Promise<Usuario | null> {
  const token = getToken();
  if (!token) return null;

  const res = await fetchConSesion('/api/auth/me', { signal: AbortSignal.timeout(8_000) });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error('No se pudo verificar la sesión.');

  const data: { usuario: Usuario } = await res.json();
  return data.usuario;
}

/** Guarda el token de una sesión iniciada sin el formulario (p. ej. al elegir la tablet). */
export function guardarToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  avisoSesion = null;
  tokenInvalidado = undefined;
}

export function logout() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // sin almacenamiento disponible: no hay nada que limpiar
  }
}
