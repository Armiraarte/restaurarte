// Ticket de cocina: el JSON que llega de la tablet/caja y su formato impreso.
//
// El JSON está pensado para pasarse a la base de datos casi tal cual:
//   - Guardarlo completo en una columna jsonb (p. ej. comandas.ticket_cocina) como copia histórica, y/o
//   - Repartirlo en tablas (los comentarios `BD:` indican la columna sugerida).
// El mismo tipo existe en frontend/src/types/ticketCocina.ts; si cambias uno, cambia el otro.
import type { LineaTicket } from './impresion.js';
import { extrasValidos, type ExtraPedido } from './extrasPedido.js';
import { formatoProductoCocina } from './formatoProductoCocina.js';

/** Una elección dentro de un grupo de opciones. BD: partida_opciones (partida_id, grupo, eleccion). */
export interface OpcionTicket {
  grupo: string; // "Relleno", "Ingredientes"…
  eleccion: string[]; // lo elegido; en ingredientes "todos incluidos" son los que SÍ lleva
}

/** Producto (partida) dentro del ticket. BD: partidas. */
export interface ProductoTicketCocina {
  partida_id: string; // BD: partidas.id
  producto_id: string; // BD: partidas.producto_id → productos.id
  nombre: string; // BD: partidas.nombre (copia histórica: "Taco Dorado (Frijol)", "3 Burritas")
  categoria: string; // BD: productos.categoria_id → categorias.nombre
  cantidad: number; // BD: partidas.cantidad
  mix_grupo?: number | null;
  opciones: OpcionTicket[]; // producto normal
  piezas?: { pieza: string; opciones: OpcionTicket[] }[]; // paquete (Burritas): una entrada por pieza
  reparto?: { opcion: string; cantidad: number }[]; // reparto (Alitas): cuántas de cada sabor
  descripcion: string[]; // texto ya armado para cocina ("Sin repollo ni lechuga", "Burrita 1: …")
  notas?: string; // BD: partidas.notas
}

/** Cobro extra en la comanda; `mix_grupo`: el MIX en el que se agregó (sale justo debajo de sus productos). */
export type ExtraTicket = ExtraPedido & { mix_grupo?: number | null };

/** Ticket completo. BD: comandas (+ partidas). */
export interface TicketCocina {
  version: 1;
  orden_cocina: string; // control interno, consecutivo global: "#00124". BD: comandas.numero
  comanda_id: string; // BD: comandas.id
  cuenta_id: string; // BD: comandas.cuenta_id → cuentas.id
  mesa: string; // "Mesa 4" o nombre del cliente. BD: cuentas.identificador
  tipo_identificador: 'mesa' | 'nombre'; // BD: cuentas.tipo_identificador
  para_llevar: boolean; // BD: cuentas.para_llevar (copiado al enviar)
  ronda: number; // 1 = pedido inicial, 2+ = adiciones. BD: comandas.secuencia
  adicion: boolean; // ronda > 1
  mesero: string; // BD: comandas.mesero_id → usuarios.nombre
  tablet: string; // BD: comandas.tablet_id → tablets.nombre
  enviada_en: string; // ISO 8601. BD: comandas.enviada_en
  productos: ProductoTicketCocina[];
  extras?: ExtraTicket[]; // cobros libres: debajo de su MIX si se agregaron dentro de uno; si no, al final
  total_piezas: number; // piezas a preparar (un paquete cuenta sus piezas) para que cocina confirme que no falta nada
  /** 'bebidas': el ticket de las bebidas, que se imprime en la impresora de caja (ahí se preparan). Sin valor: cocina. */
  area?: 'cocina' | 'bebidas';
  notas_generales?: string; // BD: comandas.notas
}

/** Revisión mínima del JSON recibido; devuelve el motivo si no es válido. */
export function validarTicketCocina(t: any): string | null {
  if (!t || typeof t !== 'object') return 'Ticket vacío.';
  if (typeof t.orden_cocina !== 'string' || !t.orden_cocina) return 'Falta orden_cocina.';
  if (typeof t.mesa !== 'string' || !t.mesa.trim()) return 'Falta la mesa.';
  if (!Array.isArray(t.productos) || (t.productos.length === 0 && !t.extras?.length)) return 'El ticket no tiene productos ni extras.';
  if (t.extras !== undefined && !extrasValidos(t.extras)) return 'Extra inválido en el ticket.';
  if (t.extras?.some((e: any) => e.mix_grupo != null && (!Number.isSafeInteger(e.mix_grupo) || e.mix_grupo < 1))) return 'Grupo MIX inválido.';
  if (t.area !== undefined && t.area !== 'cocina' && t.area !== 'bebidas') return 'Área inválida en el ticket.';
  for (const p of t.productos) {
    if (typeof p?.nombre !== 'string' || !(Number(p?.cantidad) > 0)) return 'Producto inválido en el ticket.';
    if (p.mix_grupo != null && (!Number.isSafeInteger(p.mix_grupo) || p.mix_grupo < 1)) return 'Grupo MIX inválido.';
  }
  return null;
}

