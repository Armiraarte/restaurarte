// Ticket de una cuenta dividida (uno por persona), impresora de caja de 80 mm:
//
//   [Logo completo de Cenaduría Los Diablitos]
//   Mesa 1
//   CUENTA 2 DE 5
//   10/10/2026, 09:36 p.m.          Orden #4
//   Atendió: Tablet 01
//   ----------------------------------------
//   Por productos:                     Partes iguales:
//   2  Tacos Pollo           $36.00    Parte igual de la cuenta
//   1  Bebidas Coca-Cola     $30.00    Total de la orden        $990.00
//   EXTRAS                             Dividida entre 5 personas
//   Desechables               $5.00
//   ----------------------------------------
//   TOTAL A PAGAR                    $71.00
//   Cuenta dividida · Orden total   $990.00
//   ----------------------------------------
//          ¡Gracias por su visita!
import type { LineaTicket } from './impresion.js';
import { encabezadoRestaurante } from './ticketMarca.js';
import type { CuentaDividida } from './cuentasDivididas.js';

export interface DatosTicketCuentaDividida {
  idOrden: number;
  etiqueta: string; // "Mesa 1" o el nombre del cliente
  paraLlevar: boolean;
  abiertaPor: string;
  fecha: Date;
  cuenta: Pick<CuentaDividida, 'numero' | 'personas' | 'modo' | 'importe' | 'total_orden' | 'productos' | 'extras'>;
  reimpresion?: boolean;
}

const dinero = (n: number) => `$${n.toFixed(2)}`;

export function lineasTicketCuentaDividida(t: DatosTicketCuentaDividida): LineaTicket[] {
  const fecha = t.fecha.toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Mexico_City',
  });
  const c = t.cuenta;
  const lineas: LineaTicket[] = [
    ...encabezadoRestaurante(),
    { texto: t.paraLlevar ? `${t.etiqueta} · PARA LLEVAR` : t.etiqueta, alinear: 'centro', negrita: true },
    { texto: `CUENTA ${c.numero} DE ${c.personas}`, alinear: 'centro', negrita: true, escala: 1.5 },
    ...(t.reimpresion ? [{ texto: '*** REIMPRESIÓN ***', alinear: 'centro' as const }] : []),
    { texto: fecha, derecha: `Orden #${t.idOrden}` },
    { texto: `Atendió: ${t.abiertaPor}` },
    { separador: true },
  ];
  if (c.modo === 'iguales') {
    lineas.push(
      { texto: 'Parte igual de la cuenta' },
      { texto: 'Total de la orden', derecha: dinero(c.total_orden) },
      { texto: `Dividida entre ${c.personas} personas` },
    );
  } else {
    for (const p of c.productos) lineas.push({ texto: `${p.cantidad}  ${p.nombre}`, derecha: dinero(p.importe) });
    if (c.extras.length) {
      lineas.push({ separador: true }, { texto: 'EXTRAS', negrita: true });
      for (const e of c.extras) lineas.push({ texto: e.descripcion, derecha: dinero(e.importe) });
    }
  }
  lineas.push({ separador: true }, { texto: 'TOTAL A PAGAR', derecha: dinero(c.importe), grande: true });
  if (c.modo === 'productos') lineas.push({ texto: 'Cuenta dividida · Orden total', derecha: dinero(c.total_orden), pequeno: true });
  lineas.push(
    { separador: true },
    { texto: '¡Gracias por su visita!', alinear: 'centro' },
    { texto: '' },
  );
  return lineas;
}
