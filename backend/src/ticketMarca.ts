import type { LineaTicket } from './impresion.js';

/** Encabezado común del restaurante para cobro, cocina, corte y prueba de impresión. */
export function encabezadoRestaurante(): LineaTicket[] {
  return [
    { imagen: 'logo-completo', anchoMm: 50, alinear: 'centro' },
    { texto: 'Aquí se cena como los Dioses aunque nos llamen Diablitos', alinear: 'centro', pequeno: true },
  ];
}
