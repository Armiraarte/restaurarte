// Ticket de cobro (para el cliente), impresora térmica de 80 mm:
//
//   [Logo completo de Cenaduría Los Diablitos]
//   Aquí se cena como los Dioses aunque nos llamen Diablitos
//   Mesa 1
//   10/10/2026, 09:36 p.m.          Orden #4
//   Atendió: Tablet 01        Cobró: Caja
//   ----------------------------------------
//   2  Tacos Dorados Frijol          $20.00
//   6  Quesadillas Pollo             $90.00
//   ----------------------------------------
//   TOTAL                           $990.00
//   Efectivo                       $1000.00
//   Cambio                           $10.00
//   ----------------------------------------
//   CUENTA DIVIDIDA EN 2                       (solo si se dividió con el botón Dividir)
//   Cuenta 1                        $495.00
//   Cuenta 2                        $495.00
//   ----------------------------------------
//          ¡Gracias por su visita!
import type { LineaTicket } from './impresion.js';
import { encabezadoRestaurante } from './ticketMarca.js';

export interface ProductoTicketCobro {
  cantidad: number;
  nombre: string;
  importe: number;
  mix_grupo?: number | null;
}

export interface ExtraTicketCobro {
  descripcion: string;
  importe: number;
  mix_grupo?: number | null;
}

export interface DatosTicketCobro {
  idOrden: number;
  etiqueta: string; // "Mesa 1" o el nombre del cliente
  paraLlevar: boolean;
  abiertaPor: string; // tablet o "Caja"
  cobro: string; // usuario que cobró
  fecha: Date;
  productos: ProductoTicketCobro[];
  extras?: ExtraTicketCobro[];
  total: number;
  /** null al reimprimir desde Ventas: el monto recibido no se guarda, así que no se imprime efectivo ni cambio. */
  recibido: number | null;
  cambio: number | null;
  reimpresion?: boolean;
  /** La cuenta se dividió (botón Dividir): al final va «CUENTA DIVIDIDA EN 5» y lo de cada cuenta. */
  cuentasDivididas?: { numero: number; importe: number }[];
}

/** Lo que el ticket necesita de un renglón de orden_has_detalle para nombrarlo. */
export interface RenglonCobro {
  categoria: string;
  nombre: string;
  tamano: string | null;
  sin_queso: boolean;
  con_queso: boolean;
  carne_extra: number;
  mix_grupo?: number | null;
  opciones: {
    mezcla?: string[];
    reparto?: { nombre: string; cantidad: number }[];
    papas?: unknown;
    complementosExtra?: { nombre: string }[];
  } | null;
}

const textoCarneExtra = (n: number) => (n === 1 ? 'DOBLE CARNE' : n === 2 ? 'TRIPLE CARNE' : '');

/** MIXTAS: "4 BBQ + 6 Buffalo"; mezcla sin cantidades: "Papa con Frijol"; si no, el producto. */
export const nombreRenglonCobro = (d: RenglonCobro) =>
  d.opciones?.reparto?.length
    ? d.opciones.reparto.map((r) => `${r.cantidad} ${r.nombre}`).join(' + ')
    : d.opciones?.mezcla && d.opciones.mezcla.length > 1 ? d.opciones.mezcla.join(' con ') : d.nombre;

/** «EXTRA CREMA Y QUESO» (doble toque en un complemento), o vacío. */
export const extraRenglonCobro = (d: RenglonCobro) =>
  d.opciones?.complementosExtra?.length ? `EXTRA ${d.opciones.complementosExtra.map((c) => c.nombre).join(' Y ').toUpperCase()}` : '';

/**
 * Como sale en el ticket del cliente: «Tacos Pollo (Grande) SIN QUESO DOBLE CARNE». Las papas solo
 * «Orden de papas» / «Media orden de papas». `nombre` permite nombrar una sola pieza de MIXTAS por su sabor.
 */
export function productoTicketCobro(d: RenglonCobro, nombre = nombreRenglonCobro(d)) {
  if (d.categoria === 'Papas a la Francesa') return d.tamano === 'Media orden' ? 'Media orden de papas' : 'Orden de papas';
  const opciones = [d.sin_queso ? 'SIN QUESO' : '', d.con_queso ? 'CON QUESO' : '', textoCarneExtra(d.carne_extra), d.opciones?.papas ? 'CON PAPAS' : '', extraRenglonCobro(d)]
    .filter(Boolean).join(' ');
  return `${d.categoria} ${nombre}${d.tamano ? ` (${d.tamano})` : ''}${opciones ? ` ${opciones}` : ''}`;
}

const dinero = (n: number) => `$${n.toFixed(2)}`;

