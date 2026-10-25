// Cajas: las órdenes del turno que pidieron la cuenta (orden.estatus = 1, PAGANDO) y están esperando el cobro,
// agrupadas por tipo de venta: Comer aquí (verde) y Para llevar (morado).
// Se actualiza sola con los avisos en vivo (useMesasTurno → services/enVivo.ts).
import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { AlertTriangle, Banknote, Home, ListChecks, Loader2, LucideIcon, Receipt, ShoppingBag, Split } from 'lucide-react';
import { etiquetaMesaRegistrada, MesaRegistrada } from '../services/mesasService';
import { useMesasTurno } from '../services/sincronizacion';
import { CuentaDetalle } from './CuentaDetalle';
import { CobrarOrden } from './CobrarOrden';

const PAGANDO = 1;
const PARA_LLEVAR = 2; // orden.tipo_venta_id
const dinero = (n: number) => `$${n.toFixed(2)}`;

interface TipoVenta {
  titulo: string;
  Icono: LucideIcon;
  esDelTipo: (m: MesaRegistrada) => boolean;
  icono: string; // cuadro del ícono en el encabezado del grupo
  colorTitulo: string;
  linea: string;
  tarjeta: string;
  etiqueta: string;
  cobrar: string;
}

// Clases completas para que Tailwind las genere. Tonos oscuros en los botones para que el texto blanco se lea bien.
const TIPOS_VENTA: TipoVenta[] = [
  {
    titulo: 'Comer aquí',
    Icono: Home,
    esDelTipo: (m) => m.tipo_venta_id !== PARA_LLEVAR,
    icono: 'bg-emerald-700 text-white',
    colorTitulo: 'text-emerald-900',
    linea: 'bg-emerald-200',
    tarjeta: 'border-emerald-300 border-l-emerald-600 ring-emerald-100',
    etiqueta: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    cobrar: 'bg-emerald-700 hover:bg-emerald-600',
  },
  {
    titulo: 'Para llevar',
    Icono: ShoppingBag,
    esDelTipo: (m) => m.tipo_venta_id === PARA_LLEVAR,
    icono: 'bg-violet-600 text-white',
    colorTitulo: 'text-violet-900',
    linea: 'bg-violet-200',
    tarjeta: 'border-violet-300 border-l-violet-600 ring-violet-100',
    etiqueta: 'bg-violet-50 text-violet-800 border-violet-200',
    cobrar: 'bg-violet-600 hover:bg-violet-500',
  },
];

