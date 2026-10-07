// Configuración → Usuarios: alta de administradores y tablets, y la plantilla actual.
import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Hash, KeyRound, Loader2, ShieldCheck, Tablet, UserPlus } from 'lucide-react';
import { Rol } from '../services/authService';
import { crearUsuario, listarUsuarios, RolCreable, TipoAcceso, UsuarioPlantilla } from '../services/usuariosService';

const FORMATO_PIN = /^\d{4,6}$/;

const TIPOS: { rol: RolCreable; label: string; detalle: string; icon: typeof ShieldCheck; activo: string }[] = [
  {
    rol: 'admin',
    label: 'Administrador',
    detalle: 'Acceso completo a la caja y a Configuración.',
    icon: ShieldCheck,
    activo: 'bg-violet-50 border-violet-400 text-violet-900',
  },
  {
    rol: 'tablet',
    label: 'Tablet',
    detalle: 'Cuenta para una tablet de meseros.',
    icon: Tablet,
    activo: 'bg-sky-50 border-sky-400 text-sky-900',
  },
];

const ETIQUETA_ROL: Record<Rol, { texto: string; clase: string }> = {
  admin: { texto: 'Administrador', clase: 'bg-violet-100 text-violet-800' },
  tablet: { texto: 'Tablet', clase: 'bg-sky-100 text-sky-800' },
  cajero: { texto: 'Cajero', clase: 'bg-amber-100 text-amber-800' },
  mesero: { texto: 'Mesero', clase: 'bg-emerald-100 text-emerald-800' },
  cocina: { texto: 'Cocina', clase: 'bg-orange-100 text-orange-800' },
};

const FORM_VACIO = { nombre: '', usuario: '', password: '', confirmar: '', ubicacion: '' };

const claseInput =
  'w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/40 select-text';

