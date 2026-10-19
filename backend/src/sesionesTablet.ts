// Una sola sesión por cuenta de tablet, para que los pedidos de dos dispositivos no se crucen.
// Cada inicio de sesión recibe un id (sid, va dentro del token) y solo el último es válido:
//   - Mientras el dispositivo que tiene la sesión siga en uso (hizo una petición en los últimos 15 s;
//     la tablet late cada 3 s), otro dispositivo no puede entrar con la misma cuenta.
//   - Si dejó de usarse (se apagó, se quedó sin Wi-Fi, se cerró la app), el nuevo inicio la reemplaza
//     y el dispositivo anterior recibe 401 en su siguiente petición: vuelve a elegir su tablet.
//   - Al cerrar sesión la cuenta queda libre al momento.
//   - Al hacer el corte de turno (o el cierre automático) se cierran todas: cada tablet vuelve a la pantalla
//     de elegir tablet y espera el siguiente turno.
// El sid vigente se guarda en data/sesiones-tablet.json para que un reinicio de la API no saque a las tablets.
import crypto from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

const ARCHIVO = path.join(config.dataDir, 'sesiones-tablet.json');

/** Sin peticiones en este tiempo, la sesión deja de contar como en uso (igual que «en línea» en tablets.ts). */
const EN_USO_MS = 15_000;

interface Sesion {
  sid: string;
  ultimoUso: number;
  /** Cerró sesión: el token sigue sirviendo para sus últimas peticiones, pero otro dispositivo ya puede entrar. */
  liberada: boolean;
  /** Se cerró con el corte de turno: el token ya no sirve. */
  cerradaPorCorte?: boolean;
}

/** Estado del token de una tablet. */
export type EstadoSesionTablet = 'vigente' | 'reemplazada' | 'cerrada';

const sesiones = new Map<string, Sesion>();

export async function inicializarSesionesTablet() {
  try {
    const guardadas = JSON.parse(await readFile(ARCHIVO, 'utf8')) as Record<
      string,
      { sid: string; liberada: boolean; cerradaPorCorte?: boolean }
    >;
    // Tras un reinicio cada sesión cuenta como en uso: su tablet tiene unos segundos para volver a latir.
    for (const [usuarioId, s] of Object.entries(guardadas)) {
      sesiones.set(usuarioId, { sid: s.sid, liberada: s.liberada, cerradaPorCorte: s.cerradaPorCorte, ultimoUso: Date.now() });
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('[sesiones-tablet] No se pudieron leer las sesiones guardadas:', (err as Error).message);
    }
  }
}

// Las escrituras van en fila para que una más vieja no pise a una más nueva.
let escritura = Promise.resolve();
function guardar() {
  const datos = Object.fromEntries(
    [...sesiones].map(([id, s]) => [id, { sid: s.sid, liberada: s.liberada, ...(s.cerradaPorCorte && { cerradaPorCorte: true }) }]),
  );
  escritura = escritura
    .then(async () => {
      await mkdir(path.dirname(ARCHIVO), { recursive: true });
      // Se escribe a un temporal y se renombra para no dejar el archivo a medias si el proceso se corta.
      const temporal = `${ARCHIVO}.tmp`;
      await writeFile(temporal, JSON.stringify(datos), 'utf8');
      await rename(temporal, ARCHIVO);
    })
    .catch((err) => console.error('[sesiones-tablet] No se pudieron guardar las sesiones:', (err as Error).message));
}

/** true si otro dispositivo está usando la cuenta (no se puede entrar con ella). */
export function sesionEnUso(usuarioId: string): boolean {
  const actual = sesiones.get(usuarioId);
  return !!actual && !actual.liberada && !actual.cerradaPorCorte && Date.now() - actual.ultimoUso < EN_USO_MS;
}

/** Abre la sesión de la cuenta en un dispositivo nuevo y devuelve su sid; null si otro dispositivo la está usando. */
export function abrirSesionTablet(usuarioId: string): string | null {
  if (sesionEnUso(usuarioId)) return null;
  const sid = crypto.randomUUID();
  sesiones.set(usuarioId, { sid, ultimoUso: Date.now(), liberada: false });
  guardar();
  return sid;
}

/** Si el token es el de la sesión vigente de la cuenta; si lo es, la marca en uso. */
export function estadoSesionTablet(usuarioId: string, sid: string): EstadoSesionTablet {
  const actual = sesiones.get(usuarioId);
  if (!actual) {
    // Sin registro (se perdió el archivo): el primer dispositivo que llega se queda con la sesión.
    sesiones.set(usuarioId, { sid, ultimoUso: Date.now(), liberada: false });
    guardar();
    return 'vigente';
  }
  if (actual.sid !== sid) return 'reemplazada';
  if (actual.cerradaPorCorte) return 'cerrada';
  if (!actual.liberada) actual.ultimoUso = Date.now();
  return 'vigente';
}

/** La tablet cerró sesión: la cuenta queda libre para otro dispositivo. */
export function liberarSesionTablet(usuarioId: string, sid: string | undefined) {
  const actual = sesiones.get(usuarioId);
  if (!actual || actual.sid !== sid || actual.liberada) return;
  actual.liberada = true;
  guardar();
}

/** Corte de turno: cierra la sesión de todas las tablets. Devuelve las cuentas que tenían sesión abierta. */
export function cerrarSesionesTablet(): string[] {
  const cerradas: string[] = [];
  for (const [usuarioId, s] of sesiones) {
    if (s.cerradaPorCorte) continue;
    if (!s.liberada) cerradas.push(usuarioId);
    s.cerradaPorCorte = true;
    s.liberada = true;
  }
  if (cerradas.length > 0) guardar();
  return cerradas;
}
