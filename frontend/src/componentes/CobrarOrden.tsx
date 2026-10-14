// Cobrar una orden (Cajas): se captura con cuánto paga el cliente, se calcula el cambio y, al confirmar,
// la orden pasa a PAGADO (orden.estatus = 2) y se imprime el ticket de cobro.
//   POST /api/ordenes/:idOrden/cobrar        { recibido }
//   POST /api/ordenes/:idOrden/ticket-cobro  { recibido }  (reimprimir)
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Banknote, CheckCircle2, Delete, Loader2, Printer, X } from 'lucide-react';
import { cobrarOrden, reimprimirTicketCobro } from '../services/pedidosService';

const dinero = (n: number) => `$${n.toFixed(2)}`;
const BILLETES = [50, 100, 200, 500, 1000];

/** Deja solo un monto válido: dígitos, un punto y hasta dos decimales ("1,000.5" → "1000.5"). */
function limpiarMonto(valor: string): string {
  let v = valor.replace(/[^\d.]/g, '');
  const punto = v.indexOf('.');
  if (punto >= 0) v = v.slice(0, punto + 1) + v.slice(punto + 1).replace(/\./g, '').slice(0, 2);
  if (v.startsWith('.')) v = '0' + v;
  v = v.replace(/^0+(?=\d)/, '');
  return v.slice(0, 9);
}

interface Props {
  idOrden: number;
  etiqueta: string;
  total: number;
  onCerrar: () => void;
}

