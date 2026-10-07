// Conexión a MySQL (la misma base que administra Laravel: tablas `usuarios` y `tablets`).
// Los datos de conexión (DB_HOST, DB_DATABASE, …) se leen de backend/.env, el archivo de Laravel,
// para no repetirlos. Si no hay DB_HOST, la API sigue usando data/usuarios.json.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import mysql from 'mysql2/promise';

function leerVariablesDb(): Record<string, string> {
  try {
    const todas = parseEnv(readFileSync(path.resolve('.env'), 'utf8'));
    return Object.fromEntries(Object.entries(todas).filter(([k]) => k.startsWith('DB_'))) as Record<string, string>;
  } catch {
    return {};
  }
}

const archivo = leerVariablesDb();
const env = (clave: string) => process.env[clave] || archivo[clave] || '';

export const pool = env('DB_HOST')
  ? mysql.createPool({
      host: env('DB_HOST'),
      port: Number(env('DB_PORT')) || 3306,
      database: env('DB_DATABASE'),
      user: env('DB_USERNAME'),
      password: env('DB_PASSWORD'),
      charset: 'utf8mb4',
      timezone: 'Z', // fechas en UTC, igual que Laravel
      connectionLimit: 5,
    })
  : null;

/** bcryptjs genera "$2b$…"; Laravel solo acepta "$2y$…". Es el mismo bcrypt: solo cambia el prefijo. */
export function hashParaLaravel(hash: string): string {
  return hash.startsWith('$2a$') || hash.startsWith('$2b$') ? `$2y$${hash.slice(4)}` : hash;
}

/** Error de clave duplicada de MySQL (usuario, número de tablet…). */
export function esDuplicado(err: unknown): err is { code: string; sqlMessage?: string } {
  return (err as { code?: string })?.code === 'ER_DUP_ENTRY';
}
