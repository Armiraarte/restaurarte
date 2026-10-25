import type { ProductoTicketCocina } from '../types/ticketCocina.ts';
import { esQueso } from './complementos.ts';

interface SeleccionQueso {
  ofrecidos: { nombre: string }[];
  quitados: { nombre: string }[];
  sinQueso?: boolean;
  conQueso?: boolean;
  quesoOpcional: boolean;
  complementosExtra?: { nombre: string }[];
}

/** Queso incluido, agregado o extra; quitarlo siempre prevalece. No cambia el nombre del catálogo. */
export function llevaQuesoComanda(producto: Pick<ProductoTicketCocina, 'nombre' | 'descripcion'>, seleccion: SeleccionQueso): boolean {
  const sinQueso = seleccion.sinQueso || seleccion.quitados.some(esQueso)
    || producto.descripcion.some((d) => /^SIN\s/i.test(d.trim()) && /\bQUESO\b/i.test(d));
  return !!(!sinQueso && (
    seleccion.conQueso || seleccion.complementosExtra?.some(esQueso)
    || (!seleccion.quesoOpcional && seleccion.ofrecidos.some(esQueso))
    || (/\bQUESO\b/i.test(producto.nombre) && !/\bSIN\s+QUESO\b/i.test(producto.nombre))
    || producto.descripcion.some((d) => /^CON QUESO$/i.test(d.trim()) || /^EXTRA\s.*\bQUESO\b/i.test(d.trim()))
  ));
}
