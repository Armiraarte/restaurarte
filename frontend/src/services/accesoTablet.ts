// Entrada a la app de las tablets (backend/src/accesoTablet.ts): en vez de usuario y PIN, la tablet elige
// cuál es (Tablet 01…05) cuando caja tiene el turno abierto. El dispositivo se autoriza una sola vez con el
// usuario y la contraseña de caja; el token del dispositivo se guarda aquí.
import { guardarToken, Usuario } from './authService';
import { esStandalone } from './pwaService';

const CLAVE_DISPOSITIVO = 'dispositivo_tablet'; // sin prefijo pos_ para no disparar la sincronización

/** Tablet (pantalla táctil, sin mouse). En el navegador solo se le ofrece descargar la app. */
export const esPantallaTactil = () => window.matchMedia('(hover: none) and (pointer: coarse)').matches;

/** Tablet abierta como app descargada: solo se usa la versión tablet. */
export const esTabletInstalada = () => esPantallaTactil() && esStandalone();

/** Tablet abierta en el navegador: solo se le ofrece descargar la app. */
export const esTabletEnNavegador = () => esPantallaTactil() && !esStandalone();

export interface TabletSeleccionable {
  numero: string;
  nombre: string;
  /** Otra tablet la está usando ahora. */
  enUso: boolean;
}

/** El dispositivo todavía no está autorizado (o se le quitó la autorización). */
export class SinAutorizarError extends Error {}

const leerDispositivo = () => {
  try {
    return localStorage.getItem(CLAVE_DISPOSITIVO);
  } catch {
    return null;
  }
};

export const dispositivoAutorizado = () => !!leerDispositivo();

async function pedir<T>(ruta: string, cuerpo?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/acceso-tablet${ruta}`, {
      method: cuerpo === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Dispositivo': leerDispositivo() ?? '' },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (data.sinAutorizar) {
      try {
        localStorage.removeItem(CLAVE_DISPOSITIVO);
      } catch {
        // sin almacenamiento
      }
      throw new SinAutorizarError(data.error || 'Esta tablet aún no está autorizada.');
    }
    throw new Error(data.error || 'No se pudo completar la operación.');
  }
  return data as T;
}

/** Las tablets registradas y si hay turno abierto (sin turno no se puede entrar). */
export const listarTablets = () => pedir<{ turnoAbierto: boolean; tablets: TabletSeleccionable[] }>('/tablets');

/** Autoriza este dispositivo con el usuario y contraseña de caja (una sola vez). */
export async function autorizarEsteDispositivo(usuario: string, password: string) {
  const { dispositivo } = await pedir<{ dispositivo: string }>('/autorizar', { usuario, password });
  localStorage.setItem(CLAVE_DISPOSITIVO, dispositivo);
}

/** Entra como esa tablet: abre su sesión (queda guardada como la de cualquier inicio de sesión). */
export async function entrarComoTablet(numero: string): Promise<Usuario> {
  const { token, usuario } = await pedir<{ token: string; usuario: Usuario }>('/entrar', { numero });
  guardarToken(token);
  return usuario;
}
