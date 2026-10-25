import type { CategoriaMenu, DetalleOrdenBD, ExtraOrdenBD, OrdenBD } from './pedidosService';
import type { TicketCocina, ProductoTicketCocina } from '../types/ticketCocina';
import { complementosTicket, complementosTicketQuesoOpcional } from './complementos.ts';

export interface OrdenCocina {
  id: number;
  codigo: string;
  nombre: string;
  origen?: 'mesa' | 'llamada' | 'nombre';
  estatus: number;
  tipo_orden: number;
  envios: number;
  ultimo_envio: string;
}

export type SeccionCocina = 'mesas' | 'llamadas' | 'nombres';
export const seccionOrdenCocina = (orden: Pick<OrdenCocina, 'nombre' | 'origen'>): SeccionCocina =>
  /^\d+$/.test(orden.nombre) ? 'mesas' : orden.origen === 'llamada' ? 'llamadas' : 'nombres';

export function agruparMesasCocina(ordenes: OrdenCocina[]) {
  const grupos = new Map<string, { clave: string; seccion: SeccionCocina; nombre: string; etiqueta: string; ordenes: OrdenCocina[] }>();
  for (const orden of ordenes) {
    const seccion = seccionOrdenCocina(orden);
    const clave = `${seccion}:${orden.nombre.trim().toLocaleLowerCase('es')}`;
    if (!grupos.has(clave)) grupos.set(clave, {
      clave, seccion, nombre: orden.nombre, etiqueta: /^\d+$/.test(orden.nombre) ? `Mesa ${orden.nombre}` : orden.nombre, ordenes: [],
    });
    grupos.get(clave)!.ordenes.push(orden);
  }
  return [...grupos.values()].sort((a, b) => {
    const numeros = Number(/^\d+$/.test(b.nombre)) - Number(/^\d+$/.test(a.nombre));
    return numeros || a.nombre.localeCompare(b.nombre, 'es', { numeric: true, sensitivity: 'base' });
  });
}

/** Un ticket por envío original. Las bebidas conservan su lugar en el consecutivo y se imprimen en caja. */
export function construirComandasCocina(orden: OrdenBD, detalle: DetalleOrdenBD[], extras: ExtraOrdenBD[], menu: CategoriaMenu[]): TicketCocina[] {
  const instantes = [...new Set([...detalle, ...extras].map((d) => d.creado_en))].sort((a, b) => Date.parse(a) - Date.parse(b));
  return instantes.flatMap((fecha, indice) => {
    const lineas = detalle.filter((d) => d.creado_en === fecha && (d.opciones?.comanda?.producto.categoria ?? d.categoria).toLocaleLowerCase('es') !== 'bebidas');
    const cargos = extras.filter((e) => e.creado_en === fecha);
    if (!lineas.length && !cargos.length) return [];
    const productos: ProductoTicketCocina[] = lineas.map((d) => {
      const opciones = d.opciones;
      const original = opciones?.comanda?.producto ?? d;
      const mezcla = opciones?.mezcla ?? [];
      const nombres = opciones?.reparto?.map((r) => r.nombre) ?? (mezcla.length ? mezcla : [d.nombre]);
      const ofrecidos = opciones?.comanda?.ofrecidos ?? [...new Map(
        (menu.find((c) => c.nombre === d.categoria)?.productos ?? [])
          .filter((p) => p.id === d.idProducto || (nombres.includes(p.nombre) && p.tamano === d.tamano))
          .flatMap((p) => p.complementos).map((c) => [c.id, c]),
      ).values()];
      const sin = opciones?.sin ?? [];
      const complementos = original.categoria === 'Tacos'
          ? complementosTicketQuesoOpcional(ofrecidos, sin, d.con_queso)
          : complementosTicket(ofrecidos, sin, { sinQueso: d.sin_queso, conQueso: d.con_queso });
      const tamano = original.tamano ? ` (${original.tamano})` : '';
      const nombre = opciones?.reparto?.length
        ? `${original.categoria} · MIXTAS${tamano}`
        : original.categoria === 'Papas a la Francesa'
          ? original.tamano === 'Media orden' ? 'Media orden de papas' : 'Orden de papas'
          : `${original.categoria} · ${mezcla.length > 1 ? mezcla.join(' con ') : original.nombre}${tamano}`;
      return {
        partida_id: String(d.idDetalle_Orden), producto_id: String(d.idProducto), nombre, categoria: original.categoria,
        cantidad: d.cantidad, mix_grupo: d.mix_grupo, opciones: [],
        ...(opciones?.reparto?.length && { reparto: opciones.reparto.map((r) => ({ opcion: r.nombre, cantidad: r.cantidad })) }),
        ...(opciones?.nota && { notas: opciones.nota }),
        descripcion: [
          ...(opciones?.reparto ?? []).map((r) => `${r.cantidad} ${r.nombre}`),
          ...(d.termino ? [d.termino.toUpperCase()] : []),
          ...(d.carne_extra ? [d.carne_extra === 1 ? 'DOBLE CARNE' : 'TRIPLE CARNE'] : []),
          ...(opciones?.papas ? ['CON PAPAS'] : []), ...complementos,
          ...(opciones?.complementosExtra?.length ? [`EXTRA ${opciones.complementosExtra.map((c) => c.nombre).join(' Y ').toUpperCase()}`] : []),
        ],
      };
    });
    const ronda = indice + 1;
    const origen = lineas.find((d) => d.opciones?.comanda)?.opciones?.comanda?.origen ?? orden.abierta_por;
    return [{
      version: 1, orden_cocina: `#${String(orden.idOrden).padStart(5, '0')}-${ronda}`,
      comanda_id: `${orden.idOrden}-${ronda}`, cuenta_id: String(orden.idOrden), mesa: orden.etiqueta,
      tipo_identificador: /^\d+$/.test(orden.nombre) ? 'mesa' : 'nombre', para_llevar: orden.tipo_orden === 2,
      ronda, adicion: ronda > 1, mesero: origen, tablet: origen, enviada_en: fecha, area: 'cocina',
      productos, extras: cargos.map(({ descripcion, importe }) => ({ descripcion, importe })),
      total_piezas: productos.reduce((n, p) => n + p.cantidad, 0),
    }];
  });
}