/**
 * Formato impreso (impresora térmica de 80 mm), todo alineado a la izquierda (sin logo ni fecha):
 *   Orden cocina #00004-2 · Tablet 01   (chico)
 *   MESA 1                      (muy grande; o el nombre del cliente)
 *   PARA LLEVAR                 (grande, solo si es para llevar; comer aquí no se escribe)
 *   ------------------------------------
 *   2 Tacos Dorados · Frijol
 *   ------------------------------------
 *   MIX
 *   1 Tacos · Barbacoa
 *     - SIN CHILE, CEBOLLA
 *   + Queso extra                  $10.00
 *   ------------------------------------
 * Sin precios en los productos: cocina solo necesita qué preparar. Los cobros extra van con su importe:
 * debajo de su MIX si se agregaron dentro de uno, y los demás al final.
 */
export function lineasTicketCocina(t: TicketCocina): LineaTicket[] {
  const lineas: LineaTicket[] = [
    // Sin logo ni fecha: arriba y chico el número de orden; luego de quién es el pedido, en grande, y PARA LLEVAR
    // solo si lo es (comer aquí no se escribe).
    {
      texto: `${t.area === 'bebidas' ? 'BEBIDAS' : 'Orden cocina'} ${t.orden_cocina}${t.tablet ? ` · ${t.tablet}` : ''}`,
      negrita: t.area === 'bebidas',
    },
    { texto: t.mesa, grande: true, escala: 1.6 },
    ...(t.para_llevar ? [{ texto: 'PARA LLEVAR', grande: true, escala: 1.3 }] : []),
    { separador: true },
  ];

  // Cada MIX se imprime como un bloque, sin juntar cantidades ni perder opciones por producto.
  const bloques: { grupo: number | null; productos: ProductoTicketCocina[] }[] = [];
  const porGrupo = new Map<number, (typeof bloques)[number]>();
  for (const p of t.productos) {
    const numero = p.mix_grupo ?? null;
    let bloque = numero === null ? undefined : porGrupo.get(numero);
    if (!bloque) {
      bloque = { grupo: numero, productos: [] };
      bloques.push(bloque);
      if (numero !== null) porGrupo.set(numero, bloque);
    }
    bloque.productos.push(p);
  }
  // Extras agregados dentro de un MIX que sí está en esta comanda: salen debajo de sus productos.
  const extrasEnMix = (t.extras ?? []).filter((e) => e.mix_grupo != null && porGrupo.has(e.mix_grupo));
  for (const bloque of bloques) {
    // Sin número ni leyenda: el MIX solo agrupa; los separadores marcan dónde empieza y termina cada plato.
    if (bloque.grupo !== null) lineas.push({ separador: true }, { texto: 'MIX', negrita: true, escala: 1.5 });
    for (const p of bloque.productos) {
      const formato = formatoProductoCocina(p);
      for (const r of formato.renglones) lineas.push({ texto: `${r.cantidad} ${r.nombre}`, negrita: true, escala: 1.5 });
      for (const d of formato.descripcion) lineas.push({ texto: `  - ${d}`, escala: 1.5 });
      if (p.notas) lineas.push({ texto: `  NOTA: ${p.notas}`, negrita: true });
    }
    for (const extra of extrasEnMix.filter((e) => e.mix_grupo === bloque.grupo)) {
      lineas.push({ texto: `+ ${extra.descripcion}`, negrita: true, derecha: `$${extra.importe.toFixed(2)}` });
    }
    if (bloque.grupo !== null) lineas.push({ separador: true });
  }

  if (t.notas_generales) lineas.push({ separador: true }, { texto: `NOTA: ${t.notas_generales}`, negrita: true });
  const extrasAlFinal = (t.extras ?? []).filter((e) => !extrasEnMix.includes(e));
  if (extrasAlFinal.length) {
    lineas.push({ separador: true }, { texto: 'EXTRAS', negrita: true });
    for (const extra of extrasAlFinal) lineas.push({ texto: extra.descripcion, derecha: `$${extra.importe.toFixed(2)}` });
  }
  // Una separación pequeña antes del corte, sin alargar el papel con una marca final.
  lineas.push({ texto: '' });
  return lineas;
}
