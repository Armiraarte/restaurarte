// Lado admin: tablets que iniciaron sesión con su cuenta y botón "Verificar conexión".
import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RadioTower, Wifi, WifiOff } from 'lucide-react';
import { listarTabletsEnLinea, pedirVerificacion, TabletEnLinea } from '../services/tabletsService';

const INTERVALO_MS = 3_000;

export const TabletsEnLineaPanel: React.FC = () => {
  const [tablets, setTablets] = useState<TabletEnLinea[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setTablets(await listarTabletsEnLinea());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar.');
    }
  }, []);

  useEffect(() => {
    cargar();
    const id = setInterval(cargar, INTERVALO_MS);
    return () => clearInterval(id);
  }, [cargar]);

  const verificar = async (usuarioId: string) => {
    setEnviando(usuarioId);
    try {
      const actualizada = await pedirVerificacion(usuarioId);
      setTablets((lista) => lista?.map((t) => (t.usuarioId === usuarioId ? actualizada : t)) ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la verificación.');
    } finally {
      setEnviando(null);
    }
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
      <div>
        <h2 className="text-base font-bold tracking-tight flex items-center gap-2">
          <RadioTower className="w-5 h-5 text-sky-600" />
          Tablets en línea
        </h2>
        <p className="text-xs text-neutral-500 mt-0.5">Cuentas de tablet con sesión iniciada. Se actualiza cada pocos segundos.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {tablets === null ? (
        <div className="py-6 flex justify-center text-neutral-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : tablets.length === 0 ? (
        <div className="text-center text-sm text-neutral-500 py-8 border border-dashed border-neutral-300 rounded-lg">
          Ninguna tablet ha iniciado sesión.
        </div>
      ) : (
        <ul className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg">
          {tablets.map((t) => {
            const v = t.verificacion;
            const pendiente = v?.estado === 'pendiente';
            return (
              <li key={t.usuarioId} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      t.conectada ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'
                    }`}
                  >
                    {t.conectada ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {t.nombre}
                      {t.tablet && <span className="ml-1.5 font-mono text-xs text-neutral-500">#{t.tablet}</span>}
                    </div>
                    <div className="text-xs text-neutral-500 truncate">
                      {t.conectada ? 'En línea' : 'Sin conexión'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {v && (
                    <span className={`text-xs flex items-center gap-1 ${pendiente ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {pendiente ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Esperando respuesta…
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Verificada
                          {v.respuestaMs !== null && ` · ${(v.respuestaMs / 1000).toFixed(1)} s`}
                        </>
                      )}
                    </span>
                  )}
                  <button
                    onClick={() => verificar(t.usuarioId)}
                    disabled={!t.conectada || pendiente || enviando === t.usuarioId}
                    className="h-9 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-neutral-200 disabled:text-neutral-500 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Wifi className="w-4 h-4" />
                    Verificar conexión
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
