import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import AppTablet from './componentes/AppTablet.tsx';
import { AvisoVersionNueva } from './componentes/InstalarPwa.tsx';
import { iniciarPwa } from './services/pwaService.ts';
import './index.css';

// /tablet abre la app de meseros; cualquier otra ruta, la caja.
const esTablet = window.location.pathname.startsWith('/tablet');

// Cada app se instala por separado: la de meseros arranca directo en /tablet.
if (esTablet) {
  document.getElementById('manifest')?.setAttribute('href', '/manifest-tablet.webmanifest');
  // Escala de la app de meseros según el tamaño de la pantalla (ver html.app-tablet en index.css).
  document.documentElement.classList.add('app-tablet');
}

// Instalación, service worker y aviso de versión nueva.
iniciarPwa();

createRoot(document.getElementById('root')!).render(
  <>
    {esTablet ? <AppTablet /> : <App />}
    <AvisoVersionNueva />
  </>,
);
