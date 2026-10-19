// Turnos: el turno abierto con su resumen, el corte de turno y el historial de cortes.
//   GET  /api/turnos/resumen               resumen del turno abierto
//   POST /api/turnos/cerrar                corte: cierra el turno e imprime el ticket de corte
//   GET  /api/turnos/historial             turnos cerrados
//   GET  /api/turnos/:id/resumen           resumen de un corte anterior
//   POST /api/turnos/:id/imprimir-corte    reimprimir
// Se actualiza sola con los avisos en vivo (órdenes y turno).
import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MoonStar,
  Eye,
  History,
  Loader2,
  Lock,
  Printer,
  Receipt,
  Scissors,
  Tablet,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  cerrarTurno,
  CortePendienteError,
  listarTurnosCerrados,
  obtenerResumenDe,
  obtenerResumenTurno,
  reimprimirCorte,
  ResumenTurno,
  textoCierre,
  TipoCierre,
  TurnoCerrado,
} from '../services/turnosService';
import { useEnVivo } from '../services/enVivo';
import { SeccionSinTurno } from './TurnoRequerido';
import type { MainNavTab } from './SeccionesNav';

const dinero = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fechaHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—';
const duracion = (desde: string, hasta?: string | null) => {
  const min = Math.max(0, Math.round(((hasta ? new Date(hasta) : new Date()).getTime() - new Date(desde).getTime()) / 60_000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
};

type Impresion = { ok: boolean; error?: string };

export const TurnosView: React.FC<{ onIrA: (tab: MainNavTab) => void }> = ({ onIrA }) => {
  const [resumen, setResumen] = useState<ResumenTurno | null | undefined>(undefined);
  const [historial, setHistorial] = useState<TurnoCerrado[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [corteHecho, setCorteHecho] = useState<{ resumen: ResumenTurno; impresion: Impresion } | null>(null);
  const [verCorte, setVerCorte] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [r, h] = await Promise.all([obtenerResumenTurno(), listarTurnosCerrados()]);
      setResumen(r);
      setHistorial(h);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el turno.');
    }
  }, []);
  useEffect(() => {
    cargar();
    const id = setInterval(cargar, 30_000); // respaldo; lo normal es el aviso en vivo
    return () => clearInterval(id);
  }, [cargar]);
  useEnVivo(['ordenes', 'turno'], cargar);

  const pendientes = resumen?.pendientes ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Clock className="w-5 h-5 text-red-500" />
          <span>Turnos</span>
        </h2>
        <p className="text-xs text-neutral-500 mt-0.5">Turno de caja actual, corte de turno y cortes anteriores.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Turno actual */}
      {resumen === undefined ? (
        <div className="py-12 flex justify-center text-neutral-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : resumen === null ? (
        <SeccionSinTurno seccion="El corte" />
      ) : (
        <section className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">Turno #{resumen.turno.idTurno}</span>
                <span className="text-[11px] font-bold tracking-wide px-2 py-0.5 rounded-full border bg-emerald-100 text-emerald-800 border-emerald-300">
                  ABIERTO
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Abrió <b className="text-neutral-800">{resumen.turno.abrio}</b> · {fechaHora(resumen.turno.fecha_inicio)} · lleva{' '}
                {duracion(resumen.turno.fecha_inicio)}
              </p>
            </div>
            <button
              onClick={() => setConfirmando(true)}
              disabled={pendientes.length > 0}
              title={pendientes.length > 0 ? 'Cobra las órdenes pendientes antes del corte' : undefined}
              className="h-12 px-5 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold flex items-center gap-2 cursor-pointer"
            >
              <Scissors className="w-5 h-5" /> Hacer corte de turno
            </button>
          </div>

          {/* Indicadores */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-5">
            <Indicador icono={TrendingUp} titulo="Vendido" valor={dinero(resumen.totalVendido)} destacado />
            <Indicador icono={Receipt} titulo="Órdenes cobradas" valor={String(resumen.ordenes.pagadas)} />
            <Indicador
              icono={AlertTriangle}
              titulo="Por cobrar"
              valor={String(pendientes.length)}
              nota={pendientes.length ? `${resumen.ordenes.pagando} pidieron cuenta · ${resumen.ordenes.abiertas} abiertas` : 'Todo cobrado'}
              alerta={pendientes.length > 0}
            />
            <Indicador
              icono={Tablet}
              titulo="Tablets en el turno"
              valor={String(resumen.tablets.usadas)}
              nota={`${resumen.tablets.conectadas} con sesión abierta`}
            />
          </div>

          {/* Pendientes que bloquean el corte */}
          {pendientes.length > 0 && (
            <div className="mx-5 mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                <Lock className="w-4 h-4" /> Para hacer el corte, cobra primero estas órdenes:
              </div>
              <div className="flex flex-wrap gap-2">
                {pendientes.map((p) => (
                  <span key={p.idOrden} className="text-xs px-2.5 py-1 rounded-lg bg-white border border-amber-200">
                    <b>{p.nombre}</b> · {dinero(p.total)} · {p.estatus === 1 ? 'pidió la cuenta' : 'abierta'}
                  </span>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => onIrA('cajas')} className="h-9 px-3 rounded-lg bg-white border border-amber-300 text-sm font-semibold cursor-pointer">
                  Ir a Cajas
                </button>
                <button onClick={() => onIrA('mesas')} className="h-9 px-3 rounded-lg bg-white border border-amber-300 text-sm font-semibold cursor-pointer">
                  Ir a Órdenes
                </button>
              </div>
            </div>
          )}

          <ProductosVendidos productos={resumen.productos} />
        </section>
      )}

      {/* Historial de cortes */}
      <section className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center gap-2">
          <History className="w-5 h-5 text-neutral-500" />
          <h3 className="font-bold">Cortes anteriores</h3>
        </div>
        {historial === null ? (
          <div className="py-8 flex justify-center text-neutral-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : historial.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-neutral-500">Aún no se ha hecho ningún corte.</p>
        ) : (
          <div className="divide-y divide-neutral-100">
            {historial.map((t) => (
              <FilaCorte key={t.idTurno} turno={t} onVer={() => setVerCorte(t.idTurno)} />
            ))}
          </div>
        )}
      </section>

      <AnimatePresence>
        {confirmando && resumen && (
          <ConfirmarCorte
            resumen={resumen}
            onCancelar={() => setConfirmando(false)}
            onHecho={(r) => {
              setConfirmando(false);
              setCorteHecho(r);
              cargar();
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>{corteHecho && <CorteListo {...corteHecho} onCerrar={() => setCorteHecho(null)} />}</AnimatePresence>
      <AnimatePresence>{verCorte !== null && <VerCorte idTurno={verCorte} onCerrar={() => setVerCorte(null)} />}</AnimatePresence>
    </div>
  );
};

const Indicador: React.FC<{
  icono: typeof Clock;
  titulo: string;
  valor: string;
  nota?: string;
  destacado?: boolean;
  alerta?: boolean;
}> = ({ icono: Icono, titulo, valor, nota, destacado, alerta }) => (
  <div
    className={`rounded-xl border p-4 ${
      destacado ? 'bg-neutral-900 text-white border-neutral-900' : alerta ? 'bg-amber-50 border-amber-300' : 'bg-white border-neutral-200'
    }`}
  >
    <div className={`flex items-center gap-1.5 text-xs ${destacado ? 'text-neutral-400' : 'text-neutral-500'}`}>
      <Icono className="w-4 h-4" /> {titulo}
    </div>
    <div className="text-2xl font-bold font-mono mt-1">{valor}</div>
    {nota && <div className={`text-xs mt-0.5 ${destacado ? 'text-neutral-400' : alerta ? 'text-amber-800' : 'text-neutral-500'}`}>{nota}</div>}
  </div>
);

const ProductosVendidos: React.FC<{ productos: ResumenTurno['productos'] }> = ({ productos }) => (
  <div className="border-t border-neutral-200">
    <div className="px-5 py-3 text-xs font-bold uppercase tracking-widest text-neutral-500">Productos vendidos</div>
    {productos.length === 0 ? (
      <p className="px-5 pb-5 text-sm text-neutral-500">Todavía no hay órdenes cobradas en este turno.</p>
    ) : (
      <div className="px-5 pb-4 max-h-80 overflow-y-auto">
        {productos.map((p) => (
          <div key={p.nombre} className="flex items-baseline gap-3 py-1.5 border-b border-neutral-100 last:border-0 text-sm">
            <span className="w-10 text-right font-mono font-bold">{p.cantidad}</span>
            <span className="flex-1 min-w-0 truncate">{p.nombre}</span>
            <span className="font-mono font-semibold">{dinero(p.importe)}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

const FilaCorte: React.FC<{ turno: TurnoCerrado; onVer: () => void }> = ({ turno: t, onVer }) => {
  const [impresion, setImpresion] = useState<{ cargando: boolean; texto?: string; ok?: boolean }>({ cargando: false });
  const reimprimir = async () => {
    setImpresion({ cargando: true });
    try {
      const r = await reimprimirCorte(t.idTurno);
      setImpresion({ cargando: false, ok: r.impresion.ok, texto: r.impresion.ok ? 'Impreso' : r.impresion.error });
    } catch (err) {
      setImpresion({ cargando: false, ok: false, texto: err instanceof Error ? err.message : 'No se imprimió' });
    }
  };
  return (
    <div className="px-5 py-3 flex flex-wrap items-center gap-x-5 gap-y-2">
      <div className="flex-1 min-w-48">
        <div className="font-bold">Turno #{t.idTurno}</div>
        <div className="text-xs text-neutral-500">
          {fechaHora(t.fecha_inicio)} → {fechaHora(t.fecha_fin)} · {duracion(t.fecha_inicio, t.fecha_fin)} · abrió {t.abrio}
          {textoCierre(t.cierre_tipo, t.cerro) && ` · ${textoCierre(t.cierre_tipo, t.cerro)}`}
        </div>
        <EtiquetasCierre tipo={t.cierre_tipo} pendientes={t.ordenes_pendientes} />
      </div>
      <div className="text-right">
        <div className="text-lg font-bold font-mono">{dinero(t.total_vendido)}</div>
        <div className="text-xs text-neutral-500">{t.ordenes_cobradas} órdenes</div>
      </div>
      <div className="flex items-center gap-2">
        {impresion.texto && <span className={`text-xs ${impresion.ok ? 'text-emerald-700' : 'text-amber-700'}`}>{impresion.texto}</span>}
        <button onClick={onVer} className="h-9 px-3 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-sm font-semibold flex items-center gap-1.5 cursor-pointer">
          <Eye className="w-4 h-4" /> Ver
        </button>
        <button
          onClick={reimprimir}
          disabled={impresion.cargando}
          className="h-9 px-3 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          {impresion.cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} Reimprimir
        </button>
      </div>
    </div>
  );
};

/* ---------- Ventanas ---------- */

const Fondo: React.FC<{ children: React.ReactNode; onCerrar?: () => void }> = ({ children, onCerrar }) => (
  <motion.div
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    onClick={onCerrar}
  >
    <motion.div
      role="dialog"
      className="w-full max-w-md max-h-full bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col"
      initial={{ scale: 0.95, y: 10 }}
      animate={{ scale: 1, y: 0 }}
      exit={{ scale: 0.95, opacity: 0 }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </motion.div>
  </motion.div>
);

const ConfirmarCorte: React.FC<{
  resumen: ResumenTurno;
  onCancelar: () => void;
  onHecho: (r: { resumen: ResumenTurno; impresion: Impresion }) => void;
}> = ({ resumen, onCancelar, onHecho }) => {
  const [cerrando, setCerrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmar = async () => {
    setCerrando(true);
    setError(null);
    try {
      onHecho(await cerrarTurno());
    } catch (err) {
      setError(
        err instanceof CortePendienteError
          ? `${err.message} (${err.pendientes.map((p) => p.nombre).join(', ')})`
          : err instanceof Error
          ? err.message
          : 'No se pudo hacer el corte.'
      );
      setCerrando(false);
    }
  };
  return (
    <Fondo onCerrar={cerrando ? undefined : onCancelar}>
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
            <Scissors className="w-6 h-6" />
          </span>
          <div>
            <h2 className="text-lg font-bold">Corte del turno #{resumen.turno.idTurno}</h2>
            <p className="text-xs text-neutral-500">
              {fechaHora(resumen.turno.fecha_inicio)} → ahora · {duracion(resumen.turno.fecha_inicio)}
            </p>
          </div>
        </div>
        <div className="rounded-xl bg-neutral-50 border border-neutral-200 divide-y divide-neutral-200 text-sm">
          <div className="flex justify-between px-4 py-2.5">
            <span>Órdenes cobradas</span>
            <b className="font-mono">{resumen.ordenes.pagadas}</b>
          </div>
          <div className="flex justify-between px-4 py-2.5">
            <span>Productos vendidos</span>
            <b className="font-mono">{resumen.productos.reduce((a, p) => a + p.cantidad, 0)}</b>
          </div>
          <div className="flex justify-between items-baseline px-4 py-3">
            <span className="font-semibold">Total vendido</span>
            <b className="font-mono text-2xl">{dinero(resumen.totalVendido)}</b>
          </div>
        </div>
        <ul className="text-xs text-neutral-600 space-y-1">
          <li>• Se cierra el turno y se imprime el ticket de corte.</li>
          <li>• Las tablets se desconectan del turno y esperan a que se inicie otro.</li>
          <li>• Cobros y órdenes nuevas requieren iniciar un nuevo turno.</li>
        </ul>
        {error && (
          <div className="flex items-start gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onCancelar} disabled={cerrando} className="h-12 rounded-xl border border-neutral-200 font-semibold cursor-pointer disabled:opacity-50">
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={cerrando}
            className="h-12 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {cerrando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Scissors className="w-5 h-5" />} Cerrar turno
          </button>
        </div>
      </div>
    </Fondo>
  );
};

const CorteListo: React.FC<{ resumen: ResumenTurno; impresion: Impresion; onCerrar: () => void }> = ({ resumen, impresion, onCerrar }) => {
  const [imp, setImp] = useState(impresion);
  const [cargando, setCargando] = useState(false);
  const reimprimir = async () => {
    setCargando(true);
    try {
      setImp((await reimprimirCorte(resumen.turno.idTurno)).impresion);
    } catch (err) {
      setImp({ ok: false, error: err instanceof Error ? err.message : 'No se pudo imprimir.' });
    } finally {
      setCargando(false);
    }
  };
  return (
    <Fondo>
      <div className="p-6 space-y-4 text-center">
        <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-500" />
        <h2 className="text-xl font-bold">Turno #{resumen.turno.idTurno} cerrado</h2>
        <div className="text-3xl font-bold font-mono">{dinero(resumen.totalVendido)}</div>
        <p className="text-sm text-neutral-500">
          {resumen.ordenes.pagadas} órdenes cobradas · {duracion(resumen.turno.fecha_inicio, resumen.turno.fecha_fin)}
        </p>
        <div
          className={`flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border ${
            imp.ok ? 'text-emerald-800 bg-emerald-50 border-emerald-200' : 'text-amber-800 bg-amber-50 border-amber-200'
          }`}
        >
          <Printer className="w-3.5 h-3.5" /> {imp.ok ? 'Ticket de corte impreso.' : `No se imprimió: ${imp.error ?? 'error'}`}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={reimprimir}
            disabled={cargando}
            className="h-12 rounded-xl border border-neutral-200 font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} Reimprimir
          </button>
          <button onClick={onCerrar} className="h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer">
            Listo
          </button>
        </div>
      </div>
    </Fondo>
  );
};

const VerCorte: React.FC<{ idTurno: number; onCerrar: () => void }> = ({ idTurno, onCerrar }) => {
  const [r, setR] = useState<ResumenTurno | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    obtenerResumenDe(idTurno)
      .then(setR)
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar el corte.'));
  }, [idTurno]);
  return (
    <Fondo onCerrar={onCerrar}>
      <div className="px-5 py-4 bg-neutral-900 text-white flex items-start justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-neutral-400">Corte de turno</div>
          <div className="text-2xl font-bold">Turno #{idTurno}</div>
          {r && (
            <div className="text-xs text-neutral-300 mt-1">
              {fechaHora(r.turno.fecha_inicio)} → {fechaHora(r.turno.fecha_fin)} · abrió {r.turno.abrio}
              {textoCierre(r.cierre?.tipo, r.cierre?.cerro) && ` · ${textoCierre(r.cierre?.tipo, r.cierre?.cerro)}`}
            </div>
          )}
          {r?.cierre && <EtiquetasCierre tipo={r.cierre.tipo} pendientes={r.cierre.ordenes_pendientes} />}
        </div>
        <button onClick={onCerrar} aria-label="Cerrar" className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 cursor-pointer">
          <X className="w-5 h-5" />
        </button>
      </div>
      {error && <p className="p-5 text-sm text-rose-700">{error}</p>}
      {!r && !error ? (
        <div className="py-10 flex justify-center text-neutral-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        r && (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <ProductosVendidos productos={r.productos} />
            </div>
            <div className="shrink-0 border-t-2 border-dashed border-neutral-200 px-5 py-4 bg-amber-50/60 flex items-end justify-between">
              <div className="text-xs text-neutral-500">{r.ordenes.pagadas} órdenes cobradas</div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-widest text-neutral-500">Total vendido</div>
                <div className="text-3xl font-bold font-mono leading-none">{dinero(r.totalVendido)}</div>
              </div>
            </div>
          </>
        )
      )}
    </Fondo>
  );
};

/** Cierre automático (nadie hizo el corte) y órdenes que quedaron sin cobrar al cerrar el turno. */
function EtiquetasCierre({ tipo, pendientes }: { tipo: TipoCierre | null; pendientes: number }) {
  if (tipo !== 'automatico' && pendientes === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {tipo === 'automatico' && (
        <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-800">
          <MoonStar className="w-3.5 h-3.5" /> Cierre automático · sin corte
        </span>
      )}
      {pendientes > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">
          <AlertTriangle className="w-3.5 h-3.5" /> {pendientes} {pendientes === 1 ? 'orden quedó' : 'órdenes quedaron'} sin cobrar
        </span>
      )}
    </div>
  );
}
