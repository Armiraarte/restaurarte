// JSON del ticket de cocina. Es el mismo tipo que backend/src/ticketCocina.ts (si cambias uno, cambia el otro).
//
// Pensado para la base de datos:
//   - Guardarlo completo en una columna jsonb (p. ej. comandas.ticket_cocina) como copia histórica, y/o
//   - Repartirlo en tablas: los comentarios `BD:` indican la columna sugerida.
//
// Ejemplo:
// {
//   "version": 1,
//   "orden_cocina": "#00124",            ← control interno (consecutivo global)
//   "comanda_id": "cmd-124",
//   "cuenta_id": "acc-0412",
//   "mesa": "Mesa 4",
//   "tipo_identificador": "mesa",
//   "para_llevar": false,
//   "ronda": 2, "adicion": true,
//   "mesero": "Sebastián Martínez", "tablet": "TABLET 01",
//   "enviada_en": "2026-10-07T14:32:10.000Z",
//   "productos": [
//     { "partida_id": "item-1", "producto_id": "p-taco-dorado", "nombre": "Taco Dorado (Frijol)",
//       "categoria": "Tacos Dorados", "cantidad": 2,
//       "opciones": [ { "grupo": "Relleno", "eleccion": ["Frijol"] }, { "grupo": "Complementos", "eleccion": ["Crema"] } ],
//       "descripcion": ["Sin repollo ni lechuga", "Con crema"], "notas": "bien dorados" },
//     { "partida_id": "item-2", "producto_id": "p-burrita", "nombre": "2 Burritas", "categoria": "Burritas", "cantidad": 1,
//       "opciones": [],
//       "piezas": [ { "pieza": "Burrita 1", "opciones": [ { "grupo": "Relleno", "eleccion": ["Pierna"] } ] }, … ],
//       "descripcion": ["Burrita 1: Pierna · …", "Burrita 2: …"] },
//     { "partida_id": "item-3", "producto_id": "p-alitas", "nombre": "Alitas", "categoria": "Alitas", "cantidad": 10,
//       "opciones": [], "reparto": [ { "opcion": "BBQ", "cantidad": 5 }, { "opcion": "Buffalo", "cantidad": 5 } ],
//       "descripcion": ["5 BBQ", "5 Buffalo"] }
//   ],
//   "total_piezas": 13
// }

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
  mix_grupo?: number | null; // mismo número = un plato; cada producto conserva su renglón
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
