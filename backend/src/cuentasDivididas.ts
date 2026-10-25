// Cuentas divididas (botón Dividir en la pantalla de la orden): cada persona queda guardada como Cuenta 1…N
// de la misma orden (tabla orden_cuenta_dividida, migración 2026_10_25_000031) y se imprime un ticket por persona.
// Dividir también pide la cuenta (la orden pasa a PAGANDO y aparece en Cajas). El total y el cobro no cambian:
// Ventas y el corte la siguen contando una sola vez, y en Cajas, Ventas, el detalle de la cuenta y el ticket de
// cobro se ve que fue una cuenta dividida.
//
// El servidor vuelve a calcular las partes con lo guardado en la base (no confía en los importes de la pantalla):
//   iguales   → el total entre N; los centavos que sobran van a las primeras cuentas.
//   productos → cada pieza (clave de dividirCuenta.ts) asignada a una persona; todas deben tener dueño.
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { pool } from './db.js';
import { repartir, unidadesDeCuenta } from './dividirCuenta.js';
import { productoTicketCobro, type RenglonCobro } from './ticketCobro.js';

export const MAX_PERSONAS = 12;
export type ModoDivision = 'iguales' | 'productos';

export interface ProductoCuenta {
  cantidad: number;
  nombre: string;
  importe: number;
}

/** Una cuenta de la división, como se guarda y se imprime. */
export interface CuentaDividida {
  numero: number; // 1 = Cuenta 1
  personas: number;
  modo: ModoDivision;
  importe: number;
  total_orden: number; // total de la orden al dividirla (si cambió después, la división quedó vieja)
  productos: ProductoCuenta[];
  extras: { descripcion: string; importe: number }[];
  creado_por: string;
  creado_en: string;
}

export interface RenglonDivision extends RenglonCobro {
  idDetalle_Orden: number;
  cantidad: number;
  subtotal: number;
  opciones: (RenglonCobro['opciones'] & { reparto?: { nombre: string; cantidad: number; precio?: number }[] }) | null;
}

export interface SolicitudDivision {
  modo: ModoDivision;
  personas: number;
  /** Por productos: clave de cada pieza → persona (0 = Cuenta 1). */
  asignadas?: Record<string, number>;
}

const pesos = (centavos: number) => Math.round(centavos) / 100;

/** Revisa lo que manda la pantalla; devuelve el mensaje de error o null. */
export function validarSolicitudDivision(s: any): string | null {
  if (!s || (s.modo !== 'iguales' && s.modo !== 'productos')) return 'Elige cómo dividir: partes iguales o por productos.';
  if (!Number.isInteger(s.personas) || s.personas < 2 || s.personas > MAX_PERSONAS) return `La cuenta se divide entre 2 y ${MAX_PERSONAS} personas.`;
  if (s.modo === 'productos') {
    if (!s.asignadas || typeof s.asignadas !== 'object' || Array.isArray(s.asignadas)) return 'Asigna los productos a cada persona.';
    if (Object.values(s.asignadas).some((p) => !Number.isInteger(p) || (p as number) < 0 || (p as number) >= s.personas)) {
      return 'Hay productos asignados a una persona que no existe.';
    }
  }
  return null;
}

/**
 * Las cuentas de cada persona con lo que hay en la orden. Las piezas usan las mismas claves que la pantalla
 * (dividirCuenta.ts), así lo que se tocó en la tablet es lo que se imprime.
 */
export function calcularCuentasDivididas(
  orden: { total: number; detalle: RenglonDivision[]; extras: { id: number; descripcion: string; importe: number }[] },
  s: SolicitudDivision,
): { cuentas: Omit<CuentaDividida, 'creado_por' | 'creado_en'>[] } | { error: string } {
  const totalCentavos = Math.round(orden.total * 100);
  const base = { personas: s.personas, modo: s.modo, total_orden: pesos(totalCentavos) };
  if (s.modo === 'iguales') {
    return {
      cuentas: repartir(totalCentavos, s.personas).map((centavos, i) => ({ ...base, numero: i + 1, importe: pesos(centavos), productos: [], extras: [] })),
    };
  }

  const unidades = unidadesDeCuenta(
    orden.detalle.map((d) => ({
      clave: String(d.idDetalle_Orden),
      nombre: productoTicketCobro(d),
      cantidad: d.cantidad,
      subtotal: d.subtotal,
      // MIXTAS: cada pieza con el nombre de su sabor («Lonches Mixto»).
      reparto: d.opciones?.reparto?.map((r) => ({ ...r, nombre: productoTicketCobro(d, r.nombre) })),
    })),
    orden.extras.map((e) => ({ clave: String(e.id), descripcion: e.descripcion, importe: e.importe })),
  );
  const asignadas = s.asignadas ?? {};
  const claves = new Set(unidades.map((u) => u.clave));
  if (Object.keys(asignadas).some((clave) => !claves.has(clave))) {
    return { error: 'La cuenta cambió mientras la dividías. Cierra y vuelve a abrir Dividir cuenta.' };
  }
  const faltan = unidades.filter((u) => asignadas[u.clave] === undefined);
  if (faltan.length) return { error: `Falta asignar ${faltan.length === 1 ? '1 producto' : `${faltan.length} productos`} a alguna persona.` };

  const cuentas = Array.from({ length: s.personas }, (_, i) => {
    const mias = unidades.filter((u) => asignadas[u.clave] === i);
    const productos = new Map<string, { cantidad: number; centavos: number }>();
    const extras: { descripcion: string; importe: number }[] = [];
    for (const u of mias) {
      if (u.clave.startsWith('extra-')) {
        extras.push({ descripcion: u.nombre, importe: pesos(u.centavos) });
        continue;
      }
      const p = productos.get(u.nombre) ?? { cantidad: 0, centavos: 0 };
      p.cantidad += 1;
      p.centavos += u.centavos;
      productos.set(u.nombre, p);
    }
    return {
      ...base,
      numero: i + 1,
      importe: pesos(mias.reduce((acc, u) => acc + u.centavos, 0)),
      productos: [...productos.entries()].map(([nombre, p]) => ({ cantidad: p.cantidad, nombre, importe: pesos(p.centavos) })),
      extras,
      vacia: mias.length === 0,
    };
  });
  const vacia = cuentas.find((c) => c.vacia);
  if (vacia) return { error: `La Persona ${vacia.numero} no tiene productos. Asígnale algo o quita una persona.` };
  return { cuentas: cuentas.map(({ vacia: _vacia, ...c }) => c) };
}

