// Ticket de corte de turno (impresora térmica de 80 mm):
//
//   [Logo completo de Cenaduría Los Diablitos]
//       CORTE DE TURNO #3
//   Inicio            10/10/2026, 10:57 a.m.
//   Fin               10/10/2026, 11:42 p.m.
//   Abrió                          Zeerickz
//   Cortó                          Zeerickz
//   ----------------------------------------
//   Órdenes cobradas                     18
//   TOTAL VENDIDO                 $4,520.00
//   ----------------------------------------
//   PRODUCTOS VENDIDOS
//   12  Tacos Dorados Frijol        $120.00
//   ...
import type { LineaTicket } from './impresion.js';
import type { ResumenTurno } from './turnos.js';
import { encabezadoRestaurante } from './ticketMarca.js';

const dinero = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fecha = (d: Date | string | null) =>
  d
    ? new Date(d).toLocaleString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Mexico_City',
      })
    : '—';

export function lineasTicketCorte(r: ResumenTurno, corto: string, reimpresion = false): LineaTicket[] {
  const lineas: LineaTicket[] = [
    ...encabezadoRestaurante(),
    { texto: `CORTE DE TURNO #${r.turno.idTurno}`, alinear: 'centro', negrita: true },
    ...(reimpresion ? [{ texto: '*** REIMPRESIÓN ***', alinear: 'centro' as const }] : []),
    { texto: 'Inicio', derecha: fecha(r.turno.fecha_inicio) },
    { texto: 'Fin', derecha: fecha(r.turno.fecha_fin) },
    { texto: 'Abrió', derecha: r.turno.abrio },
    { texto: 'Cortó', derecha: corto },
    { separador: true },
    { texto: 'Órdenes cobradas', derecha: String(r.ordenes.pagadas) },
    { texto: 'TOTAL VENDIDO', derecha: dinero(r.totalVendido), grande: true },
  ];
  if (r.ordenes.sinPedido > 0) lineas.push({ texto: 'Órdenes sin pedido', derecha: String(r.ordenes.sinPedido) });
  lineas.push({ separador: true }, { texto: 'PRODUCTOS VENDIDOS', negrita: true });
  if (r.productos.length === 0) lineas.push({ texto: 'Sin ventas en este turno.' });
  for (const p of r.productos) lineas.push({ texto: `${p.cantidad}  ${p.nombre}`, derecha: dinero(p.importe) });
  lineas.push({ separador: true }, { texto: '' });
  return lineas;
}
