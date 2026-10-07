// Ticket de cocina: el JSON que llega de la tablet/caja y su formato impreso.
//
// El JSON está pensado para pasarse a la base de datos casi tal cual:
//   - Guardarlo completo en una columna jsonb (p. ej. comandas.ticket_cocina) como copia histórica, y/o
//   - Repartirlo en tablas (los comentarios `BD:` indican la columna sugerida).
// El mismo tipo existe en frontend/src/types/ticketCocina.ts; si cambias uno, cambia el otro.
import type { LineaTicket } from './impresion.js';

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
  }
  return null;
}

function hora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' });
}

/** Formato impreso (impresora térmica de 80 mm). Sin precios: cocina solo necesita qué preparar. */
export function lineasTicketCocina(t: TicketCocina): LineaTicket[] {
  const lineas: LineaTicket[] = [
    { texto: 'COCINA', alinear: 'centro', negrita: true },
    { texto: t.mesa.toUpperCase(), alinear: 'centro', grande: true },
  ];
  if (t.para_llevar) lineas.push({ texto: '*** PARA LLEVAR ***', alinear: 'centro', grande: true });
  lineas.push(
    { separador: true },
    { texto: `Orden cocina ${t.orden_cocina}`, derecha: hora(t.enviada_en), negrita: true },
    { texto: t.adicion ? `Ronda ${t.ronda} · ADICIÓN` : 'Pedido inicial', derecha: t.tablet },
    { texto: `Mesero: ${t.mesero}` },
    { separador: true },
  );

  for (const p of t.productos) {
    lineas.push({ texto: `${p.cantidad} x ${p.nombre}`, grande: true });
    for (const d of p.descripcion) lineas.push({ texto: `   - ${d}` });
    if (p.notas) lineas.push({ texto: `   NOTA: ${p.notas}`, negrita: true });
    lineas.push({ texto: '' });
  }

  if (t.notas_generales) lineas.push({ texto: `NOTA GENERAL: ${t.notas_generales}`, negrita: true });
  lineas.push(
    { separador: true },
    { texto: 'Total de piezas', derecha: String(t.total_piezas), negrita: true },
    { texto: 'Control interno de cocina', alinear: 'centro' },
    { texto: '' },
  );
  return lineas;
}
