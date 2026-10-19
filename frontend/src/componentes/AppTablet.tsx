// App exclusiva de las tablets de los meseros (se abre en /tablet).
// Más adelante se moverá a su propio proyecto como PWA.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, LogOut, User } from 'lucide-react';
import { posDataService } from '../services/dataService';
import { FlujoOrdenes } from './FlujoOrdenes';
import { SeleccionTablet } from './SeleccionTablet';
import { olvidarTablet } from '../services/accesoTablet';
import {
  logout as cerrarSesionCuenta,
  obtenerSesion,
  ROLES_APP_MESEROS,
  SesionReemplazadaError,
  tomarAvisoSesion,
  Usuario,
} from '../services/authService';
import { salirDeLinea } from '../services/tabletsService';
import { useEnVivo } from '../services/enVivo';
import { cerrarSesionTablet, iniciarSesionTablet, SinTurnoError } from '../services/turnosService';
import { IndicadorTurno } from './IndicadorTurno';
import { AvisoVerificacion, useLatidoTablet } from './VerificacionConexion';
import { MarcaDeAgua } from './Marca';

const SESION_KEY = 'tablet_sesion'; // sin prefijo pos_ para no disparar la sincronización

function useDatosPos() {
  const [, setVersion] = useState(0);
  useEffect(() => posDataService.subscribe(() => setVersion((v) => v + 1)), []);
  return {
    tablets: posDataService.getTablets(),
  };
}

function leerSesion(): string | null {
  try {
    return localStorage.getItem(SESION_KEY);
  } catch {
    return null;
  }
}

function guardarSesion(tabletId: string | null) {
  try {
    if (tabletId) localStorage.setItem(SESION_KEY, tabletId);
    else localStorage.removeItem(SESION_KEY);
  } catch {
    // sin almacenamiento: la sesión dura solo mientras la página esté abierta
  }
}

