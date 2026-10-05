// App exclusiva de las tablets de los meseros (se abre en /tablet).
// Más adelante se moverá a su propio proyecto como PWA.
import React, { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  LayoutGrid,
  LogOut,
  Plus,
  User,
  UtensilsCrossed,
} from 'lucide-react';
import { Account, Comanda, Mesa, ProductCatalogItem, TabletDevice } from '../types/pos';
import { WAITERS_LIST, cuentaDeMesa, etiquetaMesa, posDataService } from '../services/dataService';
import { AppTabletCuenta, DialogoTipoOrden, SelectorTipoOrden } from './AppTabletCuenta';

const SESION_KEY = 'tablet_sesion'; // sin prefijo pos_ para no disparar la sincronización

function useDatosPos() {
  const [, setVersion] = useState(0);
  useEffect(() => posDataService.subscribe(() => setVersion((v) => v + 1)), []);
  return {
    tablets: posDataService.getTablets(),
    mesas: posDataService.getMesas(),
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
  const { tablets, mesas, cuentas, comandas, productos } = useDatosPos();
  const [tabletId, setTabletId] = useState<string | null>(leerSesion);

  const tablet = tablets.find((t) => t.id === tabletId);
  const sesionActiva = tablet && tablet.status === 'conectada';

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

  if (!tablet || !sesionActiva) {
    return <LoginTablet tablets={tablets} onLogin={handleLogin} />;
  }

  return (
    <PantallaMesero
      tablet={tablet}
      mesas={mesas}
      cuentas={cuentas}
      comandas={comandas}
      productos={productos}
      onLogout={handleLogout}
    />
  );
}

/* ---------- Inicio de sesión ---------- */

function LoginTablet({ tablets, onLogin }: { tablets: TabletDevice[]; onLogin: (id: string, mesero: string) => void }) {
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
    <div className="min-h-screen bg-neutral-100 text-neutral-900 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-lg bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
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
      </div>
    </div>
  );
}

/* ---------- Pantalla principal del mesero ---------- */

type Pestana = 'mesas' | 'listos';

function PantallaMesero({
  tablet,
  mesas,
  cuentas,
  comandas,
  productos,
  onLogout,
}: {
  tablet: TabletDevice;
  mesas: Mesa[];
  cuentas: Account[];
  comandas: Comanda[];
  productos: ProductCatalogItem[];
  onLogout: () => void;
}) {
  const [pestana, setPestana] = useState<Pestana>('mesas');
  const [cuentaAbiertaId, setCuentaAbiertaId] = useState<string | null>(null);

  const listos = comandas.filter((c) => c.status === 'lista' && c.sentByTablet === tablet.name);
  const cuentaAbierta = cuentaAbiertaId ? posDataService.getAccountById(cuentaAbiertaId) : undefined;

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 flex flex-col select-none">
      {/* Encabezado */}
      <header className="sticky top-0 z-20 bg-white border-b border-neutral-200">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-10 h-10 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center font-mono font-bold shrink-0">
              {tablet.number}
            </span>
            <div className="min-w-0">
              <div className="font-semibold truncate">{tablet.assignedWaiter}</div>
              <div className="text-xs text-neutral-500">Sesión desde {tablet.sessionStartedAt ?? '—'}</div>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="h-11 px-4 rounded-xl border border-neutral-200 text-neutral-600 hover:text-rose-700 hover:border-rose-200 flex items-center gap-2 text-sm font-medium cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        </div>

        {!cuentaAbierta && (
          <div className="px-4 pb-3 grid grid-cols-2 gap-2">
            <BotonPestana activo={pestana === 'mesas'} onClick={() => setPestana('mesas')} icon={LayoutGrid} label="Mesas" color="violet" />
            <BotonPestana
              activo={pestana === 'listos'}
              onClick={() => setPestana('listos')}
              icon={BellRing}
              label="Listos para servir"
              color="emerald"
              badge={listos.length || undefined}
            />
          </div>
        )}
      </header>

      <main className="flex-1 p-4">
        {cuentaAbierta ? (
          <AppTabletCuenta
            cuenta={cuentaAbierta}
            origen={tablet}
            productos={productos}
            onVolver={() => setCuentaAbiertaId(null)}
          />
        ) : pestana === 'mesas' ? (
          <VistaMesas tablet={tablet} mesas={mesas} cuentas={cuentas} onAbrirCuenta={setCuentaAbiertaId} />
        ) : (
          <VistaListos comandas={listos} />
        )}
      </main>
    </div>
  );
}

