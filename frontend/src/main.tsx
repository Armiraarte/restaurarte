import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import AppTablet from './componentes/AppTablet.tsx';
import './index.css';

// /tablet abre la app de meseros; cualquier otra ruta, la caja.
const esTablet = window.location.pathname.startsWith('/tablet');

createRoot(document.getElementById('root')!).render(esTablet ? <AppTablet /> : <App />);
