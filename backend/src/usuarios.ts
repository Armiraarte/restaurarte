import crypto from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import type { RowDataPacket } from 'mysql2/promise';
import { config } from './config.js';
import { esDuplicado, hashParaLaravel, pool } from './db.js';

export type Rol = 'admin' | 'cajero' | 'mesero' | 'cocina' | 'tablet';

/** Cómo se identifica al entrar: contraseña libre o PIN numérico. */
export type TipoAcceso = 'password' | 'pin';

/** Tablet vinculada a una cuenta de tablet. BD: tablets (usuario_id → usuarios.id). */
export interface TabletRegistrada {
  id: string; // "tablet-01"
  numero: string; // "01"
  nombre: string; // "Tablet 01" (igual que el nombre de su usuario)
  ubicacion: string;
  creadoPor: string; // usuarios.id del administrador que la dio de alta
}

export interface Usuario {
  id: string;
  usuario: string;
  nombre: string;
  rol: Rol;
  passwordHash: string;
  acceso?: TipoAcceso; // sin valor = contraseña
  creadoEn?: string;
  tablet?: TabletRegistrada; // solo rol 'tablet'
}

export type UsuarioPublico = Omit<Usuario, 'passwordHash'>;

/** Error con código HTTP para que la ruta lo devuelva tal cual (p. ej. 409 por duplicado). */
export class ErrorUsuarios extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

// Almacenamiento:
//   - Con MySQL configurado (backend/.env de Laravel): tablas `usuarios` y `tablets`.
//   - Sin MySQL: data/usuarios.json (modo anterior). Para pasar ese archivo a MySQL:
//       .\artisan.ps1 pos:importar-usuarios-json
// En ambos casos se mantiene una copia en memoria para validar sesiones sin consultar la base.
// El admin del .env no se guarda: se crea al arrancar con la contraseña que tenga el .env en ese momento.
const ARCHIVO = path.join(config.dataDir, 'usuarios.json');

const usuarios: Usuario[] = [];
let usandoMysql = false;

/** true si al arrancar se conectó a MySQL (si no, la API trabaja con data/usuarios.json). */
export function mysqlDisponible(): boolean {
  return usandoMysql;
}

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

  if (pool) {
    try {
      usuarios.push(...(await cargarDeMysql()).filter((u) => !buscarPorUsuario(u.usuario)));
      usandoMysql = true;
      console.log(`[usuarios] MySQL conectado: ${usuarios.length - 1} usuarios cargados.`);
      return;
    } catch (err) {
      console.error('[usuarios] No se pudo conectar a MySQL; se usa data/usuarios.json:', (err as Error).message);
    }
  }

  try {
    const guardados = JSON.parse(await readFile(ARCHIVO, 'utf8')) as Usuario[];
    usuarios.push(...guardados.filter((u) => !buscarPorUsuario(u.usuario)));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}

async function cargarDeMysql(): Promise<Usuario[]> {
  const [filas] = await pool!.query<RowDataPacket[]>(
    `SELECT u.id, u.usuario, u.nombre, u.rol, u.password_hash, u.acceso, u.creado_en,
            t.id AS tablet_id, t.numero, t.nombre AS tablet_nombre, t.ubicacion, t.creado_por
       FROM usuarios u
       LEFT JOIN tablets t ON t.usuario_id = u.id
      WHERE u.activo = 1 AND u.id <> 'u-admin'`,
  );
  return filas.map((f) => ({
    id: f.id,
    usuario: f.usuario,
    nombre: f.nombre,
    rol: f.rol,
    passwordHash: f.password_hash, // "$2y$…": bcryptjs lo acepta igual
    acceso: f.acceso,
    creadoEn: f.creado_en ? new Date(f.creado_en).toISOString() : undefined,
    ...(f.tablet_id && {
      tablet: { id: f.tablet_id, numero: f.numero, nombre: f.tablet_nombre, ubicacion: f.ubicacion, creadoPor: f.creado_por },
    }),
  }));
}

async function guardarJson() {
  const creados = usuarios.filter((u) => u.id !== 'u-admin');
  await mkdir(path.dirname(ARCHIVO), { recursive: true });
  // Se escribe a un temporal y se renombra para no dejar el archivo a medias si el proceso se corta.
  const temporal = `${ARCHIVO}.tmp`;
  await writeFile(temporal, JSON.stringify(creados, null, 2), 'utf8');
  await rename(temporal, ARCHIVO);
}

export function buscarPorUsuario(usuario: string): Usuario | undefined {
  return usuarios.find((u) => u.usuario === usuario.trim().toLowerCase());
}

export function buscarPorId(id: string): Usuario | undefined {
  return usuarios.find((u) => u.id === id);
}

export function listarUsuarios(): UsuarioPublico[] {
  return usuarios.map(aPublico);
}

/** Número de tablet ya usado por otra cuenta ("1" y "01" son el mismo). */
export function numeroTabletOcupado(numero: string): boolean {
  return usuarios.some((u) => u.tablet && Number(u.tablet.numero) === Number(numero));
}

