// Cajas: las órdenes del turno que pidieron la cuenta (orden.estatus = 1, PAGANDO) y están esperando el cobro.
// Se actualiza sola con los avisos en vivo (useMesasTurno → services/enVivo.ts).
import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { AlertTriangle, Banknote, Home, ListChecks, Loader2, Receipt, ShoppingBag } from 'lucide-react';
import { etiquetaMesaRegistrada } from '../services/mesasService';
import { useMesasTurno } from '../services/sincronizacion';
import { CuentaDetalle } from './CuentaDetalle';
import { CobrarOrden } from './CobrarOrden';

const PAGANDO = 1;
const dinero = (n: number) => `$${n.toFixed(2)}`;

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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {porCobrar.map((m) => {
            const paraLlevar = m.tipo_venta_id === 2;
            return (
              <div key={m.id} className="bg-white border border-amber-300 ring-2 ring-amber-100 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-2xl font-bold tracking-tight leading-tight break-words">{etiquetaMesaRegistrada(m)}</div>
                    <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-neutral-500">
                      {paraLlevar ? <ShoppingBag className="w-3.5 h-3.5" /> : <Home className="w-3.5 h-3.5" />}
                      {paraLlevar ? 'Para llevar' : 'Comer aquí'}
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
                <div className="grid grid-cols-[auto_1fr] gap-2">
                  <button
                    onClick={() => setCuentaAbierta(m.id)}
                    className="h-11 px-3 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ListChecks className="w-4 h-4" /> Ver cuenta
                  </button>
                  <button
                    onClick={() => setPorCobrarAbierta({ id: m.id, etiqueta: etiquetaMesaRegistrada(m), total: Number(m.total) })}
                    className="h-11 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-base font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Banknote className="w-5 h-5" /> Cobrar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {cuentaAbierta !== null && (
          <CuentaDetalle
            idOrden={cuentaAbierta}
            onCerrar={() => setCuentaAbierta(null)}
            acciones={(() => {
              const m = porCobrar.find((x) => x.id === cuentaAbierta);
              return m ? (
                <button
                  onClick={() => {
                    setCuentaAbierta(null);
                    setPorCobrarAbierta({ id: m.id, etiqueta: etiquetaMesaRegistrada(m), total: Number(m.total) });
                  }}
                  className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-lg font-bold flex items-center justify-center gap-2 cursor-pointer"
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
