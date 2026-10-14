// Pedido de una orden: arriba los datos de la orden (estatus, quién la abrió, a qué hora llegó, total)
// y abajo, compacto, lo que ya se mandó a cocina agrupado por envío.
//   orden             → estatus (0 abierta, 1 pagando, 2 pagado), creado_en, abierta_por, total
//   orden_has_detalle → producto, cantidad y subtotal de cada renglón
// (Los complementos quitados, «sin lechuga», solo van en el ticket de cocina: no se guardan en la base.)
import React from 'react';
import { Clock, Plus, Receipt, Tablet } from 'lucide-react';
import { DetalleOrdenBD, ESTATUS_ORDEN, OrdenBD } from '../services/pedidosService';

export const COLOR_ESTATUS_ORDEN: Record<number, string> = {
  0: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  1: 'bg-amber-100 text-amber-800 border-amber-300',
  2: 'bg-neutral-200 text-neutral-700 border-neutral-300',
};

const dinero = (n: number) => `$${n.toFixed(2)}`;
const hora = (fecha: string) => new Date(fecha).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });

interface Renglon {
  clave: number;
  cantidad: number;
  producto: string; // "Frijol" / "Milanesa (Grande)"
  categoria: string;
  subtotal: number;
}

interface Props {
  orden: OrdenBD | null;
  detalle: DetalleOrdenBD[];
  className?: string;
  /** Si no hay nada enviado, muestra un botón para ir a agregar productos. */
  onAgregar?: () => void;
}

export const PedidoEnviado: React.FC<Props> = ({ orden, detalle, className = '', onAgregar }) => {
  // Envíos: renglones con la misma hora de registro.
  const envios: { creado: string; renglones: Renglon[] }[] = [];
  detalle.forEach((d) => {
    const renglon: Renglon = {
      clave: d.idDetalle_Orden,
      cantidad: d.cantidad,
      producto: d.tamano ? `${d.nombre} (${d.tamano})` : d.nombre,
      categoria: d.categoria,
      subtotal: d.subtotal,
    };
    const ultimo = envios[envios.length - 1];
    if (ultimo && ultimo.creado === d.creado_en) ultimo.renglones.push(renglon);
    else envios.push({ creado: d.creado_en, renglones: [renglon] });
  });

  const piezas = detalle.reduce((acc, d) => acc + d.cantidad, 0);
  const estatus = orden?.estatus ?? 0;

  return (
    <section className={`bg-white border border-neutral-200 rounded-2xl overflow-hidden flex flex-col ${className}`}>
      {/* Datos de la orden */}
      <div className="shrink-0 px-4 py-3 bg-neutral-50 border-b border-neutral-200 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg font-bold truncate">{orden?.etiqueta ?? '…'}</span>
            <span
              className={`shrink-0 text-[11px] font-bold tracking-wide px-2 py-0.5 rounded-full border ${
                COLOR_ESTATUS_ORDEN[estatus] ?? COLOR_ESTATUS_ORDEN[0]
              }`}
            >
              {ESTATUS_ORDEN[estatus] ?? `ESTATUS ${estatus}`}
            </span>
          </div>
          <span className="text-lg font-bold font-mono">{dinero(orden?.total ?? 0)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-600">
          <span className="inline-flex items-center gap-1">
            <Tablet className="w-3.5 h-3.5 text-neutral-400" /> Abrió:{' '}
            <b className="font-semibold text-neutral-800">{orden?.abierta_por ?? '—'}</b>
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-neutral-400" /> Llegó:{' '}
            <b className="font-semibold text-neutral-800">{orden ? hora(orden.creado_en) : '—'}</b>
          </span>
          <span className="inline-flex items-center gap-1">
            <Receipt className="w-3.5 h-3.5 text-neutral-400" /> {piezas} {piezas === 1 ? 'pieza' : 'piezas'} · {envios.length}{' '}
            {envios.length === 1 ? 'envío' : 'envíos'}
          </span>
        </div>
      </div>

      {/* Lo ya enviado, compacto */}
      {envios.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-4 py-6 text-center">
          <p className="text-sm text-neutral-500">Aún no se ha enviado nada a cocina.</p>
          {onAgregar && (
            <button
              onClick={onAgregar}
              className="h-10 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-sm font-semibold flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Agregar productos
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {envios.map((envio, i) => (
            <div key={envio.creado}>
              <div className="sticky top-0 px-4 py-1 bg-white/95 border-b border-neutral-100 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                Envío {i + 1} · {hora(envio.creado)}
              </div>
              <ul className="divide-y divide-neutral-50">
                {envio.renglones.map((r) => (
                  <li key={r.clave} className="px-4 py-1.5 flex items-baseline gap-2 text-sm">
                    <span className="shrink-0 w-8 font-mono font-bold text-amber-700">{r.cantidad}×</span>
                    <span className="flex-1 min-w-0">
                      <span className="font-semibold">{r.producto}</span>
                      <span className="text-neutral-400"> · {r.categoria}</span>
                    </span>
                    <span className="shrink-0 font-mono text-neutral-700">{dinero(r.subtotal)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
