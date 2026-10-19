// Entrada de la app de las tablets: sin usuario ni contraseña, se elige cuál tablet es (Tablet 01…05).
//   - Sin turno abierto en caja se queda esperando (revisa sola cada pocos segundos) y no deja elegir.
//   - En cuanto detecta el turno abierto se activan las tablets, y la que este dispositivo ya había elegido
//     entra sola (no hay que tocar nada cada turno).
//   - Una tablet que otra está usando aparece «En uso».
//   - Mientras espera, si se publicó una versión nueva de la app, se actualiza sola.
// Al hacer el corte de turno las tablets vuelven aquí solas.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, Tablet } from 'lucide-react';
import { Usuario } from '../services/authService';
import { entrarComoTablet, listarTablets, TabletSeleccionable, tabletRecordada } from '../services/accesoTablet';
import { cadaTantoVisible } from '../services/sincronizacion';
import { useVersionNueva } from '../services/pwaService';
import { LogoRestaurante } from './Marca';

const INTERVALO_MS = 3_000;

export const SeleccionTablet: React.FC<{ aviso?: string | null; onEntrar: (u: Usuario) => void }> = ({ aviso = null, onEntrar }) => {
  const [datos, setDatos] = useState<{ turnoAbierto: boolean; tablets: TabletSeleccionable[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [entrando, setEntrando] = useState<string | null>(null);
  const recordada = tabletRecordada();
  // Solo un intento automático por turno: si falla (p. ej. otra la tomó), se queda para elegir a mano.
  const intentoAutomatico = useRef(false);

  // Aquí no hay nada a medias: si salió una versión nueva de la app, se recarga sola.
  const versionNueva = useVersionNueva();
  useEffect(() => {
    if (versionNueva && entrando === null) window.location.reload();
  }, [versionNueva, entrando]);

  // Todo cabe en la pantalla, sin scroll (misma escala que el inicio de sesión, ver html.inicio-sesion).
  useEffect(() => {
    document.documentElement.classList.add('inicio-sesion');
    return () => document.documentElement.classList.remove('inicio-sesion');
  }, []);

  const cargar = useCallback(async () => {
    try {
      setDatos(await listarTablets());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar las tablets.');
    }
  }, []);

  // Se revisa sola cada pocos segundos: en cuanto caja abre el turno, ya se puede elegir.
  useEffect(() => {
    cargar();
    return cadaTantoVisible(cargar, INTERVALO_MS);
  }, [cargar]);

  const elegir = async (t: TabletSeleccionable) => {
    setEntrando(t.numero);
    setError(null);
    try {
      onEntrar(await entrarComoTablet(t.numero));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo entrar.');
      setEntrando(null);
      cargar();
    }
  };

  const turnoAbierto = !!datos?.turnoAbierto;
  const esta = recordada ? datos?.tablets.find((t) => Number(t.numero) === Number(recordada)) : undefined;

  // Al abrirse el turno, la tablet de este dispositivo entra sola si está libre.
  useEffect(() => {
    if (!turnoAbierto) {
      intentoAutomatico.current = false;
      return;
    }
    if (intentoAutomatico.current || entrando !== null || !esta || esta.enUso) return;
    intentoAutomatico.current = true;
    elegir(esta);
  }, [turnoAbierto, esta?.numero, esta?.enUso, entrando]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="h-dvh overflow-hidden flex flex-col bg-gradient-to-br from-red-600 via-red-700 to-red-900 text-crema select-none">
      <header className="shrink-0 flex items-center justify-center px-6 pt-6">
        <div className="w-[min(18rem,60vw)] bg-white rounded-2xl p-3 shadow-2xl shadow-black/40 ring-4 ring-white/20">
          <LogoRestaurante className="w-full" />
        </div>
      </header>

      <main className="flex-1 min-h-0 flex flex-col items-center justify-center gap-5 px-6 py-4">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-extrabold tracking-tight">¿Qué tablet es esta?</h1>
          {turnoAbierto ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-900 px-4 py-2 text-base font-bold">
              <CheckCircle2 className="w-5 h-5" /> Turno abierto · toca tu tablet
            </span>
          ) : (
            // Sin turno (o mientras revisa): se queda esperando hasta que caja lo abra.
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 text-amber-900 px-4 py-2 text-base font-bold">
              <Loader2 className="w-5 h-5 animate-spin" /> {datos === null ? 'Revisando el turno…' : 'Esperando a que caja inicie el turno…'}
            </span>
          )}
          {esta && !turnoAbierto && (
            <p className="text-base font-semibold text-crema/90">Al abrir el turno entra sola como {esta.nombre}.</p>
          )}
          {esta && turnoAbierto && entrando === esta.numero && (
            <p className="text-base font-semibold text-crema/90">Entrando como {esta.nombre}…</p>
          )}
        </div>

        {(aviso || error) && (
          <div
            role={error ? 'alert' : 'status'}
            className={`w-full max-w-2xl flex items-start gap-2.5 rounded-xl border px-4 py-3 text-base ${
              error ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            {error ? <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" /> : <Info className="w-5 h-5 shrink-0 mt-0.5" />}
            <span>{error ?? aviso}</span>
          </div>
        )}

        {/* Una tarjeta por tablet registrada (Tablet 01…05) */}
        <div className="w-full max-w-5xl grid gap-4 grid-cols-2 sm:grid-cols-3 landscape:grid-cols-5">
          {(datos?.tablets ?? []).map((t) => {
            const deshabilitada = !turnoAbierto || t.enUso || entrando !== null;
            return (
              <button
                key={t.numero}
                onClick={() => elegir(t)}
                disabled={deshabilitada}
                className={`aspect-[4/5] rounded-3xl border-4 flex flex-col items-center justify-center gap-3 p-3 transition-colors cursor-pointer disabled:cursor-not-allowed ${
                  t.enUso
                    ? 'bg-white/15 border-white/20 text-crema/60'
                    : turnoAbierto
                      ? 'bg-white border-emerald-400 text-neutral-900 hover:bg-emerald-50 shadow-xl shadow-black/30'
                      : 'bg-white/85 border-white/40 text-neutral-500'
                }`}
              >
                {entrando === t.numero ? <Loader2 className="w-12 h-12 animate-spin" /> : <Tablet className="w-12 h-12" />}
                <span className="text-2xl font-black">{t.nombre}</span>
                {t === esta && <span className="text-xs font-black tracking-wide uppercase text-red-700">Esta tablet</span>}
                <span
                  className={`rounded-full px-3 py-1 text-sm font-bold ${
                    t.enUso ? 'bg-black/30 text-crema' : turnoAbierto ? 'bg-emerald-600 text-white' : 'bg-neutral-200 text-neutral-600'
                  }`}
                >
                  {t.enUso ? 'En uso' : turnoAbierto ? 'Libre' : 'Sin turno'}
                </span>
              </button>
            );
          })}
        </div>
      </main>

      <footer className="shrink-0 pb-3 text-center text-xs text-crema/80">
        SOFT RESTAURANTE · Hecho por <strong className="font-bold tracking-wide text-crema">ARMIRARTE</strong>
      </footer>
    </div>
  );
};
