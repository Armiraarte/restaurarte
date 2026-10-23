// Vista previa del ticket de cocina (como sale en la impresora de 80 mm), con imprimir y ver el JSON.
import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Braces, CheckCircle2, Loader2, Printer, X } from 'lucide-react';
import { Comanda } from '../types/pos';
import { TicketCocina } from '../types/ticketCocina';
import { construirTicketCocina, imprimirTicketCocina } from '../services/ticketCocinaService';
import { EncabezadoTicketRestaurante } from './Marca';

const hora = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
};

/** El ticket en papel: mismo orden y contenido que backend/src/ticketCocina.ts (lineasTicketCocina). */
export const TicketCocinaPapel: React.FC<{ ticket: TicketCocina }> = ({ ticket: t }) => (
  <div className="w-[300px] max-w-full mx-auto bg-white text-neutral-950 font-mono text-[13px] leading-snug px-4 py-5 shadow-md border border-neutral-200">
    <div className="mb-3"><EncabezadoTicketRestaurante /></div>
    <div className="text-center font-bold">COCINA</div>
    <div className="text-center text-2xl font-black uppercase leading-tight break-words">{t.mesa}</div>
    {t.para_llevar && <div className="text-center text-lg font-black">*** PARA LLEVAR ***</div>}

    <div className="border-t border-dashed border-neutral-400 my-2" />
    {/* Orden de cocina: control interno */}
    <div className="flex justify-between font-bold">
      <span>Orden cocina {t.orden_cocina}</span>
      <span>{hora(t.enviada_en)}</span>
    </div>
    <div className="flex justify-between">
      <span>{t.adicion ? `Ronda ${t.ronda} · ADICIÓN` : 'Pedido inicial'}</span>
      <span>{t.tablet}</span>
    </div>
    <div>Mesero: {t.mesero}</div>
    <div className="border-t border-dashed border-neutral-400 my-2" />

    {t.productos.map((p) => (
      <div key={p.partida_id} className="mb-2.5">
        <div className="text-base font-black leading-tight">
          {p.cantidad} {p.nombre}
        </div>
        {p.descripcion.map((d, i) => (
          <div key={i} className="pl-3">
            - {d}
          </div>
        ))}
        {p.notas && <div className="pl-3 font-bold">NOTA: {p.notas}</div>}
      </div>
    ))}

    {t.notas_generales && <div className="font-bold">NOTA GENERAL: {t.notas_generales}</div>}
    <div className="border-t border-dashed border-neutral-400 my-2" />
    <div className="flex justify-between font-bold">
      <span>Total de piezas</span>
      <span>{t.total_piezas}</span>
    </div>
    <div className="text-center text-[11px] text-neutral-500 mt-1">Control interno de cocina</div>
  </div>
);

export const TicketCocinaModal: React.FC<{ comanda: Comanda; onCerrar: () => void }> = ({ comanda, onCerrar }) => {
  const ticket = useMemo(() => construirTicketCocina(comanda), [comanda]);
  const [verJson, setVerJson] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  const imprimir = async () => {
    setImprimiendo(true);
    setAviso(null);
    try {
      const impresora = await imprimirTicketCocina(ticket);
      setAviso({ ok: true, texto: `Ticket enviado a ${impresora}.` });
    } catch (err) {
      setAviso({ ok: false, texto: err instanceof Error ? err.message : 'No se pudo imprimir.' });
    } finally {
      setImprimiendo(false);
    }
  };

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
        aria-label={`Ticket de cocina ${ticket.orden_cocina}`}
        className="w-full max-w-lg max-h-[90vh] bg-neutral-100 rounded-2xl shadow-xl flex flex-col overflow-hidden"
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3 bg-white border-b border-neutral-200">
          <div>
            <div className="font-bold">Ticket de cocina</div>
            <div className="text-xs text-neutral-500">
              {ticket.mesa} · Orden cocina {ticket.orden_cocina} (control interno)
            </div>
          </div>
          <button onClick={onCerrar} aria-label="Cerrar" className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          {verJson ? (
            <pre className="text-[11px] leading-snug bg-neutral-900 text-emerald-200 rounded-xl p-4 overflow-x-auto select-text">
              {JSON.stringify(ticket, null, 2)}
            </pre>
          ) : (
            <TicketCocinaPapel ticket={ticket} />
          )}
        </div>

        <div className="px-5 py-3 bg-white border-t border-neutral-200 space-y-2">
          {aviso && (
            <div
              className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${
                aviso.ok ? 'text-emerald-800 bg-emerald-50 border-emerald-200' : 'text-rose-700 bg-rose-50 border-rose-200'
              }`}
            >
              {aviso.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              {aviso.texto}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setVerJson((v) => !v)}
              className="h-10 px-3 rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50 flex items-center gap-1.5 cursor-pointer"
            >
              <Braces className="w-4 h-4" />
              {verJson ? 'Ver ticket' : 'Ver JSON'}
            </button>
            <button
              onClick={imprimir}
              disabled={imprimiendo}
              className="flex-1 h-10 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              {imprimiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              Imprimir ticket de cocina
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