/** La división sigue sirviendo si sus cuentas suman el total actual de la orden. */
export const divisionVigente = (cuentas: { importe: number }[], total: number) =>
  cuentas.length > 0 && cuentas.reduce((acc, c) => acc + Math.round(c.importe * 100), 0) === Math.round(total * 100);

/* ---------- Base de datos ---------- */

// Mientras no se corra la migración, la tabla no existe: todo sigue funcionando como antes y solo no se puede
// guardar una división. Se vuelve a revisar cada minuto.
let tablaLista = false;
let revisadaEn = 0;
export async function hayTablaCuentasDivididas(): Promise<boolean> {
  if (tablaLista || !pool) return tablaLista;
  if (Date.now() - revisadaEn < 60_000) return false;
  revisadaEn = Date.now();
  try {
    const [filas] = await pool.query<RowDataPacket[]>(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'orden_cuenta_dividida' LIMIT 1",
    );
    tablaLista = filas.length > 0;
  } catch {
    tablaLista = false;
  }
  return tablaLista;
}

const deFila = (f: RowDataPacket): CuentaDividida => {
  const contenido = (typeof f.contenido === 'string' ? JSON.parse(f.contenido) : f.contenido) ?? {};
  return {
    numero: Number(f.numero),
    personas: Number(f.personas),
    modo: f.modo,
    importe: Number(f.importe),
    total_orden: Number(f.total_orden),
    productos: contenido.productos ?? [],
    extras: contenido.extras ?? [],
    creado_por: f.creado_por,
    creado_en: f.creado_en instanceof Date ? f.creado_en.toISOString() : String(f.creado_en),
  };
};

/** Las cuentas guardadas de una orden (vacío si no se dividió). */
export async function leerCuentasDivididas(idOrden: number): Promise<CuentaDividida[]> {
  if (!(await hayTablaCuentasDivididas())) return [];
  const [filas] = await pool!.query<RowDataPacket[]>(
    'SELECT * FROM orden_cuenta_dividida WHERE idOrden = ? ORDER BY numero', [idOrden],
  );
  return filas.map(deFila);
}

/** Lo de cada cuenta de las órdenes divididas (para las listas de Cajas y Ventas). */
export async function cuentasPorOrden(ids: number[]): Promise<Map<number, { numero: number; importe: number }[]>> {
  const porOrden = new Map<number, { numero: number; importe: number }[]>();
  if (!ids.length || !(await hayTablaCuentasDivididas())) return porOrden;
  const [filas] = await pool!.query<RowDataPacket[]>(
    'SELECT idOrden, numero, importe FROM orden_cuenta_dividida WHERE idOrden IN (?) ORDER BY idOrden, numero', [ids],
  );
  for (const f of filas) {
    const id = Number(f.idOrden);
    porOrden.set(id, [...(porOrden.get(id) ?? []), { numero: Number(f.numero), importe: Number(f.importe) }]);
  }
  return porOrden;
}

/** Reemplaza la división anterior de la orden por la nueva (dentro de la transacción de quien llama). */
export async function guardarCuentasDivididas(
  conexion: PoolConnection,
  idOrden: number,
  cuentas: Omit<CuentaDividida, 'creado_por' | 'creado_en'>[],
  creadoPor: string,
  ahora: Date,
) {
  await conexion.execute('DELETE FROM orden_cuenta_dividida WHERE idOrden = ?', [idOrden]);
  for (const c of cuentas) {
    await conexion.execute(
      `INSERT INTO orden_cuenta_dividida (idOrden, numero, personas, modo, importe, total_orden, contenido, creado_por, creado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [idOrden, c.numero, c.personas, c.modo, c.importe.toFixed(2), c.total_orden.toFixed(2),
        c.modo === 'productos' ? JSON.stringify({ productos: c.productos, extras: c.extras }) : null, creadoPor.slice(0, 60), ahora],
    );
  }
}
