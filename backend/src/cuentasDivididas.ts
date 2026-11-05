// Cuentas divididas (botón Dividir en la pantalla de la orden): cada persona queda guardada como Cuenta 1…N
// de la misma orden (tabla orden_cuenta_dividida, migraciones 2026_10_25_000031 y 2026_11_05_000032) y se imprime
// un ticket por persona. Dividir también pide la cuenta (la orden pasa a PAGANDO) y en Cajas aparece una tarjeta
// por cuenta: cada persona paga la suya (recibido, cobrada_por, pagada_en) y, al pagarse la última, la orden queda
// PAGADO. Ventas y el corte cuentan la orden una sola vez, cuando ya está pagada completa.
//
// El servidor vuelve a calcular las partes con lo guardado en la base (no confía en los importes de la pantalla):
//   iguales   → el total entre N; los centavos que sobran van a las primeras cuentas.
//   productos → cada pieza (clave de dividirCuenta.ts) asignada a una persona; todas deben tener dueño.
// Con alguna cuenta ya cobrada, la división queda fija: no se vuelve a dividir ni se quita nada de la orden.
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from './db.js';
import { repartir, unidadesDeCuenta, type UnidadCuenta } from './dividirCuenta.js';
import { productoTicketCobro, type ExtraTicketCobro, type ProductoTicketCobro, type RenglonCobro } from './ticketCobro.js';

export const MAX_PERSONAS = 12;
export type ModoDivision = 'iguales' | 'productos';

export type ProductoCuenta = ProductoTicketCobro;

/** Una cuenta de la división, como se guarda y se imprime. */
export interface CuentaDividida {
  numero: number; // 1 = Cuenta 1
  personas: number;
  modo: ModoDivision;
  importe: number;
  total_orden: number; // total de la orden al dividirla (si cambió después, la división quedó vieja)
  productos: ProductoCuenta[];
  extras: ExtraTicketCobro[];
  creado_por: string;
  creado_en: string;
  /** Cobro en Cajas; null = por cobrar. */
  recibido: number | null;
  cobrada_por: string | null;
  pagada_en: string | null;
}

/** Una cuenta recién calculada (todavía sin guardar ni cobrar). */
export type CuentaCalculada = Omit<CuentaDividida, 'creado_por' | 'creado_en' | 'recibido' | 'cobrada_por' | 'pagada_en'>;

export const cuentaPagada = (c: { pagada_en?: string | null }) => c.pagada_en != null;

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
  orden: { total: number; detalle: RenglonDivision[]; extras: (ExtraTicketCobro & { id: number })[] },
  s: SolicitudDivision,
): { cuentas: CuentaCalculada[] } | { error: string } {
  const totalCentavos = Math.round(orden.total * 100);
  const base = { personas: s.personas, modo: s.modo, total_orden: pesos(totalCentavos) };
  if (s.modo === 'iguales') {
    return {
      cuentas: repartir(totalCentavos, s.personas).map((centavos, i) => ({ ...base, numero: i + 1, importe: pesos(centavos), productos: [], extras: [] })),
    };
  }

  const unidades = unidadesDeOrden(orden);
  const asignadas = s.asignadas ?? {};
  const claves = new Set(unidades.map((u) => u.clave));
  if (Object.keys(asignadas).some((clave) => !claves.has(clave))) {
    return { error: 'La cuenta cambió mientras la dividías. Cierra y vuelve a abrir Dividir cuenta.' };
  }
  const faltan = unidades.filter((u) => asignadas[u.clave] === undefined);
  if (faltan.length) return { error: `Falta asignar ${faltan.length === 1 ? '1 producto' : `${faltan.length} productos`} a alguna persona.` };

  const cuentas = Array.from({ length: s.personas }, (_, i) => armarCuenta(unidades.filter((u) => asignadas[u.clave] === i), i + 1, base));
  const vacia = cuentas.find((c) => c.importe === 0 && !c.productos.length && !c.extras.length);
  if (vacia) return { error: `La Persona ${vacia.numero} no tiene productos. Asígnale algo o quita una persona.` };
  return { cuentas };
}

/** Las piezas de la orden con el nombre que llevan en el ticket (mismas claves que la pantalla, dividirCuenta.ts). */
function unidadesDeOrden(orden: { detalle: RenglonDivision[]; extras: (ExtraTicketCobro & { id: number })[] }) {
  return unidadesDeCuenta(
    orden.detalle.map((d) => ({
      clave: String(d.idDetalle_Orden),
      nombre: productoTicketCobro(d),
      cantidad: d.cantidad,
      subtotal: d.subtotal,
      ...('mix_grupo' in d && { mix_grupo: d.mix_grupo ?? null }),
      // MIXTAS: cada pieza con el nombre de su sabor («Lonches Mixto»).
      reparto: d.opciones?.reparto?.map((r) => ({ ...r, nombre: productoTicketCobro(d, r.nombre) })),
    })),
    orden.extras.map((e) => ({ clave: String(e.id), descripcion: e.descripcion, importe: e.importe,
      ...('mix_grupo' in e && { mix_grupo: e.mix_grupo ?? null }) })),
  );
}

