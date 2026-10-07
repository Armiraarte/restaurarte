// App exclusiva de las tablets de los meseros (se abre en /tablet).
// Más adelante se moverá a su propio proyecto como PWA.
import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Eye,
  EyeOff,
  Hash,
  Loader2,
  Lock,
  LogOut,
  Minus,
  Monitor,
  Plus,
  User,
  UtensilsCrossed,
} from 'lucide-react';
import { Account, ProductCatalogItem, TabletDevice } from '../types/pos';
import { WAITERS_LIST, posDataService } from '../services/dataService';
import { AppTabletCuenta, SelectorTipoOrden } from './AppTabletCuenta';
import { BotonInstalarPwa } from './InstalarPwa';
import { login, logout as cerrarSesionCuenta, obtenerSesion, Rol, Usuario } from '../services/authService';
import { salirDeLinea } from '../services/tabletsService';
import { AvisoVerificacion, useLatidoTablet } from './VerificacionConexion';

// Cuentas que pueden abrir la app de meseros (se crean en Configuración → Usuarios).
const ROLES_TABLET: Rol[] = ['tablet', 'admin'];

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

  useEffect(() => {
    obtenerSesion()
      .then((u) => setCuenta(u && ROLES_TABLET.includes(u.rol) ? u : null))
      .catch(() => setCuenta(null))
      .finally(() => setVerificandoCuenta(false));
  }, []);

  const tablet = tablets.find((t) => t.id === tabletId);
  const sesionActiva = tablet && tablet.status === 'conectada';

  // Mientras haya cuenta, la tablet avisa a caja que está en línea y atiende "Verificar conexión".
  const faseVerificacion = useLatidoTablet(
    !!cuenta,
    sesionActiva ? tablet.number : null,
    sesionActiva ? tablet.assignedWaiter : null,
  );

  const handleLogin = (id: string, mesero: string) => {
    posDataService.tabletLogin(id, mesero);
    guardarSesion(id);
    setTabletId(id);
  };

  const handleLogout = () => {
    if (tablet) posDataService.tabletLogout(tablet.id);
    guardarSesion(null);
    setTabletId(null);
  };

  // Cierra la sesión de la cuenta: la tablet vuelve a pedir usuario y contraseña/PIN.
  const handleCerrarCuenta = () => {
    handleLogout();
    salirDeLinea().catch(() => {}); // antes de borrar el token, para que caja deje de verla en línea
    cerrarSesionCuenta();
    setCuenta(null);
  };

  let pantalla: React.ReactNode;
  if (verificandoCuenta) {
    pantalla = <div className="h-dvh bg-neutral-100" />;
  } else if (!cuenta) {
    pantalla = <LoginCuentaTablet onLogin={setCuenta} />;
  } else if (!tablet || !sesionActiva) {
    pantalla = <LoginTablet tablets={tablets} cuenta={cuenta} onLogin={handleLogin} onCerrarCuenta={handleCerrarCuenta} />;
  } else {
    pantalla = <PantallaMesero tablet={tablet} cuentas={cuentas} productos={productos} onLogout={handleLogout} />;
  }

  return (
    <>
      {pantalla}
      <AvisoVerificacion fase={faseVerificacion} />
    </>
  );
}

/* ---------- Inicio de sesión ---------- */

