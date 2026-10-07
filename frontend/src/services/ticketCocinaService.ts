// Arma el JSON del ticket de cocina a partir de una comanda y lo manda a imprimir (/api/impresion/cocina).
import { Comanda, OrderItem, ProductCatalogItem, SeleccionProducto } from '../types/pos';
import { OpcionTicket, ProductoTicketCocina, TicketCocina } from '../types/ticketCocina';
import { getToken } from './authService';
import { posDataService } from './dataService';

/**
 * { "Relleno": ["Frijol"], "Extras": [] } → [{ grupo: "Relleno", eleccion: ["Frijol"] }] (sin grupos vacíos),
 * en el mismo orden en que el producto define sus grupos (Relleno, Ingredientes, …).
 */
function aOpciones(seleccion: SeleccionProducto | undefined, producto?: ProductCatalogItem): OpcionTicket[] {
  const orden = producto?.grupos?.map((g) => g.nombre) ?? [];
  const posicion = (grupo: string) => (orden.includes(grupo) ? orden.indexOf(grupo) : orden.length);
  return Object.entries(seleccion ?? {})
    .filter(([, eleccion]) => eleccion.length > 0)
    .sort(([a], [b]) => posicion(a) - posicion(b))
    .map(([grupo, eleccion]) => ({ grupo, eleccion: [...eleccion] }));
}

function aProducto(item: OrderItem): ProductoTicketCocina {
  const d = item.detalle;
  const producto = d ? posDataService.getProductos().find((p) => p.id === d.productoId) : undefined;
  const nombrePieza = producto?.paquete?.nombrePieza ?? 'Pieza';
  const opcionesDe = (sel?: SeleccionProducto) => aOpciones(sel, producto);

  return {
    partida_id: item.id,
    producto_id: d?.productoId ?? '',
    nombre: item.productName,
    categoria: item.category,
    cantidad: item.quantity,
    opciones: opcionesDe(d?.seleccion),
    ...(d?.piezas?.length && {
      piezas: d.piezas.map((sel, i) => ({ pieza: `${nombrePieza} ${i + 1}`, opciones: opcionesDe(sel) })),
    }),
    ...(d?.reparto && {
      reparto: Object.entries(d.reparto)
        .filter(([, cantidad]) => cantidad > 0)
        .map(([opcion, cantidad]) => ({ opcion, cantidad })),
    }),
    descripcion: item.modifiers ?? [],
    ...(item.notes && { notas: item.notes }),
  };
}

export function construirTicketCocina(comanda: Comanda): TicketCocina {
  const cuenta = posDataService.getAccountById(comanda.accountId);
  const productos = comanda.items.map(aProducto);
  return {
    version: 1,
    orden_cocina: comanda.orderNumber,
    comanda_id: comanda.id,
    cuenta_id: comanda.accountId,
    mesa: comanda.accountIdentifier,
    tipo_identificador: cuenta?.identifierType ?? 'mesa',
    para_llevar: !!comanda.paraLlevar,
    ronda: comanda.sequenceNumber,
    adicion: comanda.isAddition,
    mesero: comanda.waiterName,
    tablet: comanda.sentByTablet,
    enviada_en: comanda.enviadaEn ?? new Date().toISOString(),
    productos,
    // Un paquete cuenta sus piezas ("2 Burritas" × 1 = 2); el reparto ya viene en piezas (10 alitas).
    total_piezas: productos.reduce((acc, p) => acc + p.cantidad * (p.piezas?.length || 1), 0),
    ...(comanda.generalNotes && { notas_generales: comanda.generalNotes }),
  };
}

/** Manda el ticket a la impresora de cocina. Devuelve el nombre de la impresora usada. */
export async function imprimirTicketCocina(ticket: TicketCocina): Promise<string> {
  let res: Response;
  try {
    res = await fetch('/api/impresion/cocina', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken() ?? ''}` },
      body: JSON.stringify({ ticket }),
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'No se pudo imprimir el ticket de cocina.');
  return data.impresora ?? 'impresora';
}
