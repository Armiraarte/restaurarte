// Ventas: las órdenes ya cobradas (orden.estatus = 2, PAGADO) del turno abierto, con su total y la opción
// de reimprimir el ticket de cobro. Se actualiza sola con los avisos en vivo (useMesasTurno).
import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Eye, Home, Loader2, Printer, ShoppingBag, TrendingUp } from 'lucide-react';
import { etiquetaMesaRegistrada, MesaRegistrada } from '../services/mesasService';
import { useMesasTurno, useTurnoActual } from '../services/sincronizacion';
import { reimprimirTicketCobro } from '../services/pedidosService';
import { CuentaDetalle } from './CuentaDetalle';
import { ListaPaginada } from './ListaPaginada';

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
    <div data-ventas className="h-full min-h-0 flex flex-col gap-2">
      <div className="shrink-0">
        <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-amber-500" />
          <span>Ventas</span>
        </h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          {turno ? `Órdenes cobradas en el turno #${turno.idTurno}` : turno === null ? 'No hay turno abierto.' : 'Cargando turno…'}
        </p>
      </div>

      {/* Resumen del turno */}
      <div className="shrink-0 grid grid-cols-2 gap-2">
        <div className="bg-neutral-900 text-white rounded-xl px-4 py-2">
          <div className="text-xs text-neutral-400">Vendido en el turno</div>
          <div className="text-xl sm:text-2xl font-bold font-mono">{dinero(totalVentas)}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl px-4 py-2">
          <div className="text-xs text-neutral-500">Órdenes cobradas</div>
          <div className="text-xl sm:text-2xl font-bold font-mono">{pagadas.length}</div>
        </div>
      </div>

      {error && (
        <div className="shrink-0 flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
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
        <div className="flex-1 min-h-0 flex flex-col bg-white border border-neutral-200 rounded-2xl overflow-hidden">
          <ListaPaginada items={pagadas} etiqueta="ventas" altoFila={64} columnas={500} clave={(m) => m.id} renderizar={(m) => {
            const paraLlevar = m.tipo_venta_id === 2;
            const imp = impresion[m.id];
            return (
              <div data-venta={m.id} className="h-full border-b border-neutral-100 flex items-center gap-3 px-1">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="w-8 h-8 shrink-0 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate" title={etiquetaMesaRegistrada(m)}>{etiquetaMesaRegistrada(m)}</div>
                    {imp && !imp.cargando && imp.texto ? <p role="status" title={imp.texto} className={`truncate text-[11px] ${imp.ok ? 'text-emerald-700' : 'text-amber-700'}`}>{imp.texto}</p> : (
                      <div className="text-[11px] text-neutral-500 flex items-center gap-1">
                        {paraLlevar ? <ShoppingBag className="w-3 h-3 shrink-0" /> : <Home className="w-3 h-3 shrink-0" />}
                        <span className="truncate" title={`Orden #${m.id} · cobrada ${hora(m.actualizado_en)}`}>#{m.id} · {hora(m.actualizado_en)}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-sm font-bold font-mono">{dinero(Number(m.total))}</div>
                <div className="shrink-0 flex items-center gap-1.5">
                  <button
                    onClick={() => setVerCuenta(m.id)}
                    aria-label={`Ver cuenta de ${etiquetaMesaRegistrada(m)} · Orden #${m.id}`}
                    className="h-8 px-2 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-4 h-4" /> Ver
                  </button>
                  <button
                    onClick={() => reimprimir(m)}
                    disabled={imp?.cargando}
                    aria-label={`Reimprimir ticket de ${etiquetaMesaRegistrada(m)} · Orden #${m.id}`}
                    className="h-8 px-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {imp?.cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} Reimprimir
                  </button>
                </div>
              </div>
            );
          }} />
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
