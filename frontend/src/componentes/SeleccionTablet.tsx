// Entrada de la app de las tablets: en vez de usuario y PIN, se elige cuál tablet es (Tablet 01…05).
//   - Sin turno abierto en caja no se puede elegir: se espera y se revisa sola cada pocos segundos.
//   - Una tablet que otra está usando aparece «En uso».
//   - La primera vez, el dispositivo se autoriza con el usuario y la contraseña de caja (services/accesoTablet.ts).
// Al hacer el corte de turno las tablets vuelven aquí solas.
import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Info, KeyRound, Loader2, Lock, Tablet, User, X } from 'lucide-react';
import { Usuario } from '../services/authService';
import {
  autorizarEsteDispositivo,
  dispositivoAutorizado,
  entrarComoTablet,
  listarTablets,
  SinAutorizarError,
  TabletSeleccionable,
} from '../services/accesoTablet';
import { cadaTantoVisible } from '../services/sincronizacion';
import { LogoRestaurante } from './Marca';

const INTERVALO_MS = 4_000;

export const SeleccionTablet: React.FC<{ aviso?: string | null; onEntrar: (u: Usuario) => void }> = ({ aviso = null, onEntrar }) => {
  const [autorizado, setAutorizado] = useState(dispositivoAutorizado);
  const [datos, setDatos] = useState<{ turnoAbierto: boolean; tablets: TabletSeleccionable[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [entrando, setEntrando] = useState<string | null>(null);
  const [autorizando, setAutorizando] = useState(false);

  // Todo cabe en la pantalla, sin scroll (misma escala que el inicio de sesión, ver html.inicio-sesion).
  useEffect(() => {
    document.documentElement.classList.add('inicio-sesion');
    return () => document.documentElement.classList.remove('inicio-sesion');
  }, []);

  const cargar = useCallback(async () => {
    if (!dispositivoAutorizado()) return;
    try {
      setDatos(await listarTablets());
      setError(null);
    } catch (err) {
      if (err instanceof SinAutorizarError) setAutorizado(false);
      else setError(err instanceof Error ? err.message : 'No se pudo cargar las tablets.');
    }
  }, []);

  useEffect(() => {
    if (!autorizado) return;
    cargar();
    return cadaTantoVisible(cargar, INTERVALO_MS);
  }, [autorizado, cargar]);

  const elegir = async (t: TabletSeleccionable) => {
    setEntrando(t.numero);
    setError(null);
    try {
      onEntrar(await entrarComoTablet(t.numero));
    } catch (err) {
      if (err instanceof SinAutorizarError) setAutorizado(false);
      setError(err instanceof Error ? err.message : 'No se pudo entrar.');
      setEntrando(null);
      cargar();
    }
  };

  const turnoAbierto = !!datos?.turnoAbierto;

  return (
    <div className="h-dvh overflow-hidden flex flex-col bg-gradient-to-br from-red-600 via-red-700 to-red-900 text-crema select-none">
      <header className="shrink-0 flex items-center justify-center px-6 pt-6">
        <div className="w-[min(18rem,60vw)] bg-white rounded-2xl p-3 shadow-2xl shadow-black/40 ring-4 ring-white/20">
          <LogoRestaurante className="w-full" />
        </div>
      </header>

      <main className="flex-1 min-h-0 flex flex-col items-center justify-center gap-5 px-6 py-4">
        {!autorizado ? (
          // Primera vez en este dispositivo: lo autoriza alguien de caja.
          <div className="w-full max-w-md bg-white text-neutral-900 rounded-3xl shadow-xl p-6 space-y-4 text-center">
            <Lock className="w-10 h-10 mx-auto text-red-700" />
            <div>
              <h1 className="text-2xl font-extrabold">Autoriza esta tablet</h1>
              <p className="mt-1 text-base text-neutral-600">Solo una vez: alguien de caja escribe su usuario y contraseña.</p>
            </div>
            <button
              onClick={() => setAutorizando(true)}
              className="w-full h-14 rounded-2xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-lg font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <KeyRound className="w-6 h-6" /> Autorizar tablet
            </button>
          </div>
        ) : (
          <>
            <div className="text-center space-y-3">
              <h1 className="text-4xl font-extrabold tracking-tight">¿Qué tablet es esta?</h1>
              {datos === null ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-black/25 px-4 py-2 text-base font-semibold">
                  <Loader2 className="w-5 h-5 animate-spin" /> Revisando el turno…
                </span>
              ) : turnoAbierto ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-900 px-4 py-2 text-base font-bold">
                  <CheckCircle2 className="w-5 h-5" /> Turno abierto · toca tu tablet
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 text-amber-900 px-4 py-2 text-base font-bold">
                  <Clock className="w-5 h-5" /> Esperando a que caja inicie el turno…
                </span>
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
          </>
        )}
      </main>

      <footer className="shrink-0 pb-3 text-center text-xs text-crema/80">
        SOFT RESTAURANTE · Hecho por <strong className="font-bold tracking-wide text-crema">ARMIRARTE</strong>
      </footer>

      {autorizando && (
        <DialogoAutorizar
          onListo={() => {
            setAutorizando(false);
            setAutorizado(true);
          }}
          onCancelar={() => setAutorizando(false)}
        />
      )}
    </div>
  );
};

/** Usuario y contraseña de caja (admin o cajero) para autorizar este dispositivo. */
function DialogoAutorizar({ onListo, onCancelar }: { onListo: () => void; onCancelar: () => void }) {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const autorizar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario.trim() || !password || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      await autorizarEsteDispositivo(usuario, password);
      onListo();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo autorizar.');
      setGuardando(false);
    }
  };

  const claseInput =
    'w-full h-14 pl-11 pr-3 rounded-xl border-2 border-neutral-300 bg-white text-lg text-neutral-900 focus:outline-none focus:border-amber-500 select-text';
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[8vh] bg-black/50" onClick={() => !guardando && onCancelar()}>
      <form
        role="dialog"
        aria-labelledby="autorizar-titulo"
        onSubmit={autorizar}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white text-neutral-900 rounded-2xl shadow-xl p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="autorizar-titulo" className="text-xl font-bold">
              Autorizar esta tablet
            </h2>
            <p className="text-sm text-neutral-600">Usuario y contraseña de caja. Solo se pide una vez en este dispositivo.</p>
          </div>
          <button type="button" onClick={onCancelar} aria-label="Cerrar" className="p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-100 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <label className="relative block">
          <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
          <input
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Usuario de caja"
            className={claseInput}
          />
        </label>
        <label className="relative block">
          <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" className={claseInput} />
        </label>
        {error && (
          <div role="alert" className="flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={!usuario.trim() || !password || guardando}
          className="w-full h-14 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-200 disabled:text-neutral-500 text-neutral-950 text-lg font-bold flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
        >
          {guardando ? <Loader2 className="w-5 h-5 animate-spin" /> : <KeyRound className="w-5 h-5" />}
          {guardando ? 'Autorizando…' : 'Autorizar'}
        </button>
      </form>
    </div>
  );
}
