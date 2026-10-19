// Dispositivos autorizados para usar la app de las tablets (elegir Tablet 01…05 sin usuario ni PIN).
// La primera vez, alguien de caja (admin o cajero) autoriza el dispositivo con su usuario y contraseña; el
// dispositivo guarda un token y desde entonces solo toca su tablet cuando hay turno abierto. Así nadie fuera del
// restaurante puede tomar una tablet aunque abra la página. En el servidor solo se guarda el hash del token
// (data/dispositivos.json); para quitarle el acceso a un dispositivo se borra su renglón.
import crypto from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

const ARCHIVO = path.join(config.dataDir, 'dispositivos.json');

interface Dispositivo {
  id: string;
  hash: string;
  autorizadoPor: string; // usuarios.id
  autorizadoEn: string;
  ultimoUso: string | null;
}

let dispositivos: Dispositivo[] = [];

const hashDe = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export async function inicializarDispositivos() {
  try {
    dispositivos = JSON.parse(await readFile(ARCHIVO, 'utf8'));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('[dispositivos] No se pudieron leer los dispositivos autorizados:', (err as Error).message);
    }
  }
}

let escritura = Promise.resolve();
function guardar() {
  const datos = JSON.stringify(dispositivos, null, 2);
  escritura = escritura
    .then(async () => {
      await mkdir(path.dirname(ARCHIVO), { recursive: true });
      const temporal = `${ARCHIVO}.tmp`;
      await writeFile(temporal, datos, 'utf8');
      await rename(temporal, ARCHIVO);
    })
    .catch((err) => console.error('[dispositivos] No se pudieron guardar:', (err as Error).message));
}

/** Autoriza un dispositivo nuevo; devuelve su token (solo se entrega esta vez). */
export function autorizarDispositivo(autorizadoPor: string): string {
  const token = crypto.randomBytes(32).toString('base64url');
  dispositivos.push({ id: crypto.randomUUID(), hash: hashDe(token), autorizadoPor, autorizadoEn: new Date().toISOString(), ultimoUso: null });
  guardar();
  return token;
}

// El último uso se guarda a lo más cada 10 minutos por dispositivo, para no escribir el archivo a cada consulta.
const GUARDAR_USO_MS = 10 * 60_000;

/** true si el token es de un dispositivo autorizado. */
export function dispositivoAutorizado(token: unknown): boolean {
  if (typeof token !== 'string' || !token) return false;
  const hash = hashDe(token);
  const d = dispositivos.find((x) => x.hash === hash);
  if (!d) return false;
  if (!d.ultimoUso || Date.now() - Date.parse(d.ultimoUso) > GUARDAR_USO_MS) {
    d.ultimoUso = new Date().toISOString();
    guardar();
  }
  return true;
}