function BotonPestana({
  activo,
  onClick,
  icon: Icon,
  label,
  color,
  badge,
}: {
  activo: boolean;
  onClick: () => void;
  icon: typeof LayoutGrid;
  label: string;
  color: 'violet' | 'emerald';
  badge?: number;
}) {
  const estilos = {
    violet: activo ? 'bg-violet-100 border-violet-400 text-violet-900' : 'bg-violet-50 border-violet-200 text-violet-800',
    emerald: activo ? 'bg-emerald-100 border-emerald-400 text-emerald-900' : 'bg-emerald-50 border-emerald-200 text-emerald-800',
  };
  return (
    <button
      onClick={onClick}
      className={`relative h-12 rounded-xl border-2 flex items-center justify-center gap-2 font-medium cursor-pointer ${estilos[color]} ${
        activo ? 'font-semibold' : ''
      }`}
    >
      <Icon className="w-5 h-5" />
      <span>{label}</span>
      {badge !== undefined && (
        <span className="min-w-6 h-6 px-1.5 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );
}

/* ---------- Mesas ---------- */

function VistaMesas({
  tablet,
  mesas,
  cuentas,
  onAbrirCuenta,
}: {
  tablet: TabletDevice;
  mesas: Mesa[];
  cuentas: Account[];
  onAbrirCuenta: (accountId: string) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [nombreParaLlevar, setNombreParaLlevar] = useState(false);
  const [mostrarNombre, setMostrarNombre] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Mesa libre tocada: antes de abrirla se pregunta el tipo de orden.
  const [mesaPorAbrir, setMesaPorAbrir] = useState<Mesa | null>(null);

  const cuentasPorNombre = cuentas.filter((a) => a.identifierType === 'nombre');

  const abrir = (tipo: 'mesa' | 'nombre', identificador: string, paraLlevar: boolean) => {
    try {
      const cuenta = posDataService.simulateIncomingAccount(
        tipo,
        identificador,
        tablet.name,
        tablet.assignedWaiter,
        paraLlevar
      );
      setError(null);
      setNombre('');
      setNombreParaLlevar(false);
      setMostrarNombre(false);
      setMesaPorAbrir(null);
      onAbrirCuenta(cuenta.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir la cuenta.');
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Mesas</h2>
        {mesas.length === 0 ? (
          <p className="text-sm text-neutral-500">No hay mesas registradas. Pídelas a caja.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {mesas.map((mesa) => {
              const cuenta = cuentaDeMesa(mesa, cuentas);
              const pidio = cuenta?.status === 'cuenta_solicitada';
              return (
                <button
                  key={mesa.id}
                  onClick={() => (cuenta ? onAbrirCuenta(cuenta.id) : setMesaPorAbrir(mesa))}
                  className={`min-h-28 rounded-2xl border-2 p-4 text-left flex flex-col justify-between transition-colors cursor-pointer ${
                    !cuenta
                      ? 'bg-white border-neutral-200 hover:border-emerald-300'
                      : pidio
                      ? 'bg-amber-50 border-amber-300'
                      : 'bg-sky-50 border-sky-300'
                  }`}
                >
                  <span className="text-2xl font-bold leading-tight break-words">{etiquetaMesa(mesa)}</span>
                  {cuenta ? (
                    <div className="text-sm">
                      <div className={pidio ? 'text-amber-800 font-medium' : 'text-sky-800 font-medium'}>
                        {pidio ? 'Cuenta pedida' : 'Ocupada'} · ${cuenta.total.toFixed(2)}
                      </div>
                      {cuenta.paraLlevar && (
                        <span className="text-[10px] font-black tracking-wider px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 border border-violet-300">
                          PARA LLEVAR
                        </span>
                      )}
                      <div className="text-xs text-neutral-500 truncate">{cuenta.waiterName}</div>
                    </div>
                  ) : (
                    <div className="text-sm text-emerald-700 font-medium flex items-center gap-1">
                      <Plus className="w-4 h-4" /> Abrir mesa
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Cuentas por nombre</h2>
          {!mostrarNombre && (
            <button
              onClick={() => setMostrarNombre(true)}
              className="h-11 px-4 rounded-xl bg-white border border-neutral-200 hover:border-neutral-300 text-sm font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Nueva
            </button>
          )}
        </div>

        {mostrarNombre && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              abrir('nombre', nombre, nombreParaLlevar);
            }}
            className="grid gap-2 sm:grid-cols-[1fr_auto_auto]"
          >
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
              placeholder="Nombre del cliente"
              className="flex-1 h-12 px-4 rounded-xl border border-neutral-300 bg-white text-base focus:outline-none focus:border-amber-500 select-text"
            />
            <button type="submit" className="h-12 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 font-semibold cursor-pointer">
              Abrir
            </button>
            <button
              type="button"
              onClick={() => setMostrarNombre(false)}
              className="h-12 px-4 rounded-xl text-neutral-600 hover:bg-neutral-200 cursor-pointer"
            >
              Cancelar
            </button>
            <div className="sm:col-span-3">
              <SelectorTipoOrden paraLlevar={nombreParaLlevar} onChange={setNombreParaLlevar} compacto />
            </div>
          </form>
        )}

        {cuentasPorNombre.length === 0 ? (
          !mostrarNombre && <p className="text-sm text-neutral-500">No hay cuentas abiertas por nombre.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cuentasPorNombre.map((c) => (
              <button
                key={c.id}
                onClick={() => onAbrirCuenta(c.id)}
                className="min-h-16 rounded-2xl border-2 bg-white border-neutral-200 hover:border-sky-300 p-4 text-left flex items-center justify-between gap-3 cursor-pointer"
              >
                <span className="font-semibold truncate">
                  {c.identifier}
                  {c.paraLlevar && (
                        <span className="ml-1.5 text-[10px] font-black tracking-wider px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 border border-violet-300">
                          PARA LLEVAR
                        </span>
                      )}
                </span>
                <span className="font-mono text-sm text-neutral-600">${c.total.toFixed(2)}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <AnimatePresence>
        {mesaPorAbrir && (
          <DialogoTipoOrden
            titulo={`Abrir ${etiquetaMesa(mesaPorAbrir)}`}
            onElegir={(paraLlevar) => abrir('mesa', etiquetaMesa(mesaPorAbrir), paraLlevar)}
            onCancelar={() => setMesaPorAbrir(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- Listos para servir ---------- */

function VistaListos({ comandas }: { comandas: Comanda[] }) {
  if (comandas.length === 0) {
    return (
      <div className="text-center text-neutral-500 py-16">
        <CheckCircle2 className="w-10 h-10 mx-auto text-neutral-300 mb-2" />
        No hay pedidos listos por ahora.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {comandas.map((c) => (
        <div key={c.id} className="bg-white border-2 border-emerald-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xl font-bold">
              {c.accountIdentifier}
              {c.paraLlevar && (
                <span className="ml-2 align-middle text-[10px] font-black tracking-wider px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 border border-violet-300">
                  PARA LLEVAR
                </span>
              )}
            </span>
            <span className="text-xs font-mono text-neutral-500">{c.orderNumber}</span>
          </div>
          <ul className="text-sm space-y-1">
            {c.items.map((it) => (
              <li key={it.id}>
                <span className="font-semibold">{it.quantity}×</span> {it.productName}
              </li>
            ))}
          </ul>
          <button
            onClick={() => posDataService.kitchenMarkDelivered(c.id)}
            className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center justify-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="w-5 h-5" /> Entregado en mesa
          </button>
        </div>
      ))}
    </div>
  );
}