/** Siguiente número de tablet libre: el mayor registrado + 1. */
export function siguienteNumeroTablet(): string {
  const mayor = usuarios.reduce((max, u) => Math.max(max, Number(u.tablet?.numero) || 0), 0);
  return String(mayor + 1).padStart(2, '0');
}

export async function crearUsuario(
  datos: { usuario: string; nombre: string; rol: Rol; password: string; acceso: TipoAcceso },
  /** Solo rol 'tablet': datos de la tablet y administrador que la registra. */
  tablet?: { numero: string; ubicacion: string; creadoPor: string },
): Promise<UsuarioPublico> {
  const nuevo: Usuario = {
    id: `u-${crypto.randomUUID()}`,
    usuario: datos.usuario.trim().toLowerCase(),
    nombre: datos.nombre.trim(),
    rol: datos.rol,
    passwordHash: await bcrypt.hash(datos.password, 10),
    acceso: datos.acceso,
    creadoEn: new Date().toISOString(),
  };
  if (datos.rol === 'tablet' && tablet) {
    const numero = String(Number(tablet.numero)).padStart(2, '0');
    // Una cuenta de tablet se llama como su tablet: "Tablet 01", "Tablet 02"…
    nuevo.nombre = `Tablet ${numero}`;
    nuevo.tablet = {
      id: `tablet-${numero}`,
      numero,
      nombre: `Tablet ${numero}`,
      ubicacion: tablet.ubicacion.trim(),
      creadoPor: tablet.creadoPor,
    };
  }

  if (usandoMysql) await insertarEnMysql(nuevo);

  usuarios.push(nuevo);
  if (!usandoMysql) {
    try {
      await guardarJson();
    } catch (err) {
      usuarios.splice(usuarios.indexOf(nuevo), 1);
      throw err;
    }
  }
  return aPublico(nuevo);
}

/** Usuario y su tablet en una sola transacción: o se guardan los dos o ninguno. */
async function insertarEnMysql(u: Usuario) {
  const conexion = await pool!.getConnection();
  try {
    await conexion.beginTransaction();
    const ahora = new Date();
    await conexion.execute(
      `INSERT INTO usuarios (id, usuario, nombre, rol, password_hash, acceso, activo, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [u.id, u.usuario, u.nombre, u.rol, hashParaLaravel(u.passwordHash), u.acceso ?? 'password', ahora, ahora],
    );
    if (u.tablet) {
      await conexion.execute(
        `INSERT INTO tablets (id, usuario_id, creado_por, numero, nombre, ubicacion, activa, creado_en, actualizado_en)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [u.tablet.id, u.id, u.tablet.creadoPor, u.tablet.numero, u.tablet.nombre, u.tablet.ubicacion, ahora, ahora],
      );
    }
    await conexion.commit();
  } catch (err) {
    await conexion.rollback();
    if (esDuplicado(err)) {
      const msg = err.sqlMessage ?? '';
      throw new ErrorUsuarios(
        /numero|tablets\.PRIMARY/i.test(msg) ? 'Ese número de tablet ya está registrado.' : 'Ese nombre de usuario ya existe.',
        409,
      );
    }
    throw err;
  } finally {
    conexion.release();
  }
}

/**
 * Guarda en `tablets` lo que la tablet reporta al estar en línea (latido): última conexión, IP y mesero.
 * Se llama cada pocos segundos; solo escribe si cambió algo o si pasó el intervalo, para no saturar la base.
 */
const ultimaEscritura = new Map<string, { en: number; ip: string; mesero: string | null }>();
const INTERVALO_ESCRITURA_MS = 30_000;

export async function registrarConexionTablet(usuarioId: string, datos: { ip: string; mesero: string | null }) {
  if (!usandoMysql || !buscarPorId(usuarioId)?.tablet) return;
  const previo = ultimaEscritura.get(usuarioId);
  const cambioMesero = previo?.mesero !== datos.mesero;
  if (previo && !cambioMesero && previo.ip === datos.ip && Date.now() - previo.en < INTERVALO_ESCRITURA_MS) return;

  ultimaEscritura.set(usuarioId, { en: Date.now(), ...datos });
  try {
    await pool!.execute(
      `UPDATE tablets
          SET ultima_conexion = ?, ip = ?, mesero = ?,
              sesion_iniciada_en = ${cambioMesero ? '?' : 'sesion_iniciada_en'},
              actualizado_en = ?
        WHERE usuario_id = ?`,
      cambioMesero
        ? [new Date(), datos.ip, datos.mesero, datos.mesero ? new Date() : null, new Date(), usuarioId]
        : [new Date(), datos.ip, datos.mesero, new Date(), usuarioId],
    );
  } catch (err) {
    ultimaEscritura.delete(usuarioId);
    console.error('[tablets] No se pudo guardar la conexión:', (err as Error).message);
  }
}

export function aPublico({ passwordHash: _, ...resto }: Usuario): UsuarioPublico {
  return resto;
}
