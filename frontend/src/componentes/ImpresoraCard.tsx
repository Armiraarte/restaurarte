import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Printer, RefreshCw, XCircle } from 'lucide-react';
import { EstadoImpresion, imprimirPrueba, obtenerEstadoImpresion } from '../services/impresionService';

type Aviso = { tipo: 'ok' | 'error'; texto: string } | null;

export const ImpresoraCard: React.FC = () => {
  const [estado, setEstado] = useState<EstadoImpresion | null>(null);
  const [revisando, setRevisando] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);

  const revisar = useCallback(async () => {
    setRevisando(true);
    try {
      setEstado(await obtenerEstadoImpresion());
    } catch (err) {
      setEstado({ agente: false, error: (err as Error).message });
    } finally {
      setRevisando(false);
    }
  }, []);

  useEffect(() => {
    revisar();
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

  const impresora = estado?.ticket;
  const lista = !!impresora?.conectada;
  let estadoTexto = 'Revisando…';
  if (estado && !estado.agente) estadoTexto = estado.error || 'Agente de impresión sin conexión';
  else if (estado && !impresora) estadoTexto = 'No se detectó impresora de tickets';
  else if (impresora) estadoTexto = impresora.conectada ? 'Conectada' : 'Instalada pero desconectada';

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
          <Printer className="w-5 h-5 text-neutral-500" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-neutral-900 truncate">
            {impresora?.nombre ?? 'Impresora de tickets'}
          </div>
          <div
            className={`text-xs flex items-center gap-1 ${
              !estado ? 'text-neutral-500' : lista ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {estado && (lista ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />)}
            <span>{estadoTexto}</span>
            {impresora && <span className="text-neutral-400">· {impresora.puerto}</span>}
          </div>
          {aviso && (
            <div className={`text-xs mt-1 ${aviso.tipo === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}>
              {aviso.texto}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={revisar}
          disabled={revisando}
          title="Volver a detectar impresora"
          className="h-10 w-10 rounded-full flex items-center justify-center text-neutral-600 bg-neutral-100 hover:bg-neutral-200 disabled:opacity-50 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${revisando ? 'animate-spin' : ''}`} />
        </button>
        <button
          onClick={handlePrueba}
          disabled={imprimiendo || !lista}
          className="h-10 rounded-full px-5 text-sm font-semibold text-neutral-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-2"
        >
          {imprimiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
          Prueba de impresión
        </button>
      </div>
    </div>
  );
};