/** Paso 1: usuario y contraseña/PIN de una cuenta creada en Configuración → Usuarios. */
function LoginCuentaTablet({ onLogin }: { onLogin: (u: Usuario) => void }) {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario.trim() || !password) {
      setError('Ingresa tu usuario y tu contraseña o PIN.');
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const u = await login(usuario, password);
      if (!ROLES_TABLET.includes(u.rol)) {
        cerrarSesionCuenta();
        throw new Error('Esta cuenta no tiene acceso a la app de meseros.');
      }
      onLogin(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
      setCargando(false);
    }
  };

  const claseInput =
    'w-full h-14 bg-neutral-50 border-2 border-neutral-200 rounded-xl pl-11 pr-4 text-lg text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-amber-400 select-text';

  return (
    <div className="h-dvh overflow-hidden bg-neutral-100 text-neutral-900 flex items-center justify-center p-4 select-none">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md max-h-full overflow-y-auto bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-5 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center">
            <UtensilsCrossed className="w-6 h-6 text-neutral-950" />
          </span>
          <div>
            <div className="text-2xl font-bold tracking-tight">RESTAURARTE</div>
            <div className="text-sm text-neutral-500">App de meseros · Iniciar sesión</div>
          </div>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-neutral-700">Usuario</span>
          <div className="relative">
            <User className="w-5 h-5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              autoFocus
              autoCapitalize="none"
              autoComplete="username"
              placeholder="usuario"
              className={claseInput}
            />
          </div>
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-neutral-700">Contraseña o PIN</span>
          <div className="relative">
            <Lock className="w-5 h-5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type={mostrar ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••"
              className={`${claseInput} pr-12`}
            />
            <button
              type="button"
              onClick={() => setMostrar((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-neutral-500 hover:text-neutral-700 cursor-pointer"
              aria-label={mostrar ? 'Ocultar' : 'Mostrar'}
            >
              {mostrar ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </label>

        {error && (
          <div className="flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={cargando}
          className="w-full h-14 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-neutral-950 text-lg font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          {cargando && <Loader2 className="w-5 h-5 animate-spin" />}
          {cargando ? 'Verificando…' : 'Entrar'}
        </button>

        <BotonInstalarPwa nombreApp="de meseros" />

        <a
          href="/"
          className="flex items-center justify-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 transition-colors"
        >
          <Monitor className="w-4 h-4" />
          Ir al inicio de sesión de caja
        </a>
      </form>
    </div>
  );
}

/** Paso 2: con la cuenta ya validada, se elige el número de tablet y el mesero. */
function LoginTablet({
  tablets,
  cuenta,
  onLogin,
  onCerrarCuenta,
}: {
  tablets: TabletDevice[];
  cuenta: Usuario;
  onLogin: (id: string, mesero: string) => void;
  onCerrarCuenta: () => void;
}) {
  const [tabletId, setTabletId] = useState(tablets[0]?.id ?? '');
  const [mesero, setMesero] = useState(WAITERS_LIST[0] ?? '');
  const [error, setError] = useState<string | null>(null);

  const entrar = () => {
    try {
      onLogin(tabletId, mesero);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
    }
  };

  return (
    <div className="h-dvh overflow-hidden bg-neutral-100 text-neutral-900 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-lg max-h-full overflow-y-auto bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center">
            <UtensilsCrossed className="w-6 h-6 text-neutral-950" />
          </span>
          <div>
            <div className="text-2xl font-bold tracking-tight">RESTAURARTE</div>
            <div className="text-sm text-neutral-500">App de meseros</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold text-neutral-700">Tablet</div>
          <div className="grid grid-cols-4 gap-2">
            {tablets.map((t) => (
              <button
                key={t.id}
                onClick={() => setTabletId(t.id)}
                className={`h-16 rounded-xl border-2 font-mono text-xl font-bold transition-colors cursor-pointer ${
                  tabletId === t.id
                    ? 'bg-sky-100 border-sky-400 text-sky-900'
                    : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                {t.number}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold text-neutral-700">Mesero</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {WAITERS_LIST.map((w) => (
              <button
                key={w}
                onClick={() => setMesero(w)}
                className={`h-14 px-4 rounded-xl border-2 flex items-center gap-2 text-left font-medium transition-colors cursor-pointer ${
                  mesero === w
                    ? 'bg-sky-100 border-sky-400 text-sky-900'
                    : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                <User className="w-5 h-5 shrink-0" />
                <span className="truncate">{w}</span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <button
          onClick={entrar}
          disabled={!tabletId || !mesero}
          className="w-full h-14 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 text-lg font-semibold transition-colors cursor-pointer"
        >
          Iniciar sesión
        </button>

        <div className="flex items-center justify-between gap-3 pt-1 text-sm text-neutral-500">
          <span className="truncate">
            Cuenta: <span className="font-medium text-neutral-800">{cuenta.nombre}</span>
          </span>
          <button
            type="button"
            onClick={onCerrarCuenta}
            className="flex items-center gap-1.5 shrink-0 hover:text-rose-700 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Pantalla principal del mesero ---------- */

function PantallaMesero({
  tablet,
  cuentas,
  productos,
  onLogout,
}: {
  tablet: TabletDevice;
  cuentas: Account[];
  productos: ProductCatalogItem[];
  onLogout: () => void;
}) {
  const [cuentaAbiertaId, setCuentaAbiertaId] = useState<string | null>(null);
  const cuentaAbierta = cuentaAbiertaId ? posDataService.getAccountById(cuentaAbiertaId) : undefined;

  return (
    // Ocupa exactamente la pantalla (100dvh): sin scroll de página; solo se desplaza el recuadro que no quepa.
    <div className="h-dvh overflow-hidden bg-neutral-100 text-neutral-900 flex flex-col select-none">
      {/* Encabezado: mesero en sesión.
          BD: tablets.mesero_id → usuarios.nombre; "Sesión desde" = inicio de la sesión de la tablet. */}
      <header className="shrink-0 bg-white border-b border-neutral-200">
        <div className="px-3 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
              <User className="w-4 h-4" />
            </span>
            <div className="min-w-0 leading-tight">
              <div className="text-sm font-semibold truncate">{tablet.assignedWaiter}</div>
              <div className="text-[11px] text-neutral-500">Sesión desde {tablet.sessionStartedAt ?? '—'}</div>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="h-9 px-3 rounded-lg border border-neutral-200 text-neutral-600 hover:text-rose-700 hover:border-rose-200 flex items-center gap-1.5 text-xs font-medium cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 p-3">
        {cuentaAbierta ? (
          <AppTabletCuenta
            cuenta={cuentaAbierta}
            origen={tablet}
            productos={productos}
            pantallaCompleta
            onVolver={() => setCuentaAbiertaId(null)}
          />
        ) : (
          <VistaMesas tablet={tablet} cuentas={cuentas} onAbrirCuenta={setCuentaAbiertaId} />
        )}
      </main>
    </div>
  );
}

/* ---------- Mesas ---------- */

/**
 * Cuadrícula de cuentas abiertas (por número de mesa y por nombre) + botón "+" para abrir una nueva.
 *
 * BD (tabla `cuentas`), una tarjeta por fila con estado <> 'pagada':
 *   - título          → identificador ("Mesa 7" o "Juan")
 *   - PARA LLEVAR/... → para_llevar
 *   - Ocupada/Pedida  → estado ('abierta' | 'cuenta_solicitada')
 *   - total           → suma de partidas de la cuenta
 *   - mesero          → mesero_id → usuarios.nombre
 * Orden: primero las mesas por número (ascendente), después las cuentas por nombre (alfabético).
 */
function VistaMesas({
  tablet,
  cuentas,
  onAbrirCuenta,
}: {
  tablet: TabletDevice;
  cuentas: Account[];
  onAbrirCuenta: (accountId: string) => void;
}) {
  const [nuevaAbierta, setNuevaAbierta] = useState(false);

  const abiertas = cuentas.filter((c) => c.status !== 'pagada');
  const porMesa = abiertas
    .filter((c) => c.identifierType === 'mesa')
    .sort((a, b) => (a.tableNumber ?? 0) - (b.tableNumber ?? 0));
  const porNombre = abiertas
    .filter((c) => c.identifierType === 'nombre')
    .sort((a, b) => a.identifier.localeCompare(b.identifier));
  const tarjetas = [...porMesa, ...porNombre];

  // Siguiente número consecutivo: el mayor número de mesa con cuenta abierta + 1 (o 1 si no hay).
  // BD: SELECT COALESCE(MAX(numero_mesa), 0) + 1 FROM cuentas WHERE estado <> 'pagada'
  const siguienteMesa = porMesa.reduce((max, c) => Math.max(max, c.tableNumber ?? 0), 0) + 1;

  // BD: INSERT INTO cuentas (tipo_identificador, identificador, numero_mesa, mesero_id, tablet_id, para_llevar, estado)
  //     → 'mesa' | 'nombre', "Mesa N" | nombre, N | NULL, mesero en sesión, tablet en sesión, true/false, 'abierta'
  const abrir = (tipo: 'mesa' | 'nombre', identificador: string, paraLlevar: boolean) => {
    const cuenta = posDataService.simulateIncomingAccount(tipo, identificador, tablet.name, tablet.assignedWaiter, paraLlevar);
    setNuevaAbierta(false);
    onAbrirCuenta(cuenta.id);
  };

  return (
    <section className="h-full min-h-0 flex flex-col gap-2">
      <h2 className="shrink-0 text-sm font-bold text-neutral-700">Mesas</h2>

      {/* Si hay más mesas de las que caben, solo esta zona se desplaza (la página no) */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 auto-rows-min content-start gap-2">
        {tarjetas.map((cuenta) => {
          const pidio = cuenta.status === 'cuenta_solicitada';
          return (
            <button
              key={cuenta.id}
              onClick={() => onAbrirCuenta(cuenta.id)}
              className={`min-h-20 rounded-xl border-2 p-2.5 text-left flex flex-col justify-between gap-2 transition-colors cursor-pointer ${
                pidio ? 'bg-amber-50 border-amber-300' : 'bg-sky-50 border-sky-300'
              }`}
            >
              {/* Título y, en el otro extremo, el tipo de orden (cuentas.para_llevar) */}
              <div className="flex items-start justify-between gap-1.5">
                <span className="text-sm font-bold leading-tight break-words min-w-0">{cuenta.identifier}</span>
                <span
                  className={`shrink-0 text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded border ${
                    cuenta.paraLlevar
                      ? 'bg-violet-100 text-violet-800 border-violet-300'
                      : 'bg-white text-sky-800 border-sky-200'
                  }`}
                >
                  {cuenta.paraLlevar ? 'PARA LLEVAR' : 'COMER AQUÍ'}
                </span>
              </div>
              <div className="leading-tight">
                <div className={`text-xs font-medium ${pidio ? 'text-amber-800' : 'text-sky-800'}`}>
                  {pidio ? 'Cuenta pedida' : 'Ocupada'} · ${cuenta.total.toFixed(2)}
                </div>
                <div className="text-[11px] text-neutral-500 truncate">{cuenta.waiterName}</div>
              </div>
            </button>
          );
        })}

        {/* Abrir una cuenta nueva */}
        <button
          onClick={() => setNuevaAbierta(true)}
          aria-label="Abrir cuenta"
          title="Abrir cuenta"
          className="min-h-20 rounded-xl border-2 border-dashed border-neutral-300 bg-white text-neutral-500 hover:border-emerald-400 hover:text-emerald-700 flex items-center justify-center transition-colors cursor-pointer"
        >
          <Plus className="w-7 h-7" />
        </button>
      </div>

      <AnimatePresence>
        {nuevaAbierta && (
          <DialogoNuevaCuenta siguienteMesa={siguienteMesa} onAbrir={abrir} onCancelar={() => setNuevaAbierta(false)} />
        )}
      </AnimatePresence>
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
  onAbrir: (tipo: 'mesa' | 'nombre', identificador: string, paraLlevar: boolean) => void;
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

  const confirmar = () => {
    try {
      // "Mesa N" es la misma etiqueta que usa la caja; tableNumber (numero_mesa) se obtiene de N.
      if (modo === 'mesa') onAbrir('mesa', `Mesa ${numeroMesa}`, paraLlevar);
      else onAbrir('nombre', nombre, paraLlevar);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir la cuenta.');
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
            disabled={!listo}
            className="h-11 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-200 disabled:text-neutral-500 disabled:cursor-not-allowed text-sm font-semibold cursor-pointer"
          >
            Abrir
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