export const UsuariosConfig: React.FC = () => {
  const [usuarios, setUsuarios] = useState<UsuarioPlantilla[]>([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [errorLista, setErrorLista] = useState<string | null>(null);

  const [rol, setRol] = useState<RolCreable>('admin');
  const [acceso, setAcceso] = useState<TipoAcceso>('password');
  const [form, setForm] = useState(FORM_VACIO);
  // Número de la tablet (BD: tablets.numero); se sugiere el siguiente libre.
  const [numeroTablet, setNumeroTablet] = useState('');
  const [siguienteNumero, setSiguienteNumero] = useState('01');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargandoLista(true);
    try {
      const datos = await listarUsuarios();
      setUsuarios(datos.usuarios);
      setSiguienteNumero(datos.siguienteNumeroTablet);
      setNumeroTablet((n) => n || datos.siguienteNumeroTablet);
      setErrorLista(null);
    } catch (err) {
      setErrorLista(err instanceof Error ? err.message : 'No se pudo cargar la lista.');
    } finally {
      setCargandoLista(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cambiar = (campo: keyof typeof FORM_VACIO) => (e: React.ChangeEvent<HTMLInputElement>) => {
    // El PIN solo admite números (máximo 6).
    const valor = acceso === 'pin' && (campo === 'password' || campo === 'confirmar') ? e.target.value.replace(/\D/g, '').slice(0, 6) : e.target.value;
    setForm((f) => ({ ...f, [campo]: valor }));
    setExito(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim() || !form.usuario.trim() || !form.password) {
      setError(`Completa nombre, usuario y ${acceso === 'pin' ? 'PIN' : 'contraseña'}.`);
      return;
    }
    if (acceso === 'pin' && !FORMATO_PIN.test(form.password)) {
      setError('El PIN debe tener de 4 a 6 números.');
      return;
    }
    if (rol === 'tablet' && !/^\d{1,3}$/.test(numeroTablet)) {
      setError('Escribe el número de la tablet.');
      return;
    }
    if (form.password !== form.confirmar) {
      setError(acceso === 'pin' ? 'Los PIN no coinciden.' : 'Las contraseñas no coinciden.');
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      const nuevo = await crearUsuario({
        nombre: form.nombre,
        usuario: form.usuario,
        password: form.password,
        rol,
        acceso,
        ...(rol === 'tablet' && { numeroTablet, ubicacion: form.ubicacion }),
      });
      setUsuarios((lista) => [...lista, nuevo]);
      setForm(FORM_VACIO);
      setExito(
        nuevo.tablet
          ? `Se registró ${nuevo.tablet.nombre} con la cuenta «${nuevo.usuario}».`
          : `Se creó el administrador «${nuevo.usuario}».`
      );
      if (nuevo.tablet) {
        const siguiente = String(Number(nuevo.tablet.numero) + 1).padStart(2, '0');
        setSiguienteNumero(siguiente);
        setNumeroTablet(siguiente);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el usuario.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
      {/* Formulario */}
      <form onSubmit={handleSubmit} className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4 self-start">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-amber-600" /> Agregar usuario
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">Elige el tipo de usuario y sus datos de acceso.</p>
        </div>

        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de usuario">
          {TIPOS.map(({ rol: valor, label, detalle, icon: Icon, activo }) => (
            <button
              key={valor}
              type="button"
              role="radio"
              aria-checked={rol === valor}
              onClick={() => setRol(valor)}
              className={`rounded-xl border-2 p-3 text-left transition-colors cursor-pointer ${
                rol === valor ? activo : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              <Icon className="w-5 h-5 mb-1.5" />
              <div className="text-sm font-semibold">{label}</div>
              <div className="text-[11px] opacity-75 leading-snug">{detalle}</div>
            </button>
          ))}
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-neutral-700">{rol === 'tablet' ? 'Nombre de la tablet' : 'Nombre completo'}</span>
          <input
            value={form.nombre}
            onChange={cambiar('nombre')}
            placeholder={rol === 'tablet' ? 'Tablet 05' : 'Ana López'}
            className={claseInput}
          />
        </label>

        {/* Solo tablets: número y ubicación (BD: tablets.numero, tablets.ubicacion) */}
        {rol === 'tablet' && (
          <div className="grid grid-cols-[7rem_1fr] gap-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-neutral-700">Núm. de tablet</span>
              <input
                value={numeroTablet}
                onChange={(e) => {
                  setNumeroTablet(e.target.value.replace(/\D/g, '').slice(0, 3));
                  setExito(null);
                }}
                inputMode="numeric"
                placeholder={siguienteNumero}
                className={`${claseInput} font-mono text-center`}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-neutral-700">Ubicación (opcional)</span>
              <input value={form.ubicacion} onChange={cambiar('ubicacion')} placeholder="Salón, terraza…" className={claseInput} />
            </label>
          </div>
        )}

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-neutral-700">Usuario</span>
          <input
            value={form.usuario}
            onChange={cambiar('usuario')}
            autoCapitalize="none"
            autoComplete="off"
            placeholder={rol === 'tablet' ? 'tablet05' : 'ana.lopez'}
            className={`${claseInput} font-mono`}
          />
          <span className="block text-[11px] text-neutral-500">3 a 32 caracteres: letras, números, punto, guion o guion bajo.</span>
        </label>

        <div className="space-y-1.5">
          <span className="text-xs font-medium text-neutral-700">Acceso con</span>
          <div className="grid grid-cols-2 gap-1 p-1 bg-neutral-100 rounded-lg" role="radiogroup" aria-label="Tipo de acceso">
            {(
              [
                { valor: 'password', label: 'Contraseña', icon: KeyRound },
                { valor: 'pin', label: 'PIN', icon: Hash },
              ] as const
            ).map(({ valor, label, icon: Icon }) => (
              <button
                key={valor}
                type="button"
                role="radio"
                aria-checked={acceso === valor}
                onClick={() => {
                  setAcceso(valor);
                  setForm((f) => ({ ...f, password: '', confirmar: '' }));
                  setError(null);
                }}
                className={`h-9 rounded-md flex items-center justify-center gap-1.5 text-sm font-medium transition-colors cursor-pointer ${
                  acceso === valor ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-neutral-700">{acceso === 'pin' ? 'PIN' : 'Contraseña'}</span>
            <div className="relative">
              <input
                type={mostrarPassword ? 'text' : 'password'}
                value={form.password}
                onChange={cambiar('password')}
                autoComplete="new-password"
                inputMode={acceso === 'pin' ? 'numeric' : undefined}
                maxLength={acceso === 'pin' ? 6 : undefined}
                placeholder={acceso === 'pin' ? '4 a 6 números' : 'Mín. 6'}
                className={`${claseInput} pr-9 ${acceso === 'pin' ? 'font-mono tracking-[0.3em]' : ''}`}
              />
              <button
                type="button"
                onClick={() => setMostrarPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-500 hover:text-neutral-700 cursor-pointer"
                aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {mostrarPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-neutral-700">Confirmar</span>
            <input
              type={mostrarPassword ? 'text' : 'password'}
              value={form.confirmar}
              onChange={cambiar('confirmar')}
              autoComplete="new-password"
              inputMode={acceso === 'pin' ? 'numeric' : undefined}
              maxLength={acceso === 'pin' ? 6 : undefined}
              placeholder="Repite"
              className={`${claseInput} ${acceso === 'pin' ? 'font-mono tracking-[0.3em]' : ''}`}
            />
          </label>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>{error}</span>
          </div>
        )}
        {exito && (
          <div className="flex items-start gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>{exito}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={guardando}
          className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed text-neutral-950 font-semibold text-sm py-2.5 rounded-lg transition-colors cursor-pointer"
        >
          {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
          {rol === 'admin' ? 'Crear administrador' : 'Crear tablet'}
        </button>
      </form>

      {/* Plantilla */}
      <section className="bg-white border border-neutral-200 rounded-xl self-start overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Plantilla</h2>
          <span className="text-xs text-neutral-500">{usuarios.length} usuarios</span>
        </div>

        {cargandoLista ? (
          <div className="p-8 flex justify-center text-neutral-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : errorLista ? (
          <div className="p-5 text-sm text-rose-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {errorLista}
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {usuarios.map((u) => (
              <li key={u.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-neutral-900 truncate">{u.nombre}</div>
                  <div className="text-xs text-neutral-500 font-mono truncate">
                    {u.usuario}
                    {u.tablet && (
                      <span className="font-sans">
                        {' '}
                        · Tablet #{u.tablet.numero}
                        {u.tablet.ubicacion && ` · ${u.tablet.ubicacion}`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {u.acceso === 'pin' && (
                    <span className="text-[11px] font-semibold px-2 py-1 rounded-md bg-neutral-100 text-neutral-600 flex items-center gap-1">
                      <Hash className="w-3 h-3" /> PIN
                    </span>
                  )}
                  <span className={`text-[11px] font-semibold px-2 py-1 rounded-md ${ETIQUETA_ROL[u.rol].clase}`}>
                    {ETIQUETA_ROL[u.rol].texto}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