export const CobrarOrden: React.FC<Props> = ({ idOrden, etiqueta, total, onCerrar }) => {
  const [texto, setTexto] = useState(''); // monto recibido como se teclea
  const [cobrando, setCobrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<{ recibido: number; cambio: number; impresion: { ok: boolean; error?: string } } | null>(null);
  const [reimprimiendo, setReimprimiendo] = useState(false);

  const recibido = Number(texto) || 0;
  const falta = Math.max(0, Math.round((total - recibido) * 100) / 100);
  const cambio = Math.max(0, Math.round((recibido - total) * 100) / 100);
  const alcanza = recibido >= total && recibido > 0;

  const teclear = (t: string) => {
    setError(null);
    setTexto((v) => {
      if (t === '.' && v.includes('.')) return v;
      if (v.includes('.') && v.split('.')[1].length >= 2) return v; // máximo centavos
      if (v === '0' && t !== '.') return t;
      const nuevo = (v === '' && t === '.' ? '0' : v) + t;
      return nuevo.length > 9 ? v : nuevo;
    });
  };

  const cobrar = async () => {
    if (!alcanza || cobrando) return;
    setCobrando(true);
    setError(null);
    try {
      const r = await cobrarOrden(idOrden, recibido);
      setHecho({ recibido: r.cobro.recibido, cambio: r.cobro.cambio, impresion: r.impresion });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cobrar.');
    } finally {
      setCobrando(false);
    }
  };

  const reimprimir = async () => {
    if (!hecho) return;
    setReimprimiendo(true);
    try {
      const r = await reimprimirTicketCobro(idOrden, hecho.recibido);
      setHecho({ ...hecho, impresion: r.impresion });
    } catch (err) {
      setHecho({ ...hecho, impresion: { ok: false, error: err instanceof Error ? err.message : 'No se pudo imprimir.' } });
    } finally {
      setReimprimiendo(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={hecho || cobrando ? undefined : onCerrar}
    >
      <motion.div
        role="dialog"
        aria-label={`Cobrar ${etiqueta}`}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden"
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {hecho ? (
          /* Cobro realizado */
          <div className="p-6 space-y-4 text-center">
            <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-500" />
            <h2 className="text-xl font-bold">Cobrado · {etiqueta}</h2>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="bg-neutral-50 rounded-xl p-3">
                <div className="text-xs text-neutral-500">Total</div>
                <div className="font-mono font-bold">{dinero(total)}</div>
              </div>
              <div className="bg-neutral-50 rounded-xl p-3">
                <div className="text-xs text-neutral-500">Recibido</div>
                <div className="font-mono font-bold">{dinero(hecho.recibido)}</div>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3">
                <div className="text-xs text-emerald-700">Cambio</div>
                <div className="font-mono font-bold text-emerald-800 text-lg">{dinero(hecho.cambio)}</div>
              </div>
            </div>
            <div
              className={`flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border ${
                hecho.impresion.ok ? 'text-emerald-800 bg-emerald-50 border-emerald-200' : 'text-amber-800 bg-amber-50 border-amber-200'
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              {hecho.impresion.ok ? 'Ticket de cobro impreso.' : `No se imprimió el ticket: ${hecho.impresion.error ?? 'error'}`}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={reimprimir}
                disabled={reimprimiendo}
                className="h-12 rounded-xl border border-neutral-200 hover:bg-neutral-50 font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {reimprimiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} Reimprimir
              </button>
              <button onClick={onCerrar} className="h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer">
                Listo
              </button>
            </div>
          </div>
        ) : (
          /* Captura del monto */
          <>
            <div className="px-5 py-4 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <div className="text-xs text-neutral-500">Cobrar</div>
                <div className="text-lg font-bold">{etiqueta}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-neutral-500">Total</div>
                <div className="text-2xl font-bold font-mono">{dinero(total)}</div>
              </div>
              <button onClick={onCerrar} aria-label="Cerrar" className="ml-3 p-2 rounded-lg hover:bg-neutral-200 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Monto recibido y cambio */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border-2 border-amber-400 bg-amber-50/50 px-3 py-2">
                  <div className="text-xs text-neutral-500 flex items-center gap-1">
                    <Banknote className="w-3.5 h-3.5" /> Paga con
                  </div>
                  {/* Editable: se escribe con el teclado o con los botones de abajo; Enter cobra. */}
                  <label className="flex items-center text-2xl font-bold font-mono">
                    <span className={texto ? '' : 'text-neutral-300'}>$</span>
                    <input
                      autoFocus
                      inputMode="decimal"
                      aria-label="Monto con el que paga el cliente"
                      value={texto}
                      placeholder="0.00"
                      onChange={(e) => {
                        setError(null);
                        setTexto(limpiarMonto(e.target.value));
                      }}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') cobrar();
                      }}
                      className="w-full min-w-0 bg-transparent outline-none placeholder:text-neutral-300 select-text"
                    />
                  </label>
                </div>
                <div className={`rounded-xl border-2 px-3 py-2 ${alcanza ? 'border-emerald-300 bg-emerald-50' : 'border-neutral-200 bg-neutral-50'}`}>
                  <div className="text-xs text-neutral-500">{alcanza || !texto ? 'Cambio' : 'Falta'}</div>
                  <div className={`text-2xl font-bold font-mono ${alcanza ? 'text-emerald-700' : texto ? 'text-rose-600' : 'text-neutral-300'}`}>
                    {dinero(alcanza || !texto ? cambio : falta)}
                  </div>
                </div>
              </div>

              {/* Atajos: exacto y billetes */}
              <div className="grid grid-cols-6 gap-1.5">
                <button
                  onClick={() => setTexto(String(total))}
                  className="h-10 rounded-lg bg-neutral-900 text-white text-xs font-semibold cursor-pointer"
                >
                  Exacto
                </button>
                {BILLETES.map((b) => (
                  <button
                    key={b}
                    onClick={() => setTexto(String(b))}
                    className="h-10 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-sm font-mono font-semibold cursor-pointer"
                  >
                    ${b}
                  </button>
                ))}
              </div>

              {/* Teclado */}
              <div className="grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map((t) => (
                  <button
                    key={t}
                    onClick={() => teclear(t)}
                    className="h-12 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-xl font-semibold font-mono cursor-pointer"
                  >
                    {t}
                  </button>
                ))}
                <button
                  onClick={() => setTexto((v) => v.slice(0, -1))}
                  onDoubleClick={() => setTexto('')}
                  aria-label="Borrar"
                  className="h-12 rounded-xl bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center cursor-pointer"
                >
                  <Delete className="w-5 h-5" />
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <button
                onClick={cobrar}
                disabled={!alcanza || cobrando}
                className="w-full h-14 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-lg font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                {cobrando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}
                Cobrar e imprimir ticket
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
};
