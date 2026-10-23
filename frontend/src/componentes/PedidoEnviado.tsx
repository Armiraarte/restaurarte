// Pedido de una orden: arriba el resumen (estatus, quién la abrió, a qué hora llegó, total) y abajo
// lo que ya se mandó a cocina, una tarjeta por envío con su hora, piezas y subtotal.
//   orden             → estatus (0 abierta, 1 pagando, 2 pagado), creado_en, abierta_por, total
//   orden_has_detalle → producto, cantidad y subtotal de cada renglón
// Las opciones y el grupo MIX también se recuperan de la base; cada producto conserva su detalle.
// Los envíos se acomodan según el ancho del componente (container queries): una columna en el historial
// de la tablet y dos o tres en la caja.
import React from 'react';
import { Clock, LucideIcon, Plus, Receipt, Send, Tablet } from 'lucide-react';
import { CATEGORIAS_QUESO_OPCIONAL, DetalleOrdenBD, ESTATUS_ORDEN, ExtraOrdenBD, nombreDetalle, OrdenBD, textoCarneExtra, textoComplementosExtra } from '../services/pedidosService';
import { iconoCategoria } from './iconosCategoria';
import { agruparMix } from '../services/pedidoMix';
import { ListaExtras } from './ListaExtras';
import { esQueso } from '../services/complementos';

export const COLOR_ESTATUS_ORDEN: Record<number, string> = {
  0: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  1: 'bg-amber-100 text-amber-800 border-amber-300',
  2: 'bg-neutral-200 text-neutral-700 border-neutral-300',
};

const dinero = (n: number) => `$${n.toFixed(2)}`;
const hora = (fecha: string) => new Date(fecha).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Quesadilla pedida sin queso (orden_has_detalle.sin_queso). La usan también la cuenta de caja y la tablet. */
export const EtiquetaSinQueso: React.FC = () => (
  <span className="shrink-0 rounded-md border border-violet-300 bg-violet-100 px-1.5 py-0.5 text-[11px] font-black tracking-wide text-violet-800">
    SIN QUESO
  </span>
);

export const EtiquetaConQueso: React.FC = () => (
  <span className="shrink-0 rounded-md border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[11px] font-black tracking-wide text-amber-800">
    CON QUESO
  </span>
);

export const EtiquetaConPapas: React.FC = () => (
  <span className="block text-xs font-semibold text-amber-800">CON PAPAS</span>
);

/** Complementos EXTRA: «EXTRA CREMA Y QUESO». */
export const EtiquetaComplementosExtra: React.FC<{ nombres: string[] }> = ({ nombres }) => (
  <span className="block text-xs font-black tracking-wide text-amber-800">{textoComplementosExtra(nombres)}</span>
);

/** Hamburguesa con DOBLE o TRIPLE CARNE (orden_has_detalle.carne_extra). */
export const EtiquetaCarneExtra: React.FC<{ carneExtra: number }> = ({ carneExtra }) => (
  <span className="shrink-0 rounded-md border border-red-300 bg-red-100 px-1.5 py-0.5 text-[11px] font-black tracking-wide text-red-800">
    {textoCarneExtra(carneExtra)}
  </span>
);

interface Renglon {
  clave: number;
  cantidad: number;
  producto: string; // "Frijol" / "Milanesa (Grande)"
  sinQueso: boolean;
  conQueso: boolean;
  conPapas: boolean;
  complementosExtra: string[];
  mixGrupo: number | null;
  termino: string | null;
  sin: string[];
  carneExtra: number; // solo Hamburguesas: 1 doble, 2 triple
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
  extras?: ExtraOrdenBD[];
  className?: string;
  /** Si no hay nada enviado, muestra un botón para ir a agregar productos. */
  onAgregar?: () => void;
}

export const PedidoEnviado: React.FC<Props> = ({ orden, detalle, extras = [], className = '', onAgregar }) => {
  // Envíos: renglones con la misma hora de registro.
  const envios: Envio[] = [];
  detalle.forEach((d) => {
    const renglon: Renglon = {
      clave: d.idDetalle_Orden,
      cantidad: d.cantidad,
      producto: nombreDetalle(d),
      sinQueso: d.sin_queso,
      conQueso: d.con_queso,
      conPapas: !!d.opciones?.papas,
      complementosExtra: d.opciones?.complementosExtra?.map((c) => c.nombre) ?? [],
      mixGrupo: d.mix_grupo ?? null,
      termino: d.termino ?? null,
      // En tacos el queso no va de base: no se muestra «sin queso».
      sin: d.opciones?.sin?.filter((c) => !esQueso(c) || (!d.sin_queso && !CATEGORIAS_QUESO_OPCIONAL.includes(d.categoria))).map((c) => c.nombre) ?? [],
      carneExtra: d.carne_extra,
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
            <Dato icono={Send} valor={plural(new Set([...detalle.map((d) => d.creado_en), ...extras.map((e) => e.creado_en)]).size, 'envío', 'envíos')} />
          </div>
        </div>
        {/* ml-auto: si no cabe junto a los datos, baja de renglón pero sigue a la derecha */}
        <div className="ml-auto text-right">
          <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Total</div>
          <div className="text-3xl font-extrabold font-mono leading-tight">{dinero(orden?.total ?? 0)}</div>
        </div>
      </header>

      {/* Lo ya enviado a cocina */}
      {envios.length === 0 && extras.length === 0 ? (
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
                  {agruparMix(envio.renglones, (r) => r.mixGrupo).map((grupo, indice) => (
                    <React.Fragment key={grupo.grupo === null ? `suelto-${indice}` : `mix-${grupo.grupo}`}>
                      {grupo.grupo !== null && <li className="px-4 py-2 bg-violet-100 text-violet-900 font-bold text-sm">MIX</li>}
                      {grupo.lineas.map((r) => {
                    const Icono = iconoCategoria(r.categoria);
                    return (
                      <li key={r.clave} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5">
                        <span className="min-w-11 h-10 px-2 rounded-lg bg-amber-100 text-amber-900 font-mono text-base font-bold flex items-center justify-center">
                          {r.cantidad}
                        </span>
                        <span className="min-w-0">
                          {r.termino && <span className="block text-xs font-semibold text-orange-800">Término: {r.termino}</span>}
                          {r.conPapas && <EtiquetaConPapas />}
                          {r.complementosExtra.length > 0 && <EtiquetaComplementosExtra nombres={r.complementosExtra} />}
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className="font-semibold text-neutral-900 truncate">{r.producto}</span>
                            {r.sinQueso && <EtiquetaSinQueso />}
                            {r.conQueso && <EtiquetaConQueso />}
                            {r.carneExtra > 0 && <EtiquetaCarneExtra carneExtra={r.carneExtra} />}
                          </span>
                          {r.sin.length > 0 && <span className="block text-xs text-rose-700">Sin {r.sin.join(', ').toLowerCase()}</span>}
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
                    </React.Fragment>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <ListaExtras extras={extras} />
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
