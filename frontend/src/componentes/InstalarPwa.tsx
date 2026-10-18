import React, { useState } from 'react';
import { CheckCircle2, Download, RefreshCw, X } from 'lucide-react';
import { instalarPwa, useInstalacionPwa, useVersionNueva } from '../services/pwaService';

/**
 * Botón para instalar la app; si el navegador no tiene diálogo, muestra los pasos a mano.
 * variante: 'oscuro' (relleno negro) o 'contorno' (secundario, para no competir con el botón principal).
 */
export const BotonInstalarPwa: React.FC<{ nombreApp: string; variante?: 'oscuro' | 'contorno' }> = ({
  nombreApp,
  variante = 'oscuro',
}) => {
  const estado = useInstalacionPwa();
  const [verPasos, setVerPasos] = useState(false);

  if (estado === 'instalada') {
    return (
      <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-700">
        <CheckCircle2 className="w-4 h-4" />
        App instalada · se actualiza sola con cada cambio
      </div>
    );
  }

  const handleClick = () => {
    if (estado === 'instalable') instalarPwa();
    else setVerPasos((v) => !v);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        className={`w-full flex items-center justify-center gap-2 font-semibold py-3 rounded-xl transition-colors cursor-pointer ${
          variante === 'contorno'
            ? 'bg-white hover:bg-neutral-50 border-2 border-neutral-300 text-neutral-800 text-base'
            : 'bg-neutral-900 hover:bg-neutral-800 text-white text-sm'
        }`}
      >
        <Download className="w-5 h-5" />
        <span>Instalar app {nombreApp}</span>
      </button>

      {/* Los pasos flotan sobre el botón: abrirlos no cambia el alto del inicio de sesión, que no tiene scroll. */}
      {verPasos && (
        <div className="absolute bottom-full inset-x-0 z-10 mb-2 bg-white border border-neutral-200 rounded-xl p-4 pr-9 text-xs text-neutral-700 space-y-1.5 select-text shadow-xl">
          <button
            type="button"
            onClick={() => setVerPasos(false)}
            className="absolute right-2 top-2 p-1 text-neutral-400 hover:text-neutral-700 cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
          <PasosInstalacion estado={estado} />
        </div>
      )}
    </div>
  );
};

function PasosInstalacion({ estado }: { estado: ReturnType<typeof useInstalacionPwa> }) {
  if (estado === 'ios') {
    return (
      <>
        <p className="font-semibold text-neutral-900">En iPad / iPhone (Safari):</p>
        <ol className="list-decimal pl-4 space-y-0.5">
          <li>Toca el botón Compartir (cuadro con flecha hacia arriba).</li>
          <li>Elige «Agregar a pantalla de inicio».</li>
        </ol>
      </>
    );
  }

  if (estado === 'inseguro') {
    return (
      <>
        <p className="font-semibold text-neutral-900">Chrome bloquea instalar desde http en la red local. Una sola vez:</p>
        <ol className="list-decimal pl-4 space-y-0.5">
          <li>
            Abre <span className="font-mono">chrome://flags/#unsafely-treat-insecure-origin-as-secure</span>
          </li>
          <li>
            Escribe <span className="font-mono font-semibold">{window.location.origin}</span> y ponlo en «Enabled».
          </li>
          <li>Reinicia Chrome, vuelve a esta página y toca otra vez «Instalar».</li>
        </ol>
      </>
    );
  }

  return (
    <>
      <p className="font-semibold text-neutral-900">El navegador aún no ofrece la instalación.</p>
      <p>Recarga la página. Si sigue igual, usa el menú del navegador (⋮) → «Instalar app» o «Agregar a pantalla de inicio».</p>
    </>
  );
}

/** Aviso flotante cuando se publicó una versión nueva (build de Docker) mientras la app estaba abierta. */
export const AvisoVersionNueva: React.FC = () => {
  const nueva = useVersionNueva();
  if (!nueva) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 z-50 flex justify-center pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 bg-neutral-900 text-white rounded-xl shadow-lg pl-4 pr-2 py-2 text-sm">
        <span>Hay una versión nueva de la app.</span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold px-3 py-1.5 rounded-lg cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>
    </div>
  );
};
