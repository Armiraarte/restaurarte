// Ventas: las órdenes ya cobradas (orden.estatus = 2, PAGADO) del turno abierto, con su total y la opción
// de reimprimir el ticket de cobro. Se actualiza sola con los avisos en vivo (useMesasTurno).
import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Eye, Home, Loader2, Printer, ShoppingBag, TrendingUp } from 'lucide-react';
import { etiquetaMesaRegistrada, MesaRegistrada } from '../services/mesasService';
import { useMesasTurno, useTurnoActual } from '../services/sincronizacion';
import { reimprimirTicketCobro } from '../services/pedidosService';
import { CuentaDetalle } from './CuentaDetalle';

const PAGADO = 2;
const dinero = (n: number) => `$${n.toFixed(2)}`;
const hora = (fecha?: string) => (fecha ? new Date(fecha).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' }) : '—');

type EstadoImpresion = { cargando: boolean; ok?: boolean; texto?: string };

export const VentasView: React.FC = () => {
  const turno = useTurnoActual();
  const { mesas, error } = useMesasTurno();
  // Más recientes primero (hora de cobro = última actualización de la orden).
  const pagadas = (mesas ?? [])
    .filter((m) => m.estatus === PAGADO)
    .sort((a, b) => String(b.actualizado_en ?? '').localeCompare(String(a.actualizado_en ?? '')));
  const totalVentas = pagadas.reduce((acc, m) => acc + Number(m.total), 0);

  const [verCuenta, setVerCuenta] = useState<number | null>(null);
  const [impresion, setImpresion] = useState<Record<number, EstadoImpresion>>({});

  const reimprimir = async (m: MesaRegistrada) => {
    setImpresion((s) => ({ ...s, [m.id]: { cargando: true } }));
    try {
      const r = await reimprimirTicketCobro(m.id);
      setImpresion((s) => ({ ...s, [m.id]: { cargando: false, ok: r.impresion.ok, texto: r.impresion.ok ? 'Impreso' : r.impresion.error } }));
    } catch (err) {
      setImpresion((s) => ({ ...s, [m.id]: { cargando: false, ok: false, texto: err instanceof Error ? err.message : 'No se imprimió' } }));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-amber-500" />
          <span>Ventas</span>
        </h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          {turno ? `Órdenes cobradas en el turno #${turno.idTurno}` : turno === null ? 'No hay turno abierto.' : 'Cargando turno…'}
        </p>
      </div>

      {/* Resumen del turno */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-neutral-900 text-white rounded-2xl p-4">
          <div className="text-xs text-neutral-400">Vendido en el turno</div>
          <div className="text-2xl sm:text-3xl font-bold font-mono">{dinero(totalVentas)}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-2xl p-4">
          <div className="text-xs text-neutral-500">Órdenes cobradas</div>
          <div className="text-2xl sm:text-3xl font-bold font-mono">{pagadas.length}</div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {mesas === null ? (
        <div className="py-16 flex justify-center text-neutral-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : pagadas.length === 0 ? (
        <div className="bg-white border border-dashed border-neutral-300 rounded-2xl py-16 px-4 text-center text-sm text-neutral-500">
          Aún no se ha cobrado ninguna orden en este turno.
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden divide-y divide-neutral-100">
          {pagadas.map((m) => {
            const paraLlevar = m.tipo_venta_id === 2;
            const imp = impresion[m.id];
            return (
              <div key={m.id} className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex items-center gap-3 flex-1 min-w-48">
                  <span className="w-10 h-10 shrink-0 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="font-bold truncate">{etiquetaMesaRegistrada(m)}</div>
                    <div className="text-xs text-neutral-500 flex items-center gap-1.5">
                      {paraLlevar ? <ShoppingBag className="w-3.5 h-3.5" /> : <Home className="w-3.5 h-3.5" />}
                      Orden #{m.id} · cobrada {hora(m.actualizado_en)}
                    </div>
                  </div>
                </div>
                <div className="text-lg font-bold font-mono">{dinero(Number(m.total))}</div>
                <div className="flex items-center gap-2">
                  {imp && !imp.cargando && (
                    <span className={`text-xs font-medium ${imp.ok ? 'text-emerald-700' : 'text-amber-700'}`}>{imp.texto}</span>
                  )}
                  <button
                    onClick={() => setVerCuenta(m.id)}
                    className="h-10 px-3 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-sm font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-4 h-4" /> Ver
                  </button>
                  <button
                    onClick={() => reimprimir(m)}
                    disabled={imp?.cargando}
                    className="h-10 px-3 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {imp?.cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} Reimprimir ticket
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {verCuenta !== null && (
          <CuentaDetalle
            idOrden={verCuenta}
            onCerrar={() => setVerCuenta(null)}
            acciones={
              <button
                onClick={() => {
                  const m = pagadas.find((x) => x.id === verCuenta);
                  if (m) reimprimir(m);
                }}
                className="w-full h-12 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" /> Reimprimir ticket
              </button>
            }
          />
        )}
      </AnimatePresence>
    </div>
  );
};
