// Instalación de la PWA y aviso de versión nueva.
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Cómo se puede instalar en este dispositivo:
 * - 'instalable': el navegador ofrece su diálogo de instalación.
 * - 'ios': Safari no tiene diálogo; se instala desde Compartir → Agregar a pantalla de inicio.
 * - 'inseguro': página abierta por http con IP de la red; el navegador bloquea la instalación.
 * - 'instalada': ya se está usando como app instalada.
 * - 'no_disponible': el navegador todavía no la ofrece (o no la soporta).
 */
export type EstadoInstalacion = 'instalable' | 'ios' | 'inseguro' | 'instalada' | 'no_disponible';

let eventoInstalacion: BeforeInstallPromptEvent | null = null;
let hayVersionNueva = false;
const oyentes = new Set<() => void>();

function avisar() {
  oyentes.forEach((fn) => fn());
}

function esStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function esIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function estadoActual(): EstadoInstalacion {
  if (esStandalone()) return 'instalada';
  if (eventoInstalacion) return 'instalable';
  if (esIos()) return 'ios';
  if (!window.isSecureContext) return 'inseguro';
  return 'no_disponible';
}

/** Abre el diálogo de instalación del navegador. Devuelve true si el usuario aceptó. */
export async function instalarPwa(): Promise<boolean> {
  if (!eventoInstalacion) return false;
  const evento = eventoInstalacion;
  await evento.prompt();
  const { outcome } = await evento.userChoice;
  eventoInstalacion = null; // el evento solo se puede usar una vez
  avisar();
  return outcome === 'accepted';
}

export function useInstalacionPwa(): EstadoInstalacion {
  const [estado, setEstado] = useState<EstadoInstalacion>(estadoActual);
  useEffect(() => {
    const actualizar = () => setEstado(estadoActual());
    oyentes.add(actualizar);
    return () => {
      oyentes.delete(actualizar);
    };
  }, []);
  return estado;
}

export function useVersionNueva(): boolean {
  const [nueva, setNueva] = useState(hayVersionNueva);
  useEffect(() => {
    const actualizar = () => setNueva(hayVersionNueva);
    oyentes.add(actualizar);
    return () => {
      oyentes.delete(actualizar);
    };
  }, []);
  return nueva;
}

/** Script principal de una página: cambia de nombre (hash) en cada build nuevo. */
function scriptPrincipal(html: string): string | null {
  return html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/)?.[1] ?? null;
}

async function revisarVersion() {
  if (hayVersionNueva) return;
  try {
    const res = await fetch('/', { cache: 'no-store' });
    if (!res.ok) return;
    const remoto = scriptPrincipal(await res.text());
    const local = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.getAttribute('src');
    if (remoto && local && remoto !== local) {
      hayVersionNueva = true;
      avisar();
    }
  } catch {
    // sin conexión: se vuelve a revisar más tarde
  }
}

/** Se llama una sola vez al arrancar, antes de montar React, para no perder el evento de instalación. */
export function iniciarPwa() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // se muestra con nuestro botón, no con el aviso del navegador
    eventoInstalacion = e as BeforeInstallPromptEvent;
    avisar();
  });
  window.addEventListener('appinstalled', () => {
    eventoInstalacion = null;
    avisar();
  });
  window.matchMedia('(display-mode: standalone)').addEventListener('change', avisar);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registro) => {
          // el navegador revisa sw.js por su cuenta, pero en una app que se queda abierta todo el día lo forzamos
          setInterval(() => registro.update().catch(() => {}), 60_000);
        })
        .catch(() => {
          // sin service worker la app funciona igual, solo no queda disponible sin conexión
        });
    });
  }

  // En desarrollo, Vite (HMR) ya aplica los cambios al instante.
  // Con el build (Docker), se revisa si hay una versión nueva al volver a la app y cada minuto.
  if (import.meta.env.PROD) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') revisarVersion();
    });
    setInterval(revisarVersion, 60_000);
  }
}