/** Junta productos iguales entre envíos, conservando el plato MIX y sus opciones. */
export function productosTicketCobro(detalle: (RenglonCobro & { idProducto: number; cantidad: number; subtotal: number })[]): ProductoTicketCobro[] {
  const porProducto = new Map<string, ProductoTicketCobro>();
  for (const d of detalle) {
    const nombre = nombreRenglonCobro(d);
    const clave = JSON.stringify([d.mix_grupo ?? null, d.idProducto, d.sin_queso, d.con_queso, d.carne_extra, nombre, Boolean(d.opciones?.papas), extraRenglonCobro(d)]);
    const p = porProducto.get(clave) ?? {
      cantidad: 0, nombre: productoTicketCobro(d, nombre), importe: 0,
      ...(d.mix_grupo != null && { mix_grupo: d.mix_grupo }),
    };
    p.cantidad += d.cantidad;
    p.importe = Math.round((p.importe + d.subtotal) * 100) / 100;
    porProducto.set(clave, p);
  }
  return [...porProducto.values()];
}

/** El mismo formato para cobros, cuentas por persona y sus reimpresiones. */
export function lineasProductosCobro(productos: ProductoTicketCobro[], extras: ExtraTicketCobro[] = []): LineaTicket[] {
  const bloques: { grupo: number | null; productos: ProductoTicketCobro[] }[] = [];
  const porGrupo = new Map<number, (typeof bloques)[number]>();
  for (const p of productos) {
    const grupo = p.mix_grupo ?? null;
    let bloque = grupo === null ? undefined : porGrupo.get(grupo);
    if (!bloque) {
      bloque = { grupo, productos: [] };
      bloques.push(bloque);
      if (grupo !== null) porGrupo.set(grupo, bloque);
    }
    bloque.productos.push(p);
  }
  const lineas: LineaTicket[] = [];
  const separar = () => {
    if (lineas.length && !lineas[lineas.length - 1].separador) lineas.push({ separador: true });
  };
  for (const bloque of bloques) {
    if (bloque.grupo !== null) {
      separar();
      lineas.push({ texto: 'MIX', negrita: true });
    }
    for (const p of bloque.productos) lineas.push({ texto: `${p.cantidad}  ${p.nombre}`, derecha: dinero(p.importe) });
    if (bloque.grupo !== null) {
      for (const e of extras.filter((e) => e.mix_grupo === bloque.grupo)) {
        lineas.push({ texto: `+ ${e.descripcion}`, derecha: dinero(e.importe) });
      }
      separar();
    }
  }
  const sueltos = extras.filter((e) => e.mix_grupo == null || !porGrupo.has(e.mix_grupo));
  if (sueltos.length) {
    separar();
    lineas.push({ texto: 'EXTRAS', negrita: true });
    for (const e of sueltos) lineas.push({ texto: e.descripcion, derecha: dinero(e.importe) });
  }
  // El encabezado y los totales ya llevan su propio separador.
  if (lineas[lineas.length - 1]?.separador) lineas.pop();
  return lineas;
}

export function lineasTicketCobro(t: DatosTicketCobro): LineaTicket[] {
  const fecha = t.fecha.toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Mexico_City',
  });
  const lineas: LineaTicket[] = [
    ...encabezadoRestaurante(),
    { texto: t.paraLlevar ? `${t.etiqueta} · PARA LLEVAR` : t.etiqueta, alinear: 'centro', negrita: true },
    ...(t.reimpresion ? [{ texto: '*** REIMPRESIÓN ***', alinear: 'centro' as const }] : []),
    { texto: fecha, derecha: `Orden #${t.idOrden}` },
    { texto: `Atendió: ${t.abiertaPor}`, derecha: `Cobró: ${t.cobro}` },
    { separador: true },
  ];
  lineas.push(...lineasProductosCobro(t.productos, t.extras));
  lineas.push(
    { separador: true },
    { texto: 'TOTAL', derecha: dinero(t.total), grande: true },
  );
  if (t.recibido !== null && t.cambio !== null) {
    lineas.push({ texto: 'Efectivo', derecha: dinero(t.recibido) }, { texto: 'Cambio', derecha: dinero(t.cambio), negrita: true });
  }
  if (t.cuentasDivididas?.length) {
    lineas.push({ separador: true }, { texto: `CUENTA DIVIDIDA EN ${t.cuentasDivididas.length}`, negrita: true });
    for (const c of t.cuentasDivididas) lineas.push({ texto: `Cuenta ${c.numero}`, derecha: dinero(c.importe) });
  }
  lineas.push(
    { separador: true },
    { texto: '¡Gracias por su visita!', alinear: 'centro' },
    { texto: '' },
  );
  return lineas;
}