export const CajasView: React.FC = () => {
  const { mesas, error } = useMesasTurno();
  const porCobrar = (mesas ?? []).filter((m) => m.estatus === PAGANDO);
  const totalPorCobrar = porCobrar.reduce((acc, m) => acc + Number(m.total), 0);
  const [cuentaAbierta, setCuentaAbierta] = useState<number | null>(null);
  // Se guarda la orden al abrir el cobro: al cobrarla deja de estar en la lista (PAGADO) pero la pantalla sigue.
  const [porCobrarAbierta, setPorCobrarAbierta] = useState<{ id: number; etiqueta: string; total: number } | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Receipt className="w-5 h-5 text-amber-500" />
          <span>Cajas</span>
        </h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          {porCobrar.length} {porCobrar.length === 1 ? 'orden pidió' : 'órdenes pidieron'} la cuenta · por cobrar{' '}
          <span className="font-mono font-semibold text-neutral-800">{dinero(totalPorCobrar)}</span>
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {mesas === null ? (
        <div className="py-16 flex justify-center text-neutral-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : porCobrar.length === 0 ? (
        <div className="bg-white border border-dashed border-neutral-300 rounded-2xl py-16 px-4 text-center text-sm text-neutral-500">
          Ninguna orden ha pedido la cuenta. Aparecerán aquí en cuanto una tablet toque «PEDIR CUENTA».
        </div>
      ) : (
        TIPOS_VENTA.map((tipo) => {
          const ordenes = porCobrar.filter(tipo.esDelTipo);
          if (ordenes.length === 0) return null;
          const subtotal = ordenes.reduce((acc, m) => acc + Number(m.total), 0);
          return (
            <section key={tipo.titulo} aria-label={tipo.titulo} className="space-y-3">
              <div className="flex items-center gap-3">
                <span className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center shadow-sm ${tipo.icono}`}>
                  <tipo.Icono className="w-5 h-5" />
                </span>
                <div>
                  <h3 className={`text-lg font-bold leading-tight ${tipo.colorTitulo}`}>{tipo.titulo}</h3>
                  <p className="text-xs text-neutral-600">
                    {ordenes.length} {ordenes.length === 1 ? 'orden' : 'órdenes'} · por cobrar{' '}
                    <span className="font-mono font-semibold text-neutral-900">{dinero(subtotal)}</span>
                  </p>
                </div>
                <span className={`flex-1 h-px ${tipo.linea}`} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {ordenes.map((m) => (
                  <div key={m.id} className={`bg-white border border-l-[6px] ring-2 rounded-xl p-4 flex flex-col gap-3 ${tipo.tarjeta}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-2xl font-bold tracking-tight leading-tight break-words">{etiquetaMesaRegistrada(m)}</div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${tipo.etiqueta}`}>
                            <tipo.Icono className="w-3.5 h-3.5" />
                            {tipo.titulo}
                          </span>
                          {(m.cuentas_divididas ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border bg-violet-100 text-violet-800 border-violet-300">
                              <Split className="w-3.5 h-3.5" /> DIVIDIDA EN {m.cuentas_divididas}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="shrink-0 text-[11px] font-bold tracking-wide px-2 py-0.5 rounded-full border bg-amber-100 text-amber-800 border-amber-300">
                        PAGANDO
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between border-t border-neutral-100 pt-3">
                      <span className="text-xs text-neutral-500">Total a cobrar</span>
                      <span className="text-xl font-bold font-mono">{dinero(Number(m.total))}</span>
                    </div>
                    {/* Cuenta dividida: lo que paga cada persona (su ticket ya se imprimió) */}
                    {m.partes_divididas && m.partes_divididas.length > 0 && (
                      <ul aria-label="Cuentas divididas" className="grid grid-cols-2 gap-1 -mt-1">
                        {m.partes_divididas.map((p) => (
                          <li key={p.numero} className="flex items-baseline justify-between gap-1 px-2 py-1 rounded-md bg-violet-50 text-violet-900 text-xs">
                            <span className="font-semibold">Cuenta {p.numero}</span>
                            <span className="font-mono font-bold">{dinero(p.importe)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="grid grid-cols-[auto_1fr] gap-2">
                      <button
                        onClick={() => setCuentaAbierta(m.id)}
                        className="h-11 px-3 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <ListChecks className="w-4 h-4" /> Ver cuenta
                      </button>
                      <button
                        onClick={() => setPorCobrarAbierta({ id: m.id, etiqueta: etiquetaMesaRegistrada(m), total: Number(m.total) })}
                        className={`h-11 rounded-lg text-white text-base font-bold flex items-center justify-center gap-1.5 cursor-pointer ${tipo.cobrar}`}
                      >
                        <Banknote className="w-5 h-5" /> Cobrar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })
      )}

      <AnimatePresence>
        {cuentaAbierta !== null && (
          <CuentaDetalle
            idOrden={cuentaAbierta}
            onCerrar={() => setCuentaAbierta(null)}
            acciones={(() => {
              const m = porCobrar.find((x) => x.id === cuentaAbierta);
              const tipo = m && (TIPOS_VENTA.find((t) => t.esDelTipo(m)) ?? TIPOS_VENTA[0]);
              return m && tipo ? (
                <button
                  onClick={() => {
                    setCuentaAbierta(null);
                    setPorCobrarAbierta({ id: m.id, etiqueta: etiquetaMesaRegistrada(m), total: Number(m.total) });
                  }}
                  className={`w-full h-12 rounded-xl text-white text-lg font-bold flex items-center justify-center gap-2 cursor-pointer ${tipo.cobrar}`}
                >
                  <Banknote className="w-5 h-5" /> Cobrar
                </button>
              ) : null;
            })()}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {porCobrarAbierta && (
          <CobrarOrden
            idOrden={porCobrarAbierta.id}
            etiqueta={porCobrarAbierta.etiqueta}
            total={porCobrarAbierta.total}
            onCerrar={() => setPorCobrarAbierta(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
