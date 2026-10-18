// Ticket de cocina: el JSON que llega de la tablet/caja y su formato impreso.
//
// El JSON está pensado para pasarse a la base de datos casi tal cual:
//   - Guardarlo completo en una columna jsonb (p. ej. comandas.ticket_cocina) como copia histórica, y/o
//   - Repartirlo en tablas (los comentarios `BD:` indican la columna sugerida).
// El mismo tipo existe en frontend/src/types/ticketCocina.ts; si cambias uno, cambia el otro.
import type { LineaTicket } from './impresion.js';
import { encabezadoRestaurante } from './ticketMarca.js';

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
  total_piezas: number; // piezas a preparar (un paquete cuenta sus piezas) para que cocina confirme que no falta nada
  notas_generales?: string; // BD: comandas.notas
}

/** Revisión mínima del JSON recibido; devuelve el motivo si no es válido. */
export function validarTicketCocina(t: any): string | null {
  if (!t || typeof t !== 'object') return 'Ticket vacío.';
  if (typeof t.orden_cocina !== 'string' || !t.orden_cocina) return 'Falta orden_cocina.';
  if (typeof t.mesa !== 'string' || !t.mesa.trim()) return 'Falta la mesa.';
  if (!Array.isArray(t.productos) || t.productos.length === 0) return 'El ticket no tiene productos.';
  for (const p of t.productos) {
    if (typeof p?.nombre !== 'string' || !(Number(p?.cantidad) > 0)) return 'Producto inválido en el ticket.';
    if (p.mix_grupo != null && (!Number.isSafeInteger(p.mix_grupo) || p.mix_grupo < 1)) return 'Grupo MIX inválido.';
  }
  return null;
}

/** "10/10/2026 09:05 a.m." en hora de México. */
function fechaHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Mexico_City',
  });
}

/**
 * Formato impreso (impresora térmica de 80 mm), todo alineado a la izquierda:
 *   [logo]
 *   Orden cocina #00004-2
 *   Mesa 1
 *   Tablet 01
 *   10/10/2026 09:05 a.m.
 *   ------------------------------------
 *   2x Tacos Dorados · Frijol
 *     - Crema
 *     - Salsa
 *     - Sin lechuga
 * Sin precios: cocina solo necesita qué preparar.
 */
export function lineasTicketCocina(t: TicketCocina): LineaTicket[] {
  const lineas: LineaTicket[] = [
    ...encabezadoRestaurante({ anchoMm: 35, alinear: 'izquierda' }), // logo 30% más chico que en los demás tickets
    { texto: `Orden cocina ${t.orden_cocina}`, grande: true },
    { texto: t.para_llevar ? `${t.mesa} · PARA LLEVAR` : t.mesa, negrita: true },
    ...(t.tablet ? [{ texto: t.tablet }] : []),
    { texto: fechaHora(t.enviada_en) },
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
  for (const bloque of bloques) {
    if (bloque.grupo !== null) lineas.push({ separador: true }, { texto: `MIX ${bloque.grupo} · UN SOLO PLATO`, negrita: true, escala: 1.5 });
    for (const p of bloque.productos) {
      lineas.push({ texto: `${p.cantidad}x ${p.nombre}`, negrita: true, escala: 1.5 });
      for (const d of p.descripcion) lineas.push({ texto: `  - ${d}`, escala: 1.5 });
      if (p.notas) lineas.push({ texto: `  NOTA: ${p.notas}`, negrita: true });
    }
    if (bloque.grupo !== null) lineas.push({ separador: true });
  }

  if (t.notas_generales) lineas.push({ separador: true }, { texto: `NOTA: ${t.notas_generales}`, negrita: true });
  // Espacio en blanco al final: el papel sale más largo y es fácil arrancarlo (≈ 3 cm).
  for (let i = 0; i < 8; i++) lineas.push({ texto: '' });
  lineas.push({ texto: '.', alinear: 'centro' }); // marca final: evita que el driver recorte el espacio en blanco
  return lineas;
}