export default function AppTablet() {
  const { tablets } = useDatosPos();
  const [tabletId, setTabletId] = useState<string | null>(leerSesion);
  // Cuenta con la que se inició sesión en esta tablet (usuario y contraseña/PIN del backend).
  const [cuenta, setCuenta] = useState<Usuario | null>(null);
  const [verificandoCuenta, setVerificandoCuenta] = useState(true);
  // Por qué se volvió al inicio de sesión sin cerrarla aquí (se entró con la cuenta en otro dispositivo).
  const [avisoInicio, setAvisoInicio] = useState<string | null>(null);

  // Si el servidor no responde al abrir (se reinició, Wi-Fi inestable), NO se pierde la sesión:
  // se sigue en «verificando» y se reintenta cada 3 s. Solo un 401 (sesión inválida) manda al login.
  useEffect(() => {
    let cancelado = false;
    let reintento: ReturnType<typeof setTimeout>;
    const verificar = () =>
      obtenerSesion()
        .then((u) => {
          if (cancelado) return;
          setCuenta(u && ROLES_APP_MESEROS.includes(u.rol) ? u : null);
          if (!u) setAvisoInicio(tomarAvisoSesion());
          setVerificandoCuenta(false);
        })
        .catch(() => {
          if (!cancelado) reintento = setTimeout(verificar, 3_000);
        });
    verificar();
    return () => {
      cancelado = true;
      clearTimeout(reintento);
    };
  }, []);

  const tablet = tablets.find((t) => t.id === tabletId);
  const sesionActiva = tablet && tablet.status === 'conectada';

  // Mientras haya cuenta, la tablet avisa a caja que está en línea y atiende "Verificar conexión".
  // Si se entró con esta cuenta en otro dispositivo, aquí se sale sin cerrar nada en el servidor:
  // la sesión del turno ya es del otro dispositivo.
  // Igual si se hizo el corte de turno: la tablet vuelve a elegir tablet y espera el siguiente turno.
  const salirSinCerrar = (aviso: string) => {
    handleLogout();
    cerrarSesionCuenta();
    setCuenta(null);
    setAvisoInicio(aviso);
  };
  const faseVerificacion = useLatidoTablet(!!cuenta, sesionActiva ? tablet.number : null, null, salirSinCerrar);

  // Al iniciar sesión con la cuenta, la tablet entra directo: su número sale de la cuenta (tablets.numero)
  // y quien atiende es la propia tablet ("Tablet 01"); ya no se elige mesero.
  const tabletDeCuenta = cuenta ? `tablet-${String(Number(cuenta.tablet?.numero) || 1).padStart(2, '0')}` : null;
  const listo = !!tablet && !!sesionActiva && tablet.id === tabletDeCuenta && tablet.assignedWaiter === cuenta?.nombre;

  // Al iniciar sesión, la tablet abre su sesión dentro del turno de caja (BD: sesiones_tablet).
  // Si la caja aún no inicia turno, espera y reintenta.
  const [turno, setTurno] = useState<'pendiente' | 'ok' | 'sinTurno' | 'error'>('pendiente');
  const [errorTurno, setErrorTurno] = useState<string | null>(null);
  const salirRef = useRef(salirSinCerrar);
  salirRef.current = salirSinCerrar;
  const abrirSesionTurno = useCallback(async () => {
    try {
      await iniciarSesionTablet();
      setTurno('ok');
      setErrorTurno(null);
    } catch (err) {
      // Corte de turno (o la tablet se abrió en otro dispositivo): de vuelta a elegir tablet.
      if (err instanceof SesionReemplazadaError) return salirRef.current(err.message);
      setTurno(err instanceof SinTurnoError ? 'sinTurno' : 'error');
      setErrorTurno(err instanceof Error ? err.message : 'No se pudo iniciar la sesión de la tablet.');
    }
  }, []);
  useEffect(() => {
    if (!cuenta) {
      setTurno('pendiente');
      return;
    }
    // Un administrador puede usar la app de meseros sin tablet propia: no abre sesión de tablet.
    if (cuenta.rol === 'admin') {
      setTurno('ok');
      return;
    }
    abrirSesionTurno();
  }, [cuenta, abrirSesionTurno]);
  useEffect(() => {
    if (turno !== 'sinTurno' && turno !== 'error') return;
    const id = setInterval(abrirSesionTurno, 10_000);
    return () => clearInterval(id);
  }, [turno, abrirSesionTurno]);
  // Al iniciar o cerrar el turno (corte) la tablet vuelve a revisar su sesión al momento:
  // si se cerró, pasa a «Esperando a que caja inicie turno»; si se abrió, entra sola.
  useEnVivo(['turno'], () => {
    if (cuenta && cuenta.rol !== 'admin') abrirSesionTurno();
  });

  useEffect(() => {
    if (!cuenta || listo) return;
    const t = posDataService.asegurarTablet(cuenta.tablet?.numero ?? '01');
    posDataService.tabletLogin(t.id, cuenta.nombre);
    guardarSesion(t.id);
    setTabletId(t.id);
  }, [cuenta, listo]);

  const handleLogout = () => {
    if (tablet) posDataService.tabletLogout(tablet.id);
    guardarSesion(null);
    setTabletId(null);
  };

  // Cierra la sesión de la cuenta: la tablet vuelve a la pantalla de elegir tablet. Como se cerró a propósito,
  // el dispositivo olvida cuál tablet era (ya no entra solo al abrirse el turno; se vuelve a elegir).
  const handleCerrarCuenta = () => {
    olvidarTablet();
    handleLogout();
    salirDeLinea().catch(() => {}); // antes de borrar el token, para que caja deje de verla en línea
    cerrarSesionTablet().catch(() => {}); // cierra su sesión del turno (BD: sesiones_tablet.cerrada_en)
    cerrarSesionCuenta();
    setCuenta(null);
  };

  let pantalla: React.ReactNode;
  if (verificandoCuenta) {
    pantalla = <div className="h-dvh" />;
  } else if (!cuenta) {
    pantalla = (
      // Sin usuario ni PIN: se elige cuál tablet es (Tablet 01…05), solo con turno abierto.
      <SeleccionTablet
        aviso={avisoInicio}
        onEntrar={(u) => {
          setAvisoInicio(null);
          setCuenta(u);
        }}
      />
    );
  } else if (turno === 'sinTurno' || turno === 'error') {
    pantalla = (
      <div className="h-dvh flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white border border-neutral-200 rounded-2xl p-6 text-center space-y-4 shadow-sm">
          <Loader2 className="w-8 h-8 mx-auto text-amber-500 animate-spin" />
          <div className="text-lg font-bold">{turno === 'sinTurno' ? 'Esperando a que caja inicie turno' : 'No se pudo iniciar sesión'}</div>
          <p className="text-sm text-neutral-500">
            {turno === 'sinTurno'
              ? 'La tablet entra en cuanto se inicie sesión en la caja. Se vuelve a intentar sola.'
              : errorTurno}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={abrirSesionTurno} className="h-11 rounded-xl bg-amber-500 hover:bg-amber-400 text-sm font-semibold cursor-pointer">
              Reintentar
            </button>
            <button onClick={handleCerrarCuenta} className="h-11 rounded-xl bg-red-600 hover:bg-red-700 border border-red-700 text-sm font-semibold text-white cursor-pointer">
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    );
  } else if (!listo || !tablet || turno !== 'ok') {
    pantalla = <div className="h-dvh" />;
  } else {
    // Cerrar sesión en la tablet cierra la cuenta: vuelve a pedir usuario y contraseña/PIN.
    pantalla = (
      <PantallaMesero nombreTablet={cuenta.nombre} onLogout={handleCerrarCuenta} />
    );
  }

  return (
    // Cristal: con sesión, las tarjetas son translúcidas y dejan ver el logo de la cenaduría del fondo.
    // El inicio de sesión lleva su propio panel de marca, con tarjetas sólidas y sin marca de agua.
    <div className={`${cuenta ? 'cristal ' : ''}relative h-dvh overflow-hidden bg-neutral-100`}>
      {cuenta && <MarcaDeAgua />}
      <div className="relative z-10 h-full">{pantalla}</div>
      <AvisoVerificacion fase={faseVerificacion} />
    </div>
  );
}

/* ---------- Pantalla principal del mesero ---------- */

function PantallaMesero({ nombreTablet, onLogout }: { nombreTablet: string; onLogout: () => void }) {
  return (
    <div className="h-dvh">
      <FlujoOrdenes
        origen={nombreTablet}
        cabecera={
          <div className="flex items-center gap-[12px] min-w-0">
            <span className="w-[44px] h-[44px] rounded-full bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
              <User className="w-[24px] h-[24px]" />
            </span>
            <div className="min-w-0 leading-tight">
              <div className="text-[18px] font-bold truncate">{nombreTablet}</div>
              <IndicadorTurno fijo className="mt-[8px]" />
            </div>
          </div>
        }
        acciones={
          <button onClick={onLogout} aria-label="Cerrar sesión" className="h-[56px] px-[16px] rounded-[12px] bg-red-600 hover:bg-red-700 border border-red-700 text-white flex items-center gap-[8px] text-[14px] font-semibold cursor-pointer">
            <LogOut className="w-[20px] h-[20px]" />
            <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        }
      />
    </div>
  );
}
