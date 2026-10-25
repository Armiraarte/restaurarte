// Vista previa del ticket de cocina (como sale en la impresora de 80 mm), con imprimir y ver el JSON.
import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Braces, CheckCircle2, Loader2, Printer, X } from 'lucide-react';
import { Comanda } from '../types/pos';
import { TicketCocina } from '../types/ticketCocina';
import { construirTicketCocina, imprimirTicketCocina } from '../services/ticketCocinaService';
import { agruparMix } from '../services/pedidoMix';
import { formatoProductoCocina, indicacionComanda, mayusculasComanda } from '../services/formatoProductoCocina';

/** El ticket en papel: mismo orden y contenido que backend/src/ticketCocina.ts (lineasTicketCocina). */
export const TicketCocinaPapel: React.FC<{ ticket: TicketCocina }> = ({ ticket: t }) => {
  const grupos = agruparMix(t.productos, (p) => p.mix_grupo);
  const extrasEnMix = (t.extras ?? []).filter((e) => e.mix_grupo != null && grupos.some((g) => g.grupo === e.mix_grupo));
  const extrasFinales = (t.extras ?? []).filter((e) => !extrasEnMix.includes(e));
  const separador = <div className="border-t border-dashed border-neutral-400 my-2" />;
  const extra = (e: NonNullable<TicketCocina['extras']>[number], i: number) => <div key={i} className="flex justify-between gap-2 text-[19px] font-bold"><span className="min-w-0 break-words">{mayusculasComanda(e.descripcion)}</span><span className="shrink-0">${e.importe.toFixed(2)}</span></div>;
  return (
  <div className="w-[300px] max-w-full mx-auto bg-white text-neutral-950 font-mono text-[13px] leading-snug px-4 py-5 shadow-md border border-neutral-200">
    {/* Cocina: ≈3 cm en blanco arriba para colgarla (RENGLONES_PARA_COLGAR en backend/src/ticketCocina.ts) */}
    {t.area !== 'bebidas' && <div aria-hidden="true" className="h-[120px]" />}
    <div>{t.area === 'bebidas' ? 'BEBIDAS' : 'ORDEN COCINA'} {mayusculasComanda(t.orden_cocina)}{t.tablet && ` · ${mayusculasComanda(t.tablet)}`}</div>
    <div className="text-[26px] leading-tight break-words">{mayusculasComanda(t.mesa)}</div>
    {t.para_llevar && <div className="text-[21px]">PARA LLEVAR</div>}
    {separador}
    {grupos.map((g, i) => <React.Fragment key={i}>
      {g.grupo !== null && <>{separador}<div className="text-xl font-bold">MIX</div></>}
      {g.lineas.map((p) => { const formato = formatoProductoCocina(p); return <div key={p.partida_id} className="text-[19px] mb-1 break-words">
        {formato.renglones.map((r, j) => <div key={j} className="font-bold">{r.cantidad} {r.nombre}</div>)}
        {formato.descripcion.map((d, j) => <div key={j} className={`pl-3${/^EXTRA\b/i.test(d.trim()) ? ' font-bold' : ''}`}>- {d}</div>)}
        {p.notas && <div className="text-[13px] pl-3 font-bold">NOTA: {indicacionComanda(p.notas)}</div>}
      </div>; })}
      {extrasEnMix.filter((e) => e.mix_grupo === g.grupo).map((e, j) => extra({ ...e, descripcion: `+ ${e.descripcion}` }, j))}
      {g.grupo !== null && separador}
    </React.Fragment>)}
    {t.notas_generales && <>{separador}<div className="font-bold">NOTA: {indicacionComanda(t.notas_generales)}</div></>}
    {extrasFinales.length > 0 && <>{separador}<div className="font-bold">EXTRAS</div>{extrasFinales.map(extra)}</>}
  </div>
  );
};

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
