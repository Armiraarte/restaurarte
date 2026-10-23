// Monitor de la computadora de las impresoras (p. ej. «Isidro»), solo para el usuario autorizado (el servidor
// contesta 403 a los demás y entonces no se muestra nada). En el encabezado: un punto verde o rojo con su nombre;
// al tocarlo, el detalle: estado, resumen y línea de tiempo de hoy, y lo que pasó en los últimos 7 días.
import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Printer, RotateCcw, ShieldCheck, Wifi, WifiOff, X } from 'lucide-react';
import { Usuario } from '../services/authService';
import { useCadaTantoVisible } from '../services/sincronizacion';
import {
  duracion,
  duracionesConexion,
  estadoActual,
  EventoMonitor,
  MonitorImpresion,
  obtenerMonitorImpresion,
  resumen,
  SinPermisoMonitor,
  tramos,
} from '../services/monitorImpresion';

const REVISAR_MS = 15_000;
const hora = (iso: string | number) => new Date(iso).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
const inicioDelDia = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Indicador del encabezado (solo administradores; si el servidor dice 403, desaparece y deja de consultar). */
export const IndicadorImpresora: React.FC<{ usuario: Usuario }> = ({ usuario }) => {
  const [monitor, setMonitor] = useState<MonitorImpresion | null>(null);
  const [permitido, setPermitido] = useState(usuario.rol === 'admin');
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);

  const cargar = useCallback(() => {
    if (!permitido) return;
    obtenerMonitorImpresion()
      .then((datos) => {
        setMonitor(datos);
        setError(null);
      })
      .catch((err) => {
        if (err instanceof SinPermisoMonitor) setPermitido(false);
        else setError((err as Error).message);
      });
  }, [permitido]);
  useEffect(cargar, [cargar]);
  useCadaTantoVisible(cargar, REVISAR_MS);

  if (!permitido || (!monitor && !error)) return null;
  const estado = monitor ? estadoActual(monitor.eventos) : { conectado: null, equipo: null, desde: null };
  const nombre = estado.equipo ?? 'Impresoras';
  const color = estado.conectado === null ? 'bg-neutral-400' : estado.conectado ? 'bg-emerald-500' : 'bg-rose-600';

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title={`Monitor de ${nombre}`}
        className={`h-9 px-2.5 rounded-lg border flex items-center gap-2 text-xs font-semibold cursor-pointer ${
          estado.conectado === false ? 'border-rose-300 bg-rose-50 text-rose-800' : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
        }`}
      >
        <span className={`w-2.5 h-2.5 rounded-full ${color} ${estado.conectado === false ? 'animate-pulse' : ''}`} />
        <Printer className="w-4 h-4 shrink-0" />
        <span className="hidden md:inline">{nombre}</span>
        {estado.desde && <span className="hidden lg:inline font-normal text-neutral-500">desde {hora(estado.desde)}</span>}
      </button>
      {abierto && <VentanaMonitor monitor={monitor} error={error} onActualizar={cargar} onCerrar={() => setAbierto(false)} />}
    </>
  );
};

