// Productos que se terminaron (apartado «Agotados» de la caja): mientras estén aquí no se pueden comandar.
// En las tablets salen en gris con AGOTADO y el servidor rechaza un pedido que los traiga.
//
//   GET    /api/agotados              → { agotados: [{ idProducto, desde, por }] }
//   PUT    /api/agotados/:idProducto  { agotado: true | false } → lo marca o lo quita (admin, cajero, cocina)
//   DELETE /api/agotados              → todo disponible otra vez
//
// Se guardan en data/agotados.json: cada servidor tiene los suyos (lo que se marque en la PC de desarrollo no toca
// las tablets del restaurante). Cada cambio avisa en vivo (tipo 'menu') a las pantallas abiertas.
import { readFileSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Router, type NextFunction, type Request, type Response } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { config } from './config.js';
import { requireAuth } from './auth.js';
import { pool } from './db.js';
import { mysqlDisponible } from './usuarios.js';

export interface Agotado {
  idProducto: number;
  desde: string; // ISO 8601
  por: string; // quién lo marcó
}

const ARCHIVO = path.join(config.dataDir, 'agotados.json');

const valido = (a: any): a is Agotado =>
  Number.isSafeInteger(a?.idProducto) && a.idProducto > 0 && typeof a.desde === 'string' && typeof a.por === 'string';

const agotados: Map<number, Agotado> = (() => {
  try {
    const datos = JSON.parse(readFileSync(ARCHIVO, 'utf8'));
    return new Map((Array.isArray(datos) ? datos : []).filter(valido).map((a) => [a.idProducto, a] as const));
  } catch {
    return new Map();
  }
})();

export const agotadosActuales = () => [...agotados.values()];
export const estaAgotado = (idProducto: number) => agotados.has(idProducto);

// Se escribe en orden y por reemplazo, para que un corte a medio guardar no deje el archivo roto.
let cola: Promise<void> = Promise.resolve();
function guardar() {
  const contenido = JSON.stringify(agotadosActuales());
  cola = cola
    .then(async () => {
      await mkdir(path.dirname(ARCHIVO), { recursive: true });
      await writeFile(`${ARCHIVO}.tmp`, contenido);
      await rename(`${ARCHIVO}.tmp`, ARCHIVO);
    })
    .catch((err) => console.error('[agotados] No se pudo guardar:', (err as Error).message));
  return cola;
}

function soloRoles(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      res.status(403).json({ error: 'Sin permiso.' });
      return;
    }
    next();
  };
}
/** Marcar o quitar: quien atiende la caja o la cocina (las tablets de los meseros solo lo ven). */
const puedenCambiar = soloRoles('admin', 'cajero', 'cocina');

export const agotadosRouter = Router();
agotadosRouter.use(requireAuth, soloRoles('tablet', 'admin', 'cajero', 'cocina'));

agotadosRouter.get('/', (_req, res) => {
  res.json({ agotados: agotadosActuales() });
});

agotadosRouter.put('/:idProducto', puedenCambiar, async (req, res) => {
  const idProducto = Number(req.params.idProducto);
  const agotado = req.body?.agotado;
  if (!Number.isSafeInteger(idProducto) || idProducto < 1 || typeof agotado !== 'boolean') {
    res.status(400).json({ error: 'Producto no válido.' });
    return;
  }
  if (agotado === agotados.has(idProducto)) {
    res.locals.sinCambios = true; // ya estaba así: no se avisa a las pantallas
    res.json({ agotados: agotadosActuales() });
    return;
  }
  if (agotado) {
    if (!pool || !mysqlDisponible()) {
      res.status(503).json({ error: 'La base de datos no está disponible.' });
      return;
    }
    let filas: RowDataPacket[];
    try {
      [filas] = await pool.query<RowDataPacket[]>('SELECT id FROM producto WHERE id = ? AND estatus = 1', [idProducto]);
    } catch (err) {
      console.error('[agotados] No se pudo revisar el producto:', (err as Error).message);
      res.status(503).json({ error: 'La base de datos no está disponible.' });
      return;
    }
    if (!filas[0]) {
      res.status(404).json({ error: 'El producto no existe. Vuelve a cargar la página.' });
      return;
    }
    agotados.set(idProducto, { idProducto, desde: new Date().toISOString(), por: req.usuario!.nombre });
  } else {
    agotados.delete(idProducto);
  }
  await guardar();
  res.json({ agotados: agotadosActuales() });
});

agotadosRouter.delete('/', puedenCambiar, async (_req, res) => {
  if (agotados.size === 0) res.locals.sinCambios = true;
  agotados.clear();
  await guardar();
  res.json({ agotados: agotadosActuales() });
});
