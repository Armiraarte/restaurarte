// Desglose de la cuenta de una orden (Cajas → "Ver cuenta" y Ventas): como un ticket, con cada producto
// una sola vez (aunque se haya pedido en varios envíos), su precio unitario e importe, y el total.
// Se actualiza sola con los avisos en vivo.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Clock, Home, Loader2, ShoppingBag, Tablet, X } from 'lucide-react';
import { DetalleOrdenBD, ESTATUS_ORDEN, ExtraOrdenBD, obtenerOrden, OrdenBD } from '../services/pedidosService';
import { useEnVivo } from '../services/enVivo';
import { COLOR_ESTATUS_ORDEN, EtiquetaCarneExtra, EtiquetaConPapas, EtiquetaConQueso, EtiquetaSinQueso } from './PedidoEnviado';
import { ListaExtras } from './ListaExtras';

const dinero = (n: number) => `$${n.toFixed(2)}`;
const hora = (fecha: string) => new Date(fecha).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });

interface Props {
  idOrden: number;
  onCerrar: () => void;
  /** Botones al pie (Cobrar, Reimprimir…). */
  acciones?: React.ReactNode;
}

export const CuentaDetalle: React.FC<Props> = ({ idOrden, onCerrar, acciones }) => {
  const [orden, setOrden] = useState<OrdenBD | null>(null);
  const [detalle, setDetalle] = useState<DetalleOrdenBD[]>([]);
  const [extras, setExtras] = useState<ExtraOrdenBD[]>([]);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const datos = await obtenerOrden(idOrden);
      setOrden(datos.orden);
      setDetalle(datos.detalle);
      setExtras(datos.extras ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la cuenta.');
    }
  }, [idOrden]);
  useEffect(() => {
    cargar();
  }, [cargar]);
  useEnVivo(['ordenes'], cargar);

  // Un renglón por producto, agrupado por categoría (SIN QUESO y DOBLE / TRIPLE CARNE van en su propio renglón).
  const categorias = useMemo(() => {
    const porProducto = new Map<
      string,
      { clave: string; nombre: string; sinQueso: boolean; conQueso: boolean; conPapas: boolean; carneExtra: number; categoria: string; cantidad: number; importe: number }
    >();
    for (const d of detalle) {
      const nombre = d.opciones?.mezcla && d.opciones.mezcla.length > 1 ? d.opciones.mezcla.join(' con ') : d.tamano ? `${d.nombre} (${d.tamano})` : d.nombre;
      const clave = `${d.idProducto}-${d.sin_queso ? 1 : 0}-${d.con_queso ? 1 : 0}-${d.carne_extra}-${nombre}-${d.opciones?.papas ? 1 : 0}`;
      const p = porProducto.get(clave) ?? {
        clave,
        nombre,
        sinQueso: d.sin_queso,
        conQueso: d.con_queso,
        conPapas: !!d.opciones?.papas,
        carneExtra: d.carne_extra,
        categoria: d.categoria,
        cantidad: 0,
        importe: 0,
      };
      p.cantidad += d.cantidad;
      p.importe = Math.round((p.importe + d.subtotal) * 100) / 100;
      porProducto.set(clave, p);
    }
    const grupos = new Map<string, (typeof porProducto extends Map<string, infer V> ? V : never)[]>();
    for (const p of porProducto.values()) grupos.set(p.categoria, [...(grupos.get(p.categoria) ?? []), p]);
    return [...grupos.entries()];
  }, [detalle]);

  const piezas = detalle.reduce((acc, d) => acc + d.cantidad, 0);
  const estatus = orden?.estatus ?? 0;
  const paraLlevar = orden?.tipo_orden === 2;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCerrar}
    >
      <motion.div
        role="dialog"
        aria-label="Cuenta"
        className="w-full max-w-xl max-h-full bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div className="shrink-0 bg-neutral-900 text-white px-5 pt-4 pb-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-widest text-neutral-400">Cuenta · Orden #{idOrden}</div>
              <div className="text-3xl font-bold truncate">{orden?.etiqueta ?? '…'}</div>
            </div>
            <button onClick={onCerrar} aria-label="Cerrar" className="p-1.5 -mr-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className={`font-bold tracking-wide px-3 py-1 rounded-full border ${COLOR_ESTATUS_ORDEN[estatus] ?? COLOR_ESTATUS_ORDEN[0]}`}>
              {ESTATUS_ORDEN[estatus] ?? `ESTATUS ${estatus}`}
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/10 text-neutral-200">
              {paraLlevar ? <ShoppingBag className="w-4 h-4" /> : <Home className="w-4 h-4" />}
              {paraLlevar ? 'Para llevar' : 'Comer aquí'}
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/10 text-neutral-200">
              <Tablet className="w-4 h-4" /> {orden?.abierta_por ?? '—'}
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/10 text-neutral-200">
              <Clock className="w-4 h-4" /> {orden ? hora(orden.creado_en) : '—'}
            </span>
          </div>
        </div>

        {/* Productos */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-3">
          {error && (
            <div className="mb-2 flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
          {!orden && !error ? (
            <div className="py-10 flex justify-center text-neutral-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : categorias.length === 0 && extras.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">Esta orden no tiene productos.</p>
          ) : (
            categorias.map(([categoria, productos]) => (
              <div key={categoria} className="py-3">
                <div className="text-sm font-bold uppercase tracking-widest text-amber-600 mb-2">{categoria}</div>
                {productos.map((p) => (
                  <div key={p.clave} className="flex items-center gap-3 py-2 border-b border-neutral-100 last:border-0">
                    <span className="shrink-0 min-w-10 h-10 px-2 rounded-xl bg-amber-100 text-amber-900 font-mono font-bold text-xl flex items-center justify-center">
                      {p.cantidad}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-xl font-semibold leading-tight truncate">{p.nombre}</span>
                        {p.sinQueso && <EtiquetaSinQueso />}
                        {p.conQueso && <EtiquetaConQueso />}
                        {p.carneExtra > 0 && <EtiquetaCarneExtra carneExtra={p.carneExtra} />}
                      </span>
                      <span className="block text-sm text-neutral-500 font-mono">{dinero(p.importe / p.cantidad)} c/u</span>
                      {p.conPapas && <EtiquetaConPapas />}
                    </span>
                    <span className="shrink-0 font-mono font-bold text-xl">{dinero(p.importe)}</span>
                  </div>
                ))}
              </div>
            ))
          )}
          <ListaExtras extras={extras} />
        </div>

        {/* Total */}
        <div className="shrink-0 border-t-2 border-dashed border-neutral-200 px-5 py-4 bg-amber-50/60">
          <div className="flex items-end justify-between">
            <div className="text-xs text-neutral-500">
              {piezas} {piezas === 1 ? 'pieza' : 'piezas'}
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-widest text-neutral-500">Total</div>
              <div className="text-3xl font-bold font-mono leading-none">{dinero(orden?.total ?? 0)}</div>
            </div>
          </div>
          {acciones && <div className="mt-4">{acciones}</div>}
        </div>
      </motion.div>
    </motion.div>
  );
};
