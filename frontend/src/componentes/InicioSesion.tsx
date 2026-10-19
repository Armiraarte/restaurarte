// Inicio de sesión único de las dos apps del sistema: Meseros (/tablet) y Caja (/).
//   1. Selector 50/50: Meseros | Caja, con el logo de la cenaduría sobre la división.
//   2. Formulario del lado elegido: panel de marca + usuario y contraseña.
// Cada app vive en su ruta y se instala por separado (manifest-tablet.webmanifest y manifest.webmanifest).
// Cambiar de acceso no recarga el documento: conserva la ventana instalada y la pantalla completa.
import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Info,
  Loader2,
  Lock,
  LucideIcon,
  Monitor,
  TabletSmartphone,
  User,
} from 'lucide-react';
import { login, logout, ROLES_APP_MESEROS, Usuario } from '../services/authService';
import { BotonInstalarPwa } from './InstalarPwa';
import { LogoRestaurante } from './Marca';
import { AppInicio, navegarApp } from '../services/appNavigation';

export type { AppInicio } from '../services/appNavigation';

interface Lado {
  titulo: string;
  descripcion: string;
  accion: string;
  /** Etiqueta del panel de marca en el formulario. */
  etiqueta: string;
  ayuda: string;
  campoPassword: string;
  faltanDatos: string;
  Icono: LucideIcon;
  fondo: string;
  brillos: [string, string];
  puedeEntrar: (u: Usuario) => boolean;
  sinAcceso: string;
}

const LADOS: Record<AppInicio, Lado> = {
  meseros: {
    titulo: 'Tablet',
    descripcion: 'Meseros: órdenes y pedidos a cocina.',
    accion: 'Abrir versión tablet',
    etiqueta: 'Versión tablet',
    ayuda: 'Entra con la cuenta de esta tablet.',
    campoPassword: 'Contraseña o PIN',
    faltanDatos: 'Ingresa tu usuario y tu contraseña o PIN.',
    Icono: TabletSmartphone,
    fondo: 'bg-gradient-to-br from-red-600 via-red-700 to-red-900',
    brillos: ['-top-24 -left-24 bg-fuego/30', '-bottom-28 -right-20 bg-diablito/25'],
    puedeEntrar: (u) => ROLES_APP_MESEROS.includes(u.rol),
    sinAcceso: 'Esta cuenta no tiene acceso a la app de meseros.',
  },
  caja: {
    titulo: 'PC',
    descripcion: 'Caja: cobros, turnos y cortes.',
    accion: 'Entrar a la PC',
    etiqueta: 'Versión PC',
    ayuda: 'Entra con tu usuario de caja.',
    campoPassword: 'Contraseña',
    faltanDatos: 'Ingresa tu usuario y tu contraseña.',
    Icono: Monitor,
    fondo: 'bg-gradient-to-br from-neutral-800 via-amber-950 to-red-950',
    brillos: ['-top-24 -right-24 bg-fuego/20', '-bottom-28 -left-20 bg-queso/10'],
    // Las cuentas de tablet solo usan la app de meseros (App.tsx también las manda a /tablet).
    puedeEntrar: (u) => u.rol !== 'tablet',
    sinAcceso: 'Esta es una cuenta de tablet: entra por la versión tablet.',
  },
};

/**
 * `app`: la app de la ruta actual. Al entrar con su cuenta se llama a `onEntrar`.
 * `aviso`: por qué se volvió aquí sin cerrar sesión (p. ej. se entró con la cuenta en otro dispositivo).
 */
