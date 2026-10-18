// App exclusiva de las tablets de los meseros (se abre en /tablet).
// Más adelante se moverá a su propio proyecto como PWA.
import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Hash,
  Loader2,
  LogOut,
  Minus,
  Plus,
  User,
} from 'lucide-react';
import { Account, ProductCatalogItem, TabletDevice } from '../types/pos';
import { posDataService } from '../services/dataService';
import { SelectorTipoOrden } from './AppTabletCuenta';
import { PedidoOrden } from './PedidoOrden';
import { InicioSesion } from './InicioSesion';
import { logout as cerrarSesionCuenta, obtenerSesion, ROLES_APP_MESEROS, Usuario } from '../services/authService';
import { salirDeLinea } from '../services/tabletsService';
import { esOrdenActiva, etiquetaMesaRegistrada, listarMesasTurno, MesaRegistrada, registrarMesa } from '../services/mesasService';
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
    cuentas: posDataService.getOpenAccounts(),
    comandas: posDataService.getComandas(),
    productos: posDataService.getProductos(),
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
  const { tablets, cuentas, productos } = useDatosPos();
  const [tabletId, setTabletId] = useState<string | null>(leerSesion);
  // Cuenta con la que se inició sesión en esta tablet (usuario y contraseña/PIN del backend).
  const [cuenta, setCuenta] = useState<Usuario | null>(null);
  const [verificandoCuenta, setVerificandoCuenta] = useState(true);

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
  const faseVerificacion = useLatidoTablet(!!cuenta, sesionActiva ? tablet.number : null, null);

  // Al iniciar sesión con la cuenta, la tablet entra directo: su número sale de la cuenta (tablets.numero)
  // y quien atiende es la propia tablet ("Tablet 01"); ya no se elige mesero.
  const tabletDeCuenta = cuenta ? `tablet-${String(Number(cuenta.tablet?.numero) || 1).padStart(2, '0')}` : null;
  const listo = !!tablet && !!sesionActiva && tablet.id === tabletDeCuenta && tablet.assignedWaiter === cuenta?.nombre;

  // Al iniciar sesión, la tablet abre su sesión dentro del turno de caja (BD: sesiones_tablet).
  // Si la caja aún no inicia turno, espera y reintenta.
  const [turno, setTurno] = useState<'pendiente' | 'ok' | 'sinTurno' | 'error'>('pendiente');
  const [errorTurno, setErrorTurno] = useState<string | null>(null);
  const abrirSesionTurno = useCallback(async () => {
    try {
      await iniciarSesionTablet();
      setTurno('ok');
      setErrorTurno(null);
    } catch (err) {
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

  // Cierra la sesión de la cuenta: la tablet vuelve a pedir usuario y contraseña/PIN.
  const handleCerrarCuenta = () => {
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
    pantalla = <InicioSesion app="meseros" onEntrar={setCuenta} />;
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
      <PantallaMesero nombreTablet={cuenta.nombre} tablet={tablet} cuentas={cuentas} productos={productos} onLogout={handleCerrarCuenta} />
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

function PantallaMesero({
  nombreTablet,
  tablet,
  cuentas,
  productos,
  onLogout,
}: {
  /** Nombre de la cuenta de la tablet ("Tablet 01"). */
  nombreTablet: string;
  tablet: TabletDevice;
  cuentas: Account[];
  productos: ProductCatalogItem[];
  onLogout: () => void;
}) {
  // Orden abierta en pantalla (BD: orden.idOrden); su pedido se toma con PedidoOrden.
  const [ordenAbierta, setOrdenAbierta] = useState<number | null>(null);
  const [agregandoMesa, setAgregandoMesa] = useState(false);

  // Órdenes activas (ABIERTA o PAGANDO) del turno abierto: es lo único que se dibuja; las cobradas van a Ventas.
  const [mesas, setMesas] = useState<MesaRegistrada[] | null>(null);
  const [errorMesas, setErrorMesas] = useState<string | null>(null);
  const cargarMesas = useCallback(async () => {
    try {
      setMesas((await listarMesasTurno()).mesas.filter(esOrdenActiva));
      setErrorMesas(null);
    } catch (err) {
      setErrorMesas(err instanceof Error ? err.message : 'No se pudieron cargar las mesas.');
    }
  }, []);
  useEffect(() => {
    cargarMesas();
    // Respaldo: se vuelve a leer cada pocos segundos (lo normal es el aviso en vivo de abajo).
    const id = setInterval(cargarMesas, 5_000);
    return () => clearInterval(id);
  }, [cargarMesas]);
  useEnVivo(['ordenes'], cargarMesas);

  // Siguiente número consecutivo: el mayor número de mesa activa en el turno + 1 (o 1 si no hay).
  const siguienteMesa = (mesas ?? []).reduce((max, m) => (/^\d+$/.test(m.nombre) ? Math.max(max, Number(m.nombre)) : max), 0) + 1;

  // "Agregar mesa": se registra en la base (en el turno abierto) y se abre su pedido.
  const abrirCuenta = async (_tipo: 'mesa' | 'nombre', identificador: string, paraLlevar: boolean) => {
    const { mesa } = await registrarMesa(identificador, paraLlevar);
    setAgregandoMesa(false);
    setOrdenAbierta(mesa.id);
    cargarMesas();
  };

  const abrirMesaRegistrada = (mesa: MesaRegistrada) => setOrdenAbierta(mesa.id);

  return (
    // Ocupa exactamente la pantalla (100dvh): sin scroll de página; solo se desplaza el recuadro que no quepa.
    <div className="h-dvh overflow-hidden text-neutral-900 flex flex-col select-none">
      {/* Encabezado: nombre de la tablet (cuenta con la que inició sesión).
          BD: usuarios.nombre = tablets.nombre ("Tablet 01"). */}
      {/* Medidas en px (no rem): la pantalla de pedido escala el texto con rem y el encabezado no debe cambiar de tamaño. */}
      <header className="shrink-0 h-[80px] bg-white border-b border-neutral-200">
        <div className="h-full px-[16px] flex items-center justify-between gap-[12px]">
          <div className="flex items-center gap-[12px] min-w-0">
            <span className="w-[44px] h-[44px] rounded-full bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
              <User className="w-[24px] h-[24px]" />
            </span>
            <div className="min-w-0 leading-tight">
              <div className="text-[18px] font-bold truncate">{nombreTablet}</div>
              <IndicadorTurno fijo className="mt-[8px]" />
            </div>
          </div>
          <div className="flex items-center gap-[8px] shrink-0">
            {/* Agregar mesa (o cuenta a nombre de un cliente) */}
            <button
              onClick={() => setAgregandoMesa(true)}
              className="neon-solido neon-fresco h-[56px] px-[24px] rounded-[12px] flex items-center gap-[8px] text-[18px] font-bold cursor-pointer"
            >
              <Plus className="w-[24px] h-[24px]" />
              Agregar orden
            </button>
            <button
              onClick={onLogout}
              aria-label="Cerrar sesión"
              className="h-[56px] px-[16px] rounded-[12px] bg-red-600 hover:bg-red-700 border border-red-700 text-white flex items-center gap-[8px] text-[14px] font-semibold cursor-pointer"
            >
              <LogOut className="w-[20px] h-[20px]" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 p-3">
        {ordenAbierta !== null ? (
          // Pedido desde la base: menú (producto), envío a cocina (orden_has_detalle) y total.
          <PedidoOrden
            idOrden={ordenAbierta}
            origen={nombreTablet}
            pantallaCompleta
            onVolver={() => {
              setOrdenAbierta(null);
              cargarMesas();
            }}
          />
        ) : (
          <VistaMesas mesas={mesas} error={errorMesas} onAbrir={abrirMesaRegistrada} />
        )}
      </main>

      <AnimatePresence>
        {agregandoMesa && (
          <DialogoNuevaCuenta siguienteMesa={siguienteMesa} onAbrir={abrirCuenta} onCancelar={() => setAgregandoMesa(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- Mesas ---------- */

/**
 * Cuadrícula de las mesas registradas en la base (tabla `mesas`) en el turno abierto (mesas.turno_id).
 * Se agregan con "Agregar mesa" del encabezado. Por tarjeta:
 *   - título          → mesas.codigo ("5" se muestra "Mesa 5"; un nombre tal cual)
 *   - PARA LLEVAR/... → mesas.tipo_venta_id (2 = para llevar)
 *   - estado y total  → del pedido de esta tablet si ya lo tiene; si no, mesas.total
 * Orden: el que manda la base (números de menor a mayor, después nombres).
 */
function VistaMesas({
  mesas,
  error,
  onAbrir,
}: {
  mesas: MesaRegistrada[] | null;
  error: string | null;
  onAbrir: (mesa: MesaRegistrada) => void;
}) {
  return (
    <section className="h-full min-h-0 flex flex-col gap-2">
      <h2 className="shrink-0 text-sm font-bold text-neutral-700">Órdenes</h2>

      {error && (
        <div className="shrink-0 flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {mesas === null && !error && (
        <div className="py-8 flex justify-center text-neutral-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      )}
      {mesas?.length === 0 && (
        <p className="text-sm text-neutral-500">No hay órdenes en este turno. Toca «Agregar orden» para abrir una.</p>
      )}

      {/* Si hay más mesas de las que caben, solo esta zona se desplaza (la página no) */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 auto-rows-min content-start gap-2">
        {(mesas ?? []).map((mesa) => {
          const titulo = etiquetaMesaRegistrada(mesa);
          const paraLlevar = mesa.tipo_venta_id === 2;
          // BD: orden.total (suma de orden_has_detalle).
          const total = Number(mesa.total);
          const pidio = mesa.estatus === 1; // orden.estatus 1 = PAGANDO (pidió la cuenta)
          return (
            <button
              key={mesa.id}
              onClick={() => onAbrir(mesa)}
              className={`neon ${pidio ? 'neon-fuego' : 'neon-cian'} min-h-20 rounded-xl border-2 p-2.5 text-left flex flex-col justify-between gap-2 cursor-pointer`}
            >
              {/* Título y, en el otro extremo, el tipo de venta (mesas.tipo_venta_id) */}
              <div className="flex items-start justify-between gap-1.5">
                <span className="text-sm font-bold leading-tight break-words min-w-0">{titulo}</span>
                <span
                  className={`shrink-0 text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded border ${
                    paraLlevar ? 'bg-violet-100 text-violet-800 border-violet-300' : 'bg-white text-sky-800 border-sky-200'
                  }`}
                >
                  {paraLlevar ? 'PARA LLEVAR' : 'COMER AQUÍ'}
                </span>
              </div>
              <div className="leading-tight">
                <div className={`text-xs font-medium ${pidio ? 'text-amber-800' : 'text-sky-800'}`}>
                  {pidio ? 'Cuenta pedida' : total > 0 ? 'Con pedido' : 'Sin pedido'} · ${total.toFixed(2)}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

type ModoNuevaCuenta = 'nombre' | 'mesa';

/**
 * Abrir cuenta: dos opciones, "Por nombre" y, justo abajo, "Núm. de mesa".
 * El número de mesa es libre (cualquier N ≥ 1, sin límite ni lista fija de mesas) y se sugiere el
 * siguiente consecutivo; así escala a cualquier cantidad de mesas.
 * BD: no depende de la tabla `mesas`; la cuenta guarda el número (ver comentario de `abrir`).
 */
function DialogoNuevaCuenta({
  siguienteMesa,
  onAbrir,
  onCancelar,
}: {
  siguienteMesa: number;
  onAbrir: (tipo: 'mesa' | 'nombre', identificador: string, paraLlevar: boolean) => Promise<void>;
  onCancelar: () => void;
}) {
  const [modo, setModo] = useState<ModoNuevaCuenta>('mesa');
  const [nombre, setNombre] = useState('');
  const [numero, setNumero] = useState(String(siguienteMesa));
  const [paraLlevar, setParaLlevar] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numeroMesa = Number(numero);
  const numeroValido = Number.isInteger(numeroMesa) && numeroMesa >= 1;
  const listo = modo === 'nombre' ? !!nombre.trim() : numeroValido;

  const cambiarNumero = (delta: number) => setNumero((n) => String(Math.max(1, (Number(n) || 0) + delta)));

  const [guardando, setGuardando] = useState(false);

  const confirmar = async () => {
    setGuardando(true);
    setError(null);
    try {
      // "Mesa N" es la misma etiqueta que usa la caja; en la base se guarda como código "N".
      if (modo === 'mesa') await onAbrir('mesa', `Mesa ${numeroMesa}`, paraLlevar);
      else await onAbrir('nombre', nombre, paraLlevar);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir la cuenta.');
      setGuardando(false);
    }
  };

  const claseOpcion = (activo: boolean) =>
    `rounded-xl border-2 p-3 space-y-2 transition-colors cursor-pointer ${
      activo ? 'border-emerald-400 bg-emerald-50/50' : 'border-neutral-200 bg-white hover:border-neutral-300'
    }`;

  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/30"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancelar}
    >
      <motion.div
        role="dialog"
        aria-labelledby="nueva-cuenta-titulo"
        className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5 space-y-3 max-h-[90vh] overflow-y-auto"
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="nueva-cuenta-titulo" className="text-base font-bold">
          Abrir cuenta
        </h2>

        {/* Opción 1: por nombre (cuentas.tipo_identificador = 'nombre') */}
        <div className={claseOpcion(modo === 'nombre')} onClick={() => setModo('nombre')}>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <User className="w-4 h-4 text-neutral-500" /> Por nombre
          </div>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onFocus={() => setModo('nombre')}
            placeholder="Nombre del cliente"
            className="w-full h-10 px-3 rounded-lg border border-neutral-300 bg-white text-sm focus:outline-none focus:border-amber-500 select-text"
          />
        </div>

        {/* Opción 2: número de mesa (cuentas.tipo_identificador = 'mesa'), consecutivo y sin límite */}
        <div className={claseOpcion(modo === 'mesa')} onClick={() => setModo('mesa')}>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Hash className="w-4 h-4 text-neutral-500" /> Núm. de mesa
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setModo('mesa');
                cambiarNumero(-1);
              }}
              aria-label="Mesa anterior"
              className="w-10 h-10 rounded-lg border border-neutral-300 bg-white flex items-center justify-center cursor-pointer"
            >
              <Minus className="w-4 h-4" />
            </button>
            <input
              value={numero}
              onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))}
              onFocus={() => setModo('mesa')}
              inputMode="numeric"
              aria-label="Número de mesa"
              className="flex-1 min-w-0 h-10 px-3 rounded-lg border border-neutral-300 bg-white text-center font-mono text-base font-bold focus:outline-none focus:border-amber-500 select-text"
            />
            <button
              type="button"
              onClick={() => {
                setModo('mesa');
                cambiarNumero(1);
              }}
              aria-label="Mesa siguiente"
              className="w-10 h-10 rounded-lg border border-neutral-300 bg-white flex items-center justify-center cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-neutral-500">Siguiente consecutivo: Mesa {siguienteMesa}</p>
        </div>

        {/* cuentas.para_llevar */}
        <SelectorTipoOrden paraLlevar={paraLlevar} onChange={setParaLlevar} compacto />

        {error && (
          <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button onClick={onCancelar} className="h-11 rounded-xl text-sm text-neutral-600 hover:bg-neutral-100 font-medium cursor-pointer">
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={!listo || guardando}
            className="h-11 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-200 disabled:text-neutral-500 disabled:cursor-not-allowed text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
          >
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
            {guardando ? 'Guardando…' : 'Abrir'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