/** Una cuenta con sus piezas: el mismo producto junto, como en el ticket de cobro. */
function armarCuenta(
  mias: UnidadCuenta[],
  numero: number,
  base: { personas: number; modo: ModoDivision; total_orden: number },
): CuentaCalculada {
  const productos = new Map<string, { cantidad: number; nombre: string; centavos: number; mix_grupo?: number | null }>();
  const extras: ExtraTicketCobro[] = [];
  for (const u of mias) {
    const mix = 'mix_grupo' in u ? { mix_grupo: u.mix_grupo ?? null } : {};
    if (u.clave.startsWith('extra-')) {
      extras.push({ descripcion: u.nombre, importe: pesos(u.centavos), ...mix });
      continue;
    }
    const clave = JSON.stringify([u.mix_grupo ?? null, u.nombre]);
    const p = productos.get(clave) ?? { cantidad: 0, nombre: u.nombre, centavos: 0, ...mix };
    p.cantidad += 1;
    p.centavos += u.centavos;
    productos.set(clave, p);
  }
  return {
    ...base,
    numero,
    importe: pesos(mias.reduce((acc, u) => acc + u.centavos, 0)),
    productos: [...productos.values()].map(({ centavos, ...p }) => ({ ...p, importe: pesos(centavos) })),
    extras,
  };
}

/** La división sigue sirviendo si sus cuentas suman el total actual de la orden. */
export const divisionVigente = (cuentas: { importe: number }[], total: number) =>
  cuentas.length > 0 && cuentas.reduce((acc, c) => acc + Math.round(c.importe * 100), 0) === Math.round(total * 100);

/**
 * Ajusta una división (sin cuentas cobradas) a lo que hoy tiene la orden, p. ej. después de quitar algo mandado por
 * error. Partes iguales: el nuevo total entre las mismas personas. Por productos: cada cuenta se queda con lo suyo
 * que siga en la orden (si se quitó una parte de un producto compartido, se descuenta de las últimas cuentas); una
 * cuenta que se queda sin nada se quita y las demás se vuelven a numerar.
 * Devuelve las cuentas nuevas; [] = ya no queda división (una sola cuenta o nada); null = no hace falta o no se puede
 * (alguna cuenta ya se cobró, o la orden tiene algo que no era de nadie: hay que volver a dividirla).
 */
export function reconciliarDivision(
  orden: { total: number; detalle: RenglonDivision[]; extras: (ExtraTicketCobro & { id: number })[] },
  cuentas: CuentaDividida[],
): CuentaCalculada[] | null {
  if (!cuentas.length || cuentas.some(cuentaPagada) || divisionVigente(cuentas, orden.total)) return null;
  const totalCentavos = Math.round(orden.total * 100);
  const base = (personas: number) => ({ personas, modo: cuentas[0].modo, total_orden: pesos(totalCentavos) });
  if (cuentas[0].modo === 'iguales') {
    if (totalCentavos <= 0) return [];
    return repartir(totalCentavos, cuentas.length).map((centavos, i) => ({
      ...base(cuentas.length), numero: i + 1, importe: pesos(centavos), productos: [], extras: [],
    }));
  }
  // Las piezas de hoy, por nombre; cada cuenta toma las suyas en orden (Cuenta 1 primero).
  const libres = new Map<string, UnidadCuenta[]>();
  for (const u of unidadesDeOrden(orden)) {
    const clave = `${u.clave.startsWith('extra-') ? 'extra' : 'producto'}:${u.nombre}`;
    libres.set(clave, [...(libres.get(clave) ?? []), u]);
  }
  const tomar = (clave: string, n: number, grupo?: number | null) => {
    const piezas = libres.get(clave) ?? [];
    const tomadas: UnidadCuenta[] = [];
    for (let i = 0; i < piezas.length && tomadas.length < n;) {
      if (grupo === undefined || (piezas[i].mix_grupo ?? null) === grupo) tomadas.push(...piezas.splice(i, 1));
      else i += 1;
    }
    return tomadas;
  };
  const porCuenta: UnidadCuenta[][] = cuentas.map(() => []);
  // Primero las cuentas con el MIX guardado; las divisiones antiguas solo conocen el nombre.
  for (const conGrupo of [true, false]) cuentas.forEach((c, i) => {
    for (const p of c.productos.filter((p) => ('mix_grupo' in p) === conGrupo)) porCuenta[i].push(...tomar(`producto:${p.nombre}`, p.cantidad, p.mix_grupo));
    for (const e of c.extras.filter((e) => ('mix_grupo' in e) === conGrupo)) porCuenta[i].push(...tomar(`extra:${e.descripcion}`, 1, e.mix_grupo));
  });
  if ([...libres.values()].some((piezas) => piezas.length > 0)) return null;
  const conAlgo = porCuenta.filter((mias) => mias.length > 0);
  if (conAlgo.length < 2) return [];
  return conAlgo.map((mias, i) => armarCuenta(mias, i + 1, base(conAlgo.length)));
}

