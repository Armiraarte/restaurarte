// Entrada a la app de las tablets (backend/src/accesoTablet.ts): sin usuario ni contraseña, la tablet elige
// cuál es (Tablet 01…05) en cuanto caja tiene el turno abierto.
import { guardarToken, Usuario } from './authService';
import { esStandalone } from './pwaService';

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

async function pedir<T>(ruta: string, cuerpo?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/acceso-tablet${ruta}`, {
      method: cuerpo === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'No se pudo completar la operación.');
  return data as T;
}

/** Las tablets registradas y si hay turno abierto (sin turno no se puede entrar). */
export const listarTablets = () => pedir<{ turnoAbierto: boolean; tablets: TabletSeleccionable[] }>('/tablets');

/** Aviso inmediato para los selectores abiertos en otros dispositivos, aun sin sesión. */
export function escucharDisponibilidadTablets(alCambiar: () => void): () => void {
  if (typeof EventSource === 'undefined') return () => {};
  const fuente = new EventSource('/api/acceso-tablet/eventos');
  fuente.onmessage = alCambiar;
  // Releer al conectar también cubre cambios ocurridos mientras se abría o se recuperaba la conexión.
  fuente.onopen = alCambiar;
  return () => fuente.close();
}

/**
 * Entra como esa tablet: abre su sesión (queda guardada como la de cualquier inicio de sesión) y el dispositivo
 * recuerda cuál es, para entrar solo en cuanto caja abra el siguiente turno.
 */
export async function entrarComoTablet(numero: string): Promise<Usuario> {
  const { token, usuario } = await pedir<{ token: string; usuario: Usuario }>('/entrar', { numero });
  guardarToken(token);
  recordarTablet(numero);
  return usuario;
}

/* ---------- La tablet de este dispositivo ---------- */

const CLAVE_TABLET = 'tablet_de_este_dispositivo'; // sin prefijo pos_ para no disparar la sincronización

/** Número de la tablet que este dispositivo eligió la última vez (entra sola al abrirse el turno), o null. */
export function tabletRecordada(): string | null {
  try {
    return localStorage.getItem(CLAVE_TABLET);
  } catch {
    return null;
  }
}

function recordarTablet(numero: string) {
  try {
    localStorage.setItem(CLAVE_TABLET, numero);
  } catch {
    // sin almacenamiento: cada turno se elige a mano
  }
}

/** «Cerrar sesión» a propósito: el dispositivo ya no entra solo; se vuelve a elegir la tablet. */
export function olvidarTablet() {
  try {
    localStorage.removeItem(CLAVE_TABLET);
  } catch {
    // sin almacenamiento
  }
}
