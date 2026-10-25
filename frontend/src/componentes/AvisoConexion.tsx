import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw, WifiOff } from 'lucide-react';

/** La caída de internet o del servidor se avisa sin cerrar la sesión ni reenviar pedidos. */
export function AvisoConexion() {
  const [sinConexion, setSinConexion] = useState(false);
  const revisarRef = useRef<() => void>(() => {});
  useEffect(() => {
    let activa = true;
    let consultando = false;
    const control = new AbortController();
    const revisar = async () => {
      if (consultando || !activa) return;
      if (!navigator.onLine) { setSinConexion(true); return; }
      consultando = true;
      try {
        const res = await fetch('/api/health', { cache: 'no-store', signal: AbortSignal.any([control.signal, AbortSignal.timeout(5_000)]) });
        const datos = await res.json();
        if (activa) setSinConexion(!res.ok || datos.ok !== true);
      } catch {
        if (activa) setSinConexion(true);
      } finally { consultando = false; }
    };
    const sinRed = () => setSinConexion(true);
    const visible = () => { if (document.visibilityState === 'visible') revisar(); };
    revisarRef.current = revisar;
    revisar();
    const intervalo = setInterval(visible, 10_000);
    window.addEventListener('offline', sinRed);
    window.addEventListener('online', revisar);
    document.addEventListener('visibilitychange', visible);
    return () => {
      activa = false;
      control.abort();
      clearInterval(intervalo);
      window.removeEventListener('offline', sinRed);
      window.removeEventListener('online', revisar);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);
  if (!sinConexion) return null;
  return <div role="alert" className="fixed top-3 inset-x-3 z-[90] mx-auto max-w-xl rounded-xl border-2 border-rose-500 bg-white p-4 shadow-2xl flex items-start gap-3">
    <WifiOff className="w-6 h-6 shrink-0 text-rose-700" />
    <div className="min-w-0 flex-1"><p className="font-bold text-rose-800">SIN CONEXIÓN CON EL SERVIDOR</p><p className="text-sm text-neutral-700">Intentando reconectar automáticamente. La sesión se conserva.</p></div>
    <button onClick={() => revisarRef.current()} className="shrink-0 rounded-lg border border-rose-300 p-2 text-rose-800 cursor-pointer" aria-label="Reintentar conexión"><RotateCcw className="w-5 h-5" /></button>
  </div>;
}
