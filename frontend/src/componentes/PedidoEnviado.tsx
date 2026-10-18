// Pedido de una orden: arriba el resumen (estatus, quién la abrió, a qué hora llegó, total) y abajo
// lo que ya se mandó a cocina, una tarjeta por envío con su hora, piezas y subtotal.
//   orden             → estatus (0 abierta, 1 pagando, 2 pagado), creado_en, abierta_por, total
//   orden_has_detalle → producto, cantidad y subtotal de cada renglón
// (Los complementos quitados, «sin lechuga», solo van en el ticket de cocina: no se guardan en la base.)
// Los envíos se acomodan según el ancho del componente (container queries): una columna en el historial
// de la tablet y dos o tres en la caja.
import React from 'react';
import { Clock, LucideIcon, Plus, Receipt, Send, Tablet } from 'lucide-react';
import { DetalleOrdenBD, ESTATUS_ORDEN, OrdenBD } from '../services/pedidosService';
import { iconoCategoria } from './iconosCategoria';

export const COLOR_ESTATUS_ORDEN: Record<number, string> = {
  0: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  1: 'bg-amber-100 text-amber-800 border-amber-300',
  2: 'bg-neutral-200 text-neutral-700 border-neutral-300',
};

const dinero = (n: number) => `$${n.toFixed(2)}`;
const hora = (fecha: string) => new Date(fecha).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

interface Renglon {
  clave: number;
  cantidad: number;
  producto: string; // "Frijol" / "Milanesa (Grande)"
  categoria: string;
  subtotal: number;
}

interface Envio {
  creado: string;
  renglones: Renglon[];
  piezas: number;
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
  const envios: Envio[] = [];
  detalle.forEach((d) => {
    const renglon: Renglon = {
      clave: d.idDetalle_Orden,
      cantidad: d.cantidad,
      producto: d.tamano ? `${d.nombre} (${d.tamano})` : d.nombre,
      categoria: d.categoria,
      subtotal: d.subtotal,
    };
    let envio = envios[envios.length - 1];
    if (!envio || envio.creado !== d.creado_en) {
      envio = { creado: d.creado_en, renglones: [], piezas: 0, subtotal: 0 };
      envios.push(envio);
    }
    envio.renglones.push(renglon);
    envio.piezas += d.cantidad;
    envio.subtotal += d.subtotal;
  });

  const piezas = detalle.reduce((acc, d) => acc + d.cantidad, 0);
  const estatus = orden?.estatus ?? 0;

  return (
    // Casi sólida (bg-white/90 no la vuelve cristal): la lista se lee mejor sin la marca de agua detrás.
    <section
      className={`@container bg-white/90 backdrop-blur-xl border border-neutral-300/60 rounded-2xl shadow-sm overflow-hidden flex flex-col ${className}`}
    >
      {/* Resumen de la orden */}
      <header className="shrink-0 px-5 py-4 border-b border-neutral-200/80 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 space-y-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <h2 className="text-2xl font-extrabold tracking-tight truncate">{orden?.etiqueta ?? '…'}</h2>
            <span
              className={`shrink-0 text-xs font-bold tracking-wide px-2.5 py-1 rounded-full border ${
                COLOR_ESTATUS_ORDEN[estatus] ?? COLOR_ESTATUS_ORDEN[0]
              }`}
            >
              {ESTATUS_ORDEN[estatus] ?? `ESTATUS ${estatus}`}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Dato icono={Tablet} etiqueta="Abrió" valor={orden?.abierta_por ?? '—'} />
            <Dato icono={Clock} etiqueta="Llegó" valor={orden ? hora(orden.creado_en) : '—'} />
            <Dato icono={Receipt} valor={plural(piezas, 'pieza', 'piezas')} />
            <Dato icono={Send} valor={plural(envios.length, 'envío', 'envíos')} />
          </div>
        </div>
        {/* ml-auto: si no cabe junto a los datos, baja de renglón pero sigue a la derecha */}
        <div className="ml-auto text-right">
          <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Total</div>
          <div className="text-3xl font-extrabold font-mono leading-tight">{dinero(orden?.total ?? 0)}</div>
        </div>
      </header>

      {/* Lo ya enviado a cocina */}
      {envios.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
          <p className="text-base text-neutral-600">Aún no se ha enviado nada a cocina.</p>
          {onAgregar && (
            <button
              onClick={onAgregar}
              className="h-12 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-5 h-5" /> Agregar productos
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 @xl:p-4">
          {/* Columnas tipo mosaico: cada envío se acomoda bajo el anterior de su columna, sin huecos */}
          <div className="columns-1 @4xl:columns-2 @7xl:columns-3 gap-3">
            {envios.map((envio, i) => (
              <article key={envio.creado} className="break-inside-avoid mb-3 last:mb-0 rounded-xl border border-neutral-200/80 bg-white/80 overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-neutral-100/80 border-b border-neutral-200/80">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="shrink-0 w-7 h-7 rounded-full bg-neutral-900 text-white text-sm font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="font-bold">Envío {i + 1}</span>
                    <span className="text-sm text-neutral-600 truncate">
                      {hora(envio.creado)} · {plural(envio.piezas, 'pieza', 'piezas')}
                    </span>
                  </div>
                  <span className="shrink-0 font-mono font-bold">{dinero(envio.subtotal)}</span>
                </div>
                <ul className="divide-y divide-neutral-100">
                  {envio.renglones.map((r) => {
                    const Icono = iconoCategoria(r.categoria);
                    return (
                      <li key={r.clave} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5">
                        <span className="min-w-11 h-10 px-2 rounded-lg bg-amber-100 text-amber-900 font-mono text-base font-bold flex items-center justify-center">
                          {r.cantidad}×
                        </span>
                        <span className="min-w-0">
                          <span className="block font-semibold text-neutral-900 truncate">{r.producto}</span>
                          <span className="flex items-center gap-1 text-sm text-neutral-500">
                            <Icono className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{r.categoria}</span>
                          </span>
                        </span>
                        <span className="text-right">
                          <span className="block font-mono font-semibold text-neutral-900">{dinero(r.subtotal)}</span>
                          {r.cantidad > 1 && (
                            <span className="block font-mono text-xs text-neutral-500">{dinero(r.subtotal / r.cantidad)} c/u</span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

/** Dato de la orden en una etiqueta: ícono, nombre opcional y valor. */
function Dato({ icono: Icono, etiqueta, valor }: { icono: LucideIcon; etiqueta?: string; valor: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100/80 border border-neutral-200/80 px-3 py-1 text-sm text-neutral-600">
      <Icono className="w-4 h-4 text-neutral-500" />
      {etiqueta && <span>{etiqueta}:</span>}
      <b className="font-semibold text-neutral-900">{valor}</b>
    </span>
  );
}