export const InicioSesion: React.FC<{ app: AppInicio; aviso?: string | null; onEntrar: (u: Usuario) => void }> = ({
  app,
  aviso = null,
  onEntrar,
}) => {
  // ?app=… llega cuando se eligió esta app desde la otra ruta: se abre directo su formulario.
  // Con aviso también, para que se lea.
  const [elegida, setElegida] = useState<AppInicio | null>(() =>
    aviso || new URLSearchParams(window.location.search).get('app') === app ? app : null,
  );
  // Escala todo el inicio de sesión para que quepa sin scroll (ver html.inicio-sesion en index.css).
  useEffect(() => {
    document.documentElement.classList.add('inicio-sesion');
    return () => document.documentElement.classList.remove('inicio-sesion');
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('app')) return;
    url.searchParams.delete('app');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const elegir = (lado: AppInicio) => {
    if (lado === app) setElegida(lado);
    else navegarApp(lado, { formulario: true });
  };

  return elegida ? (
    <FormularioInicio
      key={elegida}
      lado={elegida}
      aviso={elegida === app ? aviso : null}
      onVolver={() => setElegida(null)}
      onEntrar={onEntrar}
    />
  ) : (
    <SelectorApp onElegir={elegir} />
  );
};

/* ---------- 1. Selector 50/50 ---------- */

function SelectorApp({ onElegir }: { onElegir: (lado: AppInicio) => void }) {
  return (
    <div
      className="relative h-dvh overflow-hidden grid landscape:grid-cols-2 portrait:grid-rows-2 select-none"
    >
      <LadoSelector lado="meseros" onElegir={onElegir} />
      <LadoSelector lado="caja" onElegir={onElegir} />

      {/* Logo redondo sobre la división */}
      <img
        src="/icons/cenaduria-512.png"
        alt="Cenaduría Los Diablitos"
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[clamp(7rem,20vmin,12rem)] aspect-square rounded-full bg-white ring-8 ring-white/90 shadow-2xl shadow-black/50"
      />

      <p className="pointer-events-none absolute top-5 inset-x-0 text-center">
        <span className="inline-block rounded-full bg-black/35 backdrop-blur-sm px-5 py-2 text-base font-semibold text-crema">
          ¿Qué versión vas a usar?
        </span>
      </p>
      <p className="pointer-events-none absolute bottom-3 inset-x-0 text-center text-xs text-crema/80">
        SOFT RESTAURANTE · Hecho por <strong className="font-bold tracking-wide text-crema">ARMIRARTE</strong>
      </p>
    </div>
  );
}

function LadoSelector({ lado, onElegir }: { lado: AppInicio; onElegir: (lado: AppInicio) => void }) {
  const l = LADOS[lado];
  // El contenido se aleja de la división para no quedar debajo del logo del centro.
  const lejosDelLogo =
    lado === 'meseros'
      ? 'landscape:pr-[clamp(4rem,12vmin,7rem)] portrait:pb-[clamp(4rem,12vmin,7rem)]'
      : 'landscape:pl-[clamp(4rem,12vmin,7rem)] portrait:pt-[clamp(4rem,12vmin,7rem)]';

  return (
    <button
      type="button"
      onClick={() => onElegir(lado)}
      className={`relative overflow-hidden ${l.fondo} ${lejosDelLogo} text-crema flex flex-col items-center justify-center gap-4 sm:gap-5 px-8 py-6 sm:py-10 text-center cursor-pointer transition-[filter] duration-200 hover:brightness-110 active:brightness-95 focus-visible:outline-none focus-visible:ring-8 focus-visible:ring-inset focus-visible:ring-queso`}
    >
      <Brillos lado={lado} />
      <span className="relative flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-white/10 ring-1 ring-white/25 shadow-lg">
        <l.Icono className="w-10 h-10 sm:w-12 sm:h-12" />
      </span>
      <span className="relative block text-4xl sm:text-5xl font-extrabold tracking-tight">{l.titulo}</span>
      <span className="relative block max-w-xs text-balance text-base sm:text-lg text-crema/85">{l.descripcion}</span>
      <span className="relative inline-flex items-center gap-2 rounded-full bg-crema px-5 py-2.5 sm:px-6 sm:py-3 text-base sm:text-lg font-bold text-infernal shadow-lg">
        {l.accion}
        <ArrowRight className="w-5 h-5" />
      </span>
    </button>
  );
}

/** Brillos cálidos de fondo (brasas) de cada lado. */
function Brillos({ lado }: { lado: AppInicio }) {
  return (
    <>
      {LADOS[lado].brillos.map((clase) => (
        <span key={clase} aria-hidden="true" className={`pointer-events-none absolute w-80 h-80 rounded-full blur-3xl ${clase}`} />
      ))}
    </>
  );
}

/* ---------- 2. Formulario del lado elegido ---------- */

function FormularioInicio({
  lado,
  aviso: avisoInicial,
  onVolver,
  onEntrar,
}: {
  lado: AppInicio;
  aviso: string | null;
  onVolver: () => void;
  onEntrar: (u: Usuario) => void;
}) {
  const l = LADOS[lado];
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState(avisoInicial);
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAviso(null);
    if (!usuario.trim() || !password) {
      setError(l.faltanDatos);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const u = await login(usuario, password);
      if (!l.puedeEntrar(u)) {
        logout();
        throw new Error(l.sinAcceso);
      }
      onEntrar(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
      setCargando(false);
    }
  };

  // Tras un intento fallido se marca el campo que quedó vacío.
  const faltaUsuario = !!error && !usuario.trim();
  const faltaPassword = !!error && !password;

  const claseInput =
    'w-full h-16 bg-white border-2 border-neutral-300 rounded-2xl pl-14 pr-4 text-xl text-neutral-900 placeholder:text-neutral-400 transition-colors focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 aria-[invalid=true]:border-rose-400 select-text';
  const claseIcono = 'pointer-events-none w-6 h-6 text-neutral-400 absolute left-5 top-1/2 -translate-y-1/2';

  return (
    // Pantalla fija, sin scroll: todo cabe en el alto de la tablet (la escala está en html.inicio-sesion).
    // Horizontal: marca a un lado y formulario al otro. Vertical: marca arriba y la tarjeta encima.
    <div className="h-dvh overflow-hidden grid landscape:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] portrait:grid-rows-[auto_minmax(0,1fr)] text-neutral-900 select-none">
      {/* Marca: el logo va sobre una placa blanca para que su fondo blanco no se note */}
      <aside className={`relative overflow-hidden ${l.fondo} flex flex-col items-center justify-center gap-6 px-8 py-10 portrait:min-h-[34dvh] portrait:gap-4 portrait:pt-8 portrait:pb-16 portrait:rounded-b-[2.5rem]`}>
        <Brillos lado={lado} />
        <div className="relative w-full max-w-md portrait:max-w-xs bg-white rounded-[2rem] p-7 portrait:p-4 shadow-2xl shadow-black/40 ring-4 ring-white/20">
          <LogoRestaurante className="w-full" />
        </div>
        <p className="relative max-w-sm text-center text-lg font-medium leading-snug text-crema">
          Aquí se cena como los Dioses aunque nos llamen Diablitos
        </p>
        <span className="relative inline-flex items-center gap-2 rounded-full bg-queso px-4 py-1.5 text-sm font-bold text-infernal shadow-sm">
          <l.Icono className="w-4 h-4" />
          {l.etiqueta}
        </span>
      </aside>

      {/* Formulario */}
      <main className="min-h-0 flex flex-col items-center justify-center portrait:justify-start px-5 sm:px-10 py-6 portrait:pt-0 portrait:pb-4">
        <form
          onSubmit={handleSubmit}
          className="relative w-full max-w-md portrait:-mt-10 bg-white rounded-3xl border border-neutral-200 shadow-xl shadow-infernal/10 p-7 space-y-5"
        >
          <div>
            <button
              type="button"
              onClick={onVolver}
              className="-ml-2 mb-1 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-base font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
              Tablet o PC
            </button>
            <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">Iniciar sesión</h1>
            <p className="mt-1 text-base text-neutral-600">{l.ayuda}</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="inicio-usuario" className="block text-base font-semibold text-neutral-800">
              Usuario
            </label>
            <div className="relative">
              <User className={claseIcono} />
              <input
                id="inicio-usuario"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                // En la tablet el teclado no se abre solo: aparece hasta que se toca el campo. En la PC sí se enfoca.
                autoFocus={!window.matchMedia('(hover: none)').matches}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="username"
                enterKeyHint="next"
                placeholder="Escribe tu usuario"
                aria-invalid={faltaUsuario}
                className={claseInput}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="inicio-password" className="block text-base font-semibold text-neutral-800">
              {l.campoPassword}
            </label>
            <div className="relative">
              <Lock className={claseIcono} />
              <input
                id="inicio-password"
                type={mostrar ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                enterKeyHint="go"
                placeholder="••••"
                aria-invalid={faltaPassword}
                className={`${claseInput} pr-16`}
              />
              <button
                type="button"
                onClick={() => setMostrar((v) => !v)}
                aria-label={mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={mostrar}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 rounded-xl flex items-center justify-center text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                {mostrar ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
              </button>
            </div>
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2.5 text-base text-rose-800 bg-rose-50 border border-rose-200 px-4 py-3 rounded-xl">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}
          {!error && aviso && (
            <div role="status" className="flex items-start gap-2.5 text-base text-amber-900 bg-amber-50 border border-amber-200 px-4 py-3 rounded-xl">
              <Info className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
              <span>{aviso}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={cargando}
            className="w-full h-16 rounded-2xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed text-neutral-950 text-xl font-bold flex items-center justify-center gap-2.5 shadow-lg shadow-amber-500/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-500/40"
          >
            {cargando ? <Loader2 className="w-6 h-6 animate-spin" /> : null}
            {cargando ? 'Verificando…' : 'Entrar'}
            {!cargando && <ArrowRight className="w-6 h-6" />}
          </button>

          <div className="pt-4 border-t border-neutral-200">
            <BotonInstalarPwa nombreApp={lado === 'meseros' ? 'de meseros' : 'de caja'} variante="contorno" />
          </div>
        </form>

        <p className="mt-4 portrait:mt-auto portrait:pt-4 text-center text-sm text-neutral-600">
          SOFT RESTAURANTE · Hecho por <strong className="font-bold tracking-wide text-infernal">ARMIRARTE</strong>
        </p>
      </main>
    </div>
  );
}