export type RevisionCobroCuenta =
  | { status: 400 | 404 | 409; error: string }
  | { cuenta: CuentaDividida; cambio: number; ultima: boolean };

/**
 * ¿Se puede cobrar la Cuenta `numero` con `recibido` (efectivo)? La orden debe estar en Cajas (PAGANDO), la división
 * debe seguir sumando su total y la cuenta no debe estar pagada. `ultima` = al cobrarla quedan todas pagadas.
 */
export function revisarCobroCuenta(
  orden: { estatus: number; total: number },
  cuentas: CuentaDividida[],
  numero: number,
  recibido: number,
): RevisionCobroCuenta {
  if (orden.estatus === 2) return { status: 409, error: 'Esta orden ya está pagada.' };
  if (orden.estatus !== 1) return { status: 409, error: 'La orden no ha pedido la cuenta.' };
  const cuenta = cuentas.find((c) => c.numero === numero);
  if (!cuenta) return { status: 404, error: `Esta orden no tiene Cuenta ${numero}.` };
  if (!divisionVigente(cuentas, orden.total)) {
    return { status: 409, error: 'La orden cambió después de dividirla: vuelve a dividirla o cóbrala completa.' };
  }
  if (cuentaPagada(cuenta)) return { status: 409, error: `La Cuenta ${numero} ya se cobró.` };
  const importe = Math.round(cuenta.importe * 100);
  if (!Number.isFinite(recibido) || Math.round(recibido * 100) < importe) {
    return { status: 400, error: `El monto recibido debe ser de al menos $${cuenta.importe.toFixed(2)}.` };
  }
  return {
    cuenta,
    cambio: pesos(Math.round(recibido * 100) - importe),
    ultima: cuentas.every((c) => c.numero === numero || cuentaPagada(c)),
  };
}

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
    creado_en: fechaTexto(f.creado_en)!,
    // Sin la migración 2026_11_05_000032 las columnas no existen: todas quedan por cobrar.
    recibido: f.recibido == null ? null : Number(f.recibido),
    cobrada_por: f.cobrada_por ?? null,
    pagada_en: fechaTexto(f.pagada_en),
  };
};
const fechaTexto = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));

/**
 * Las cuentas guardadas de una orden (vacío si no se dividió). Con `conexion`, dentro de su transacción y
 * bloqueadas (para cobrar una sin que otra caja la cobre al mismo tiempo).
 */
export async function leerCuentasDivididas(idOrden: number, conexion?: PoolConnection): Promise<CuentaDividida[]> {
  if (!(await hayTablaCuentasDivididas())) return [];
  const [filas] = await (conexion ?? pool!).query<RowDataPacket[]>(
    `SELECT * FROM orden_cuenta_dividida WHERE idOrden = ? ORDER BY numero${conexion ? ' FOR UPDATE' : ''}`, [idOrden],
  );
  return filas.map(deFila);
}

/** Lo de cada cuenta de las órdenes divididas (para las listas de Cajas y Ventas), y si ya se cobró. */
export async function cuentasPorOrden(ids: number[]): Promise<Map<number, { numero: number; importe: number; pagada: boolean }[]>> {
  const porOrden = new Map<number, { numero: number; importe: number; pagada: boolean }[]>();
  if (!ids.length || !(await hayTablaCuentasDivididas())) return porOrden;
  const [filas] = await pool!.query<RowDataPacket[]>(
    'SELECT * FROM orden_cuenta_dividida WHERE idOrden IN (?) ORDER BY idOrden, numero', [ids],
  );
  for (const f of filas) {
    const id = Number(f.idOrden);
    porOrden.set(id, [...(porOrden.get(id) ?? []), { numero: Number(f.numero), importe: Number(f.importe), pagada: f.pagada_en != null }]);
  }
  return porOrden;
}

/** Marca la Cuenta `numero` como cobrada (dentro de la transacción de quien llama). false = ya estaba pagada. */
export async function marcarCuentaPagada(
  conexion: PoolConnection,
  idOrden: number,
  numero: number,
  cobro: { recibido: number; cobradaPor: string; ahora: Date },
): Promise<boolean> {
  const [resultado] = await conexion.execute<ResultSetHeader>(
    'UPDATE orden_cuenta_dividida SET recibido = ?, cobrada_por = ?, pagada_en = ? WHERE idOrden = ? AND numero = ? AND pagada_en IS NULL',
    [cobro.recibido.toFixed(2), cobro.cobradaPor.slice(0, 60), cobro.ahora, idOrden, numero],
  );
  return resultado.affectedRows === 1;
}

/** Reemplaza la división anterior de la orden por la nueva (dentro de la transacción de quien llama). */
export async function guardarCuentasDivididas(
  conexion: PoolConnection,
  idOrden: number,
  cuentas: CuentaCalculada[],
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
