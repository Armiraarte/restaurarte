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
//          ¡Gracias por su visita!
import type { LineaTicket } from './impresion.js';
import { encabezadoRestaurante } from './ticketMarca.js';

export interface DatosTicketCobro {
  idOrden: number;
  etiqueta: string; // "Mesa 1" o el nombre del cliente
  paraLlevar: boolean;
  abiertaPor: string; // tablet o "Caja"
  cobro: string; // usuario que cobró
  fecha: Date;
  productos: { cantidad: number; nombre: string; importe: number }[];
  total: number;
  /** null al reimprimir desde Ventas: el monto recibido no se guarda, así que no se imprime efectivo ni cambio. */
  recibido: number | null;
  cambio: number | null;
  reimpresion?: boolean;
}

const dinero = (n: number) => `$${n.toFixed(2)}`;

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
  for (const p of t.productos) lineas.push({ texto: `${p.cantidad}  ${p.nombre}`, derecha: dinero(p.importe) });
  lineas.push(
    { separador: true },
    { texto: 'TOTAL', derecha: dinero(t.total), grande: true },
  );
  if (t.recibido !== null && t.cambio !== null) {
    lineas.push({ texto: 'Efectivo', derecha: dinero(t.recibido) }, { texto: 'Cambio', derecha: dinero(t.cambio), negrita: true });
  }
  lineas.push(
    { separador: true },
    { texto: '¡Gracias por su visita!', alinear: 'centro' },
    { texto: '' },
  );
  return lineas;
}