function VentanaMonitor({
  monitor,
  error,
  onActualizar,
  onCerrar,
}: {
  monitor: MonitorImpresion | null;
  error: string | null;
  onActualizar: () => void;
  onCerrar: () => void;
}) {
  // El reloj de la ventana avanza cada 15 s junto con la consulta (los «hace X min» se recalculan).
  const ahora = monitor ? Math.max(Date.parse(monitor.ahora), Date.now()) : Date.now();
  const eventos = monitor?.eventos ?? [];
  const estado = estadoActual(eventos);
  const nombre = estado.equipo ?? 'la computadora de las impresoras';
  const hoy = inicioDelDia(ahora);
  const delDia = resumen(eventos, hoy, ahora);
  const lineaDeHoy = tramos(eventos, hoy, ahora);
  const duraciones = duracionesConexion(eventos);
  const recientes = eventos.map((e, i) => ({ e, i })).reverse().slice(0, 150);

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onCerrar}>
      <div
        role="dialog"
        aria-labelledby="monitor-titulo"
        className="w-full max-w-3xl max-h-full overflow-hidden bg-white rounded-2xl shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-3 border-b border-neutral-100">
          <div className="min-w-0">
            <h2 id="monitor-titulo" className="text-lg font-black tracking-tight flex items-center gap-2">
              <Printer className="w-5 h-5 text-amber-600" /> Monitor de {estado.equipo ?? 'impresoras'}
            </h2>
            <p className="text-xs text-neutral-500 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Solo tú lo ves ·{' '}
              {monitor?.fuente === 'produccion'
                ? `vigilando producción${monitor.revision?.hora ? ` · revisado a las ${new Date(monitor.revision.hora).toLocaleTimeString('es-MX')}` : ''}`
                : 'se actualiza cada 15 s'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onActualizar} className="h-9 px-3 rounded-lg border border-neutral-200 text-xs font-semibold hover:bg-neutral-50 cursor-pointer">
              Actualizar
            </button>
            <button type="button" onClick={onCerrar} aria-label="Cerrar" className="w-9 h-9 rounded-lg border border-neutral-200 flex items-center justify-center hover:bg-neutral-50 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
          {(error || monitor?.revision?.error) && (
            <div className="flex items-center gap-2 text-sm text-amber-900 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error ?? `No se pudo revisar producción: ${monitor?.revision?.error}`}
            </div>
          )}

          {/* Estado ahora */}
          <div
            className={`rounded-2xl border-2 p-4 flex items-center gap-4 ${
              estado.conectado === null ? 'border-neutral-200 bg-neutral-50' : estado.conectado ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50'
            }`}
          >
            <div
              className={`w-14 h-14 shrink-0 rounded-full flex items-center justify-center text-white ${
                estado.conectado === null ? 'bg-neutral-400' : estado.conectado ? 'bg-emerald-500' : 'bg-rose-600'
              }`}
            >
              {estado.conectado === false ? <WifiOff className="w-7 h-7" /> : <Wifi className="w-7 h-7" />}
            </div>
            <div className="min-w-0">
              <div className="text-xl font-black tracking-tight">
                {estado.conectado === null ? 'Todavía sin datos' : estado.conectado ? 'CONECTADA' : 'DESCONECTADA'}
              </div>
              {estado.desde && (
                <div className="text-sm text-neutral-700">
                  desde las {hora(estado.desde)} · hace {duracion(ahora - Date.parse(estado.desde))}
                </div>
              )}
              {estado.conectado === false && (
                <div className="mt-1 text-xs text-rose-800">
                  En el restaurante: que {nombre} esté encendida y sin suspender, y tocar «Reconectar impresoras» en su escritorio.
                </div>
              )}
            </div>
          </div>

          {/* Hoy */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Dato titulo="Conectada hoy" valor={delDia.porcentajeConectado === null ? '—' : `${delDia.porcentajeConectado}%`} nota="del tiempo vigilado" />
            <Dato titulo="Desconexiones" valor={String(delDia.desconexiones)} alerta={delDia.desconexiones > 0} />
            <Dato titulo="Tickets impresos" valor={monitor?.fuente === 'produccion' ? '—' : String(delDia.impresiones)} nota={monitor?.fuente === 'produccion' ? 'se ven en producción' : undefined} />
            <Dato titulo="Fallas" valor={monitor?.fuente === 'produccion' ? '—' : String(delDia.fallas)} alerta={delDia.fallas > 0} />
          </div>

          {/* Línea de tiempo de hoy */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-neutral-600 mb-1.5">
              <span>Hoy</span>
              <span className="flex items-center gap-3 font-normal">
                <Muestra clase="bg-emerald-500" texto="Conectada" />
                <Muestra clase="bg-rose-500" texto="Desconectada" />
                <Muestra clase="bg-neutral-200" texto="Sin vigilar" />
              </span>
            </div>
            <div className="relative h-6 rounded-lg overflow-hidden bg-neutral-100 border border-neutral-200">
              {lineaDeHoy.map((t) => (
                <div
                  key={t.desde}
                  title={`${hora(t.desde)} – ${hora(t.hasta)}: ${t.estado === 'conectado' ? 'conectada' : t.estado === 'desconectado' ? 'desconectada' : 'sin vigilar'} (${duracion(t.hasta - t.desde)})`}
                  className={`absolute inset-y-0 ${t.estado === 'conectado' ? 'bg-emerald-500' : t.estado === 'desconectado' ? 'bg-rose-500' : 'bg-neutral-200'}`}
                  style={{ left: `${((t.desde - hoy) / 864e5) * 100}%`, width: `${((t.hasta - t.desde) / 864e5) * 100}%` }}
                />
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-neutral-400 mt-1 font-mono">
              {['0', '3', '6', '9', '12', '15', '18', '21', '24'].map((h) => (
                <span key={h}>{h}h</span>
              ))}
            </div>
          </div>

          {/* Lo que pasó */}
          <div>
            <h3 className="text-sm font-bold text-neutral-800 mb-2">Lo que pasó (últimos 7 días)</h3>
            {recientes.length === 0 ? (
              <p className="text-sm text-neutral-500">Todavía no hay nada anotado.</p>
            ) : (
              <ul className="divide-y divide-neutral-100 border border-neutral-100 rounded-xl">
                {recientes.map(({ e, i }, indice) => {
                  const dia = new Date(e.hora).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
                  const diaAnterior = indice > 0 ? new Date(recientes[indice - 1].e.hora).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }) : null;
                  return (
                    <React.Fragment key={`${e.hora}-${i}`}>
                      {dia !== diaAnterior && <li className="px-3 py-1.5 bg-neutral-50 text-[11px] font-bold uppercase tracking-wide text-neutral-500">{dia}</li>}
                      <FilaEvento evento={e} duracionPrevia={duraciones.get(i)} />
                    </React.Fragment>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function FilaEvento({ evento: e, duracionPrevia }: { evento: EventoMonitor; duracionPrevia?: number }) {
  const quien = e.equipo ?? 'la computadora';
  const destino = e.destino === 'cocina' ? 'cocina' : 'caja';
  const [Icono, color, texto] =
    e.tipo === 'conectado'
      ? [Wifi, 'text-emerald-600', `Se conectó ${quien}`]
      : e.tipo === 'desconectado'
        ? [WifiOff, 'text-rose-600', `Se desconectó ${quien}${duracionPrevia !== undefined ? ` · estuvo conectada ${duracion(duracionPrevia)}` : ''}`]
        : e.tipo === 'impresion'
          ? [Printer, 'text-neutral-500', `Ticket de ${destino} impreso${e.ms !== undefined ? ` (${(e.ms / 1000).toFixed(1)} s)` : ''}`]
          : e.tipo === 'falla'
            ? [AlertTriangle, 'text-amber-600', `No se imprimió el ticket de ${destino}${e.detalle ? `: ${e.detalle}` : ''}`]
            : [RotateCcw, 'text-sky-600', e.detalle ?? 'El servidor se reinició.'];
  return (
    <li className="px-3 py-2 flex items-start gap-2.5 text-sm">
      <span className="w-16 shrink-0 font-mono text-xs text-neutral-500 pt-0.5">{hora(e.hora)}</span>
      <Icono className={`w-4 h-4 shrink-0 mt-0.5 ${color}`} />
      <span className="min-w-0 break-words">
        {texto}
        {e.tipo === 'desconectado' && e.detalle && <span className="block text-xs text-neutral-500">{e.detalle}</span>}
      </span>
    </li>
  );
}

function Dato({ titulo, valor, nota, alerta = false }: { titulo: string; valor: string; nota?: string; alerta?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${alerta ? 'border-rose-200 bg-rose-50' : 'border-neutral-200 bg-white'}`}>
      <div className="text-[11px] font-semibold text-neutral-500">{titulo}</div>
      <div className={`text-2xl font-black tracking-tight ${alerta ? 'text-rose-700' : 'text-neutral-900'}`}>{valor}</div>
      {nota && <div className="text-[10px] text-neutral-400">{nota}</div>}
    </div>
  );
}

function Muestra({ clase, texto }: { clase: string; texto: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`w-2.5 h-2.5 rounded-sm ${clase}`} />
      {texto}
    </span>
  );
}
