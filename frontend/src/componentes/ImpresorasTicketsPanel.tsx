import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Plug, Printer, RefreshCw, Unplug } from 'lucide-react';
import { EstadoImpresion, imprimirPrueba, obtenerEstadoImpresion } from '../services/impresionService';

const INTERVALO_REVISION_MS = 30_000;

type Aviso = { tipo: 'ok' | 'error'; texto: string } | null;

export const ImpresorasTicketsPanel: React.FC = () => {
  const [estado, setEstado] = useState<EstadoImpresion | null>(null);
  const [revisando, setRevisando] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [ultimaRevision, setUltimaRevision] = useState<string | null>(null);

  const revisar = useCallback(async () => {
    setRevisando(true);
    try {
      setEstado(await obtenerEstadoImpresion());
    } catch (err) {
      setEstado({ agente: false, error: (err as Error).message });
    } finally {
      setRevisando(false);
      setUltimaRevision(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }
  }, []);

  useEffect(() => {
    revisar();
    const id = setInterval(revisar, INTERVALO_REVISION_MS);
    return () => clearInterval(id);
  }, [revisar]);

  const handlePrueba = async () => {
    setImprimiendo(true);
    setAviso(null);
    try {
      const { impresora } = await imprimirPrueba();
      setAviso({ tipo: 'ok', texto: `Ticket de prueba enviado a ${impresora}.` });
    } catch (err) {
      setAviso({ tipo: 'error', texto: (err as Error).message });
    } finally {
      setImprimiendo(false);
      revisar();
    }
  };

  const ticket = estado?.ticket ?? null;
  // Solo impresoras físicas (USB) y la elegida para tickets; se omiten las virtuales (PDF, OneNote, etc.).
  const impresoras = (estado?.impresoras ?? [])
    .filter((i) => i.usb || i.nombre === ticket?.nombre)
    .sort((a, b) => Number(b.nombre === ticket?.nombre) - Number(a.nombre === ticket?.nombre));
  const conectadas = impresoras.filter((i) => i.conectada).length;
  const desconectadas = impresoras.length - conectadas;

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Printer className="w-5 h-5 text-amber-500" />
            <span>Impresoras de tickets</span>
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {!estado ? (
              'Revisando…'
            ) : !estado.agente ? (
              <span className="text-rose-700 font-medium">Agente de impresión sin conexión</span>
            ) : (
              <>
                <span className="text-emerald-700 font-medium">{conectadas} conectadas</span>
                {' · '}
                <span className={desconectadas > 0 ? 'text-rose-700 font-medium' : ''}>{desconectadas} desconectadas</span>
              </>
            )}
            {ultimaRevision && <span className="text-neutral-400"> · Revisado a las {ultimaRevision}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          <button
            onClick={revisar}
            disabled={revisando}
            className="px-3.5 py-1.5 text-xs font-semibold text-sky-800 bg-sky-50 border border-sky-200 rounded-lg hover:bg-sky-100 disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${revisando ? 'animate-spin' : ''}`} />
            Volver a revisar
          </button>
          <button
            onClick={handlePrueba}
            disabled={imprimiendo || !ticket?.conectada}
            className="px-3.5 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1.5"
          >
            {imprimiendo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
            Prueba de impresión
          </button>
        </div>
      </div>

      {aviso && (
        <div
          className={`text-xs px-3 py-2 rounded-lg border ${
            aviso.tipo === 'ok'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {aviso.texto}
        </div>
      )}

      {!estado ? (
        <div className="text-center text-sm text-neutral-500 py-10 border border-dashed border-neutral-300 rounded-lg flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Buscando impresoras…
        </div>
      ) : !estado.agente ? (
        <div className="text-center text-sm text-rose-700 py-10 border border-dashed border-rose-300 bg-rose-50/40 rounded-lg px-4">
          {estado.error || 'No se pudo conectar con el agente de impresión.'}
        </div>
      ) : impresoras.length === 0 ? (
        <div className="text-center text-sm text-neutral-500 py-10 border border-dashed border-neutral-300 rounded-lg">
          No se detectó ninguna impresora de tickets.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {impresoras.map((imp) => {
            const enUso = imp.nombre === ticket?.nombre;
            return (
              <div
                key={imp.nombre}
                className={`border rounded-xl p-4 space-y-3 ${
                  imp.conectada ? 'border-neutral-200' : 'border-rose-200 bg-rose-50/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                      {enUso ? 'En uso para tickets' : 'Impresora'}
                    </div>
                    <div className="text-sm font-bold text-neutral-900 truncate" title={imp.nombre}>
                      {imp.nombre}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                      imp.conectada
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {imp.conectada ? <Plug className="w-3 h-3" /> : <Unplug className="w-3 h-3" />}
                    {imp.conectada ? 'Conectada' : 'Desconectada'}
                  </span>
                </div>

                <div className="text-xs text-neutral-600 border-t border-neutral-100 pt-3 space-y-0.5">
                  <div className="truncate" title={imp.driver}>
                    Driver: <span className="text-neutral-900">{imp.driver}</span>
                  </div>
                  <div>
                    Puerto: <span className="font-mono text-neutral-900">{imp.puerto}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
