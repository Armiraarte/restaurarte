import {lazy, Suspense, useEffect, useState, type ComponentType} from 'react';
import {createRoot} from 'react-dom/client';
import { AvisoVersionNueva } from './componentes/InstalarPwa.tsx';
import { AlertasErrores, LimiteDeErrores } from './componentes/AlertasErrores.tsx';
import { configurarAppPwa, iniciarPwa, pantallaCompletaAlTocar } from './services/pwaService.ts';
import { appActual } from './services/appNavigation.ts';
import { esTabletEnNavegador, esTabletInstalada } from './services/accesoTablet.ts';
import { DescargarApp } from './componentes/DescargarApp.tsx';
import { registrarError, vigilarErrores } from './services/errores.ts';
import './index.css';

// Antes que todo: los errores se muestran en alertas en vez de cerrar la app (ver services/errores.ts).
vigilarErrores();

// Tablets: en el navegador solo se ofrece descargar la versión tablet; ya descargada, solo esa versión.
// (En la PC sigue el inicio con las dos versiones: TABLET y PC.)
const tabletEnNavegador = esTabletEnNavegador();
const tabletInstalada = esTabletInstalada();
if (tabletInstalada && appActual() !== 'meseros') window.history.replaceState(null, '', '/tablet');
configurarAppPwa(tabletEnNavegador || appActual() === 'meseros');
// También se activa en el selector inicial: cambiar de acceso conserva el documento.
pantallaCompletaAlTocar();

// Instalación, service worker y aviso de versión nueva.
iniciarPwa();

/**
 * Caja y meseros se cargan por separado: la tablet no descarga ni procesa el código de la caja (y al revés).
 * Si el archivo ya no existe porque se publicó una versión nueva con la app abierta, se recarga una vez.
 */
function cargarPorSeparado(importar: () => Promise<{ default: ComponentType }>) {
  const CLAVE = 'recarga_por_version';
  return lazy(() =>
    importar()
      .then((modulo) => {
        try {
          sessionStorage.removeItem(CLAVE);
        } catch {
          // sin almacenamiento
        }
        return modulo;
      })
      .catch((err) => {
        try {
          if (!sessionStorage.getItem(CLAVE)) {
            sessionStorage.setItem(CLAVE, '1');
            window.location.reload();
            return new Promise<never>(() => {});
          }
        } catch {
          // sin almacenamiento: se muestra el error
        }
        throw err;
      }),
  );
}

const App = cargarPorSeparado(() => import('./App.tsx'));
const AppTablet = cargarPorSeparado(() => import('./componentes/AppTablet.tsx'));

function Aplicacion() {
  const [app, setApp] = useState(appActual);
  useEffect(() => {
    const actualizar = () => {
      // La app descargada en una tablet nunca pasa a la versión PC.
      if (tabletInstalada && appActual() !== 'meseros') window.history.replaceState(null, '', '/tablet');
      const actual = appActual();
      configurarAppPwa(actual === 'meseros');
      setApp(actual);
    };
    window.addEventListener('popstate', actualizar);
    return () => window.removeEventListener('popstate', actualizar);
  }, []);

  if (tabletEnNavegador) {
    return (
      <>
        <DescargarApp />
        <AlertasErrores />
      </>
    );
  }

  return (
    <>
      <LimiteDeErrores alcance="app" key={app}>
        <Suspense fallback={<div className="h-dvh bg-neutral-100" />}>{app === 'meseros' ? <AppTablet /> : <App />}</Suspense>
      </LimiteDeErrores>
      <AvisoVersionNueva />
      <AlertasErrores />
    </>
  );
}

createRoot(document.getElementById('root')!, {
  // React avisa aquí de los errores al dibujar (atrapados o no por LimiteDeErrores) en lugar de solo la consola.
  onCaughtError: (error, info) => registrarError(error, 'pantalla', info.componentStack ?? ''),
  onUncaughtError: (error, info) => registrarError(error, 'pantalla', info.componentStack ?? ''),
  onRecoverableError: (error) => registrarError(error, 'app'),
}).render(<Aplicacion />);
