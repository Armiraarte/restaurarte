// Alertas de errores (services/errores.ts):
//   AlertasErrores  → cada error nuevo sale como alerta arriba; el botón rojo de abajo abre la lista
//                     completa con el detalle técnico, para copiarlo y mandarlo a soporte.
//   LimiteDeErrores → si una pantalla falla al dibujarse, en lugar de quedarse en blanco o cerrar la app
//                     muestra el problema y deja reintentar. React avisa del error a services/errores.ts
//                     (onCaughtError en main.tsx).
import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Copy, RotateCcw, Trash2, X } from 'lucide-react';
import { descartarError, ErrorApp, limpiarErrores, marcarVisto, OrigenError, textoErrores, useErrores } from '../services/errores';

const ORIGEN: Record<OrigenError, string> = {
  pantalla: 'Error en la pantalla',
  script: 'Error de la app',
  promesa: 'Error sin atender',
  consola: 'Error registrado',
  app: 'Error',
  cierre: 'La app se cerró',
};

/** Tiempo que una alerta nueva queda a la vista; después sigue en la lista. */
const DURACION_ALERTA_MS = 10_000;

const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', second: '2-digit' });

export const AlertasErrores: React.FC = () => {
  const errores = useErrores();
  const [abierta, setAbierta] = useState(false);
  const nuevos = errores.filter((e) => !e.visto).slice(0, 3);

  // Cada alerta se oculta sola; con la lista abierta ya se están viendo todas.
  useEffect(() => {
    if (nuevos.length === 0) return;
    if (abierta) {
      nuevos.forEach((e) => marcarVisto(e.id));
      return;
    }
    const t = setTimeout(() => nuevos.forEach((e) => marcarVisto(e.id)), DURACION_ALERTA_MS);
    return () => clearTimeout(t);
  }, [nuevos.map((e) => `${e.id}:${e.veces}`).join(','), abierta]); // eslint-disable-line react-hooks/exhaustive-deps

  if (errores.length === 0) return null;

  return (
    <>
      {/* Alertas nuevas, arriba al centro */}
      {!abierta && nuevos.length > 0 && (
        <div className="fixed top-3 inset-x-3 z-[70] flex flex-col items-center gap-2 pointer-events-none">
          {nuevos.map((e) => (
            <div
              key={e.id}
              role="alert"
              className="pointer-events-auto w-full max-w-lg flex items-start gap-3 rounded-xl border border-rose-300 bg-white shadow-lg px-4 py-3"
            >
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-rose-800">
                  {ORIGEN[e.origen]}
                  {e.veces > 1 && <span className="ml-1.5 font-semibold text-rose-600">×{e.veces}</span>}
                </div>
                <p className="text-sm text-neutral-800 line-clamp-2 break-words">{e.mensaje}</p>
                <button
                  type="button"
                  onClick={() => setAbierta(true)}
                  className="mt-1 text-sm font-semibold text-rose-700 underline underline-offset-2 cursor-pointer"
                >
                  Ver detalle
                </button>
              </div>
              <button
                type="button"
                onClick={() => marcarVisto(e.id)}
                aria-label="Ocultar alerta"
                className="shrink-0 -mr-1 w-9 h-9 rounded-lg flex items-center justify-center text-neutral-500 hover:bg-neutral-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Botón para ver todos los errores, abajo a la izquierda */}
      {!abierta && (
        <button
          type="button"
          onClick={() => setAbierta(true)}
          className="fixed bottom-3 left-3 z-[70] h-10 pl-3 pr-4 rounded-full bg-rose-600 text-white text-sm font-bold shadow-lg flex items-center gap-1.5 cursor-pointer"
        >
          <AlertTriangle className="w-4 h-4" />
          {errores.length} {errores.length === 1 ? 'error' : 'errores'}
        </button>
      )}

      {abierta && <ListaErrores errores={errores} onCerrar={() => setAbierta(false)} />}
    </>
  );
};

function ListaErrores({ errores, onCerrar }: { errores: ErrorApp[]; onCerrar: () => void }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(textoErrores(errores));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2_000);
    } catch {
      // sin permiso para el portapapeles: el detalle se puede leer en pantalla
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-3" onClick={onCerrar}>
      <div
        role="dialog"
        aria-label="Errores de la app"
        className="w-full max-w-2xl max-h-full bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center gap-3 px-5 py-4 border-b border-neutral-200">
          <AlertTriangle className="w-6 h-6 text-rose-600" />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-neutral-900">Errores de la app</h2>
            <p className="text-xs text-neutral-500">Copia el detalle y mándalo a soporte para corregirlo.</p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-neutral-500 hover:bg-neutral-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <ul className="flex-1 min-h-0 overflow-y-auto overscroll-contain divide-y divide-neutral-100">
          {errores.map((e) => (
            <ErrorDeLista key={e.id} error={e} />
          ))}
        </ul>

        <div className="shrink-0 grid grid-cols-2 gap-2 px-5 py-4 border-t border-neutral-200">
          <button
            type="button"
            onClick={copiar}
            className="h-11 rounded-xl bg-neutral-900 text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
          >
            {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copiado ? 'Copiado' : 'Copiar detalle'}
          </button>
          <button
            type="button"
            onClick={() => {
              limpiarErrores();
              onCerrar();
            }}
            className="h-11 rounded-xl border border-neutral-300 text-sm font-semibold text-neutral-800 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Borrar todos
          </button>
        </div>
      </div>
    </div>
  );
}

function ErrorDeLista({ error: e }: { error: ErrorApp }) {
  const [verDetalle, setVerDetalle] = useState(false);
  return (
    <li className="px-5 py-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold uppercase tracking-wide text-rose-700">
            {ORIGEN[e.origen]}
            {e.veces > 1 && <span className="ml-1.5 normal-case">×{e.veces}</span>}
          </div>
          <p className="text-sm font-medium text-neutral-900 break-words">{e.mensaje}</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {hora(e.ultimaVez)} · {e.ruta}
          </p>
        </div>
        <button
          type="button"
          onClick={() => descartarError(e.id)}
          aria-label="Quitar de la lista"
          className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {e.detalle && (
        <>
          <button
            type="button"
            onClick={() => setVerDetalle((v) => !v)}
            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-neutral-600 cursor-pointer"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${verDetalle ? 'rotate-180' : ''}`} />
            Detalle técnico
          </button>
          {verDetalle && (
            <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-neutral-50 border border-neutral-200 p-2 text-[11px] leading-snug text-neutral-700 whitespace-pre-wrap break-words select-text">
              {e.detalle}
            </pre>
          )}
        </>
      )}
    </li>
  );
}

/* ---------- Límite de errores ---------- */

interface PropsLimite {
  children: React.ReactNode;
  /** 'app': ocupa toda la pantalla. 'seccion': solo el espacio de la sección que falló. */
  alcance?: 'app' | 'seccion';
  /** Botón extra para salir de la pantalla que falló (p. ej. volver a las órdenes). */
  salida?: { texto: string; accion: () => void };
}

/** Si algo dentro falla al dibujarse, muestra el problema en lugar de dejar la pantalla en blanco. */
export class LimiteDeErrores extends React.Component<PropsLimite, { error: unknown }> {
  state: { error: unknown } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (error === null) return this.props.children;

    const { alcance = 'seccion', salida } = this.props;
    const mensaje = error instanceof Error ? error.message : String(error);
    return (
      <div className={`${alcance === 'app' ? 'h-dvh bg-neutral-100' : 'py-10'} flex items-center justify-center p-4`}>
        <div role="alert" className="w-full max-w-md bg-white border border-rose-200 rounded-2xl shadow-lg p-6 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 mx-auto text-rose-600" />
          <div>
            <h2 className="text-lg font-bold text-neutral-900">Esta pantalla tuvo un problema</h2>
            <p className="mt-1 text-sm text-neutral-700 break-words">{mensaje}</p>
            <p className="mt-2 text-xs text-neutral-500">El detalle quedó en la lista de errores (botón rojo de abajo).</p>
          </div>
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="h-12 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-base font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-5 h-5" />
              Reintentar
            </button>
            {salida && (
              <button
                type="button"
                onClick={() => {
                  this.setState({ error: null });
                  salida.accion();
                }}
                className="h-12 rounded-xl border-2 border-neutral-300 text-base font-semibold text-neutral-800 cursor-pointer"
              >
                {salida.texto}
              </button>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="h-11 rounded-xl text-sm font-semibold text-neutral-600 hover:bg-neutral-50 cursor-pointer"
            >
              Recargar la app
            </button>
          </div>
        </div>
      </div>
    );
  }
}
