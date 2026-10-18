import type { LineaTicket } from './impresion.js';

/** Encabezado común del restaurante para cobro, cocina, corte y prueba de impresión. */
export function encabezadoRestaurante({
  anchoMm = 50,
  alinear = 'centro',
}: { anchoMm?: number; alinear?: LineaTicket['alinear'] } = {}): LineaTicket[] {
  return [
    { imagen: 'logo-completo', anchoMm, alinear },
    { texto: 'Aquí se cena como los Dioses aunque nos llamen Diablitos', alinear, pequeno: true },
  ];
}
