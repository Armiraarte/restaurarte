import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Banknote, Check, ChefHat, Download, Loader2, Plug, Printer, RefreshCw, Unplug, Wrench } from 'lucide-react';
import {
  asignarImpresora,
  descargarInstaladorImpresoras,
  DestinoImpresion,
  EstadoImpresion,
  imprimirPrueba,
  obtenerEstadoImpresion,
} from '../services/impresionService';

const INTERVALO_REVISION_MS = 30_000;

type Aviso = { tipo: 'ok' | 'error'; texto: string } | null;
const DESTINOS = [
  { id: 'cocina' as const, nombre: 'Cocina', Icono: ChefHat },
  { id: 'caja' as const, nombre: 'Caja', Icono: Banknote },
];

export const ImpresorasTicketsPanel: React.FC = () => {
  const [estado, setEstado] = useState<EstadoImpresion | null>(null);
  const [revisando, setRevisando] = useState(false);
  const [imprimiendo, setImprimiendo] = useState<DestinoImpresion | null>(null);
  const [guardando, setGuardando] = useState<{ destino: DestinoImpresion; impresora: string } | null>(null);
  const guardandoRef = useRef(false);
  const revision = useRef(0);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [ultimaRevision, setUltimaRevision] = useState<string | null>(null);

  const revisar = useCallback(async () => {
    if (guardandoRef.current) return;
    const actual = ++revision.current;
    setRevisando(true);
    try {
      const nuevo = await obtenerEstadoImpresion();
      if (actual === revision.current) setEstado(nuevo);
    } catch (err) {
      if (actual === revision.current) setEstado({ agente: false, error: (err as Error).message });
    } finally {
      if (actual === revision.current) {
        setRevisando(false);
        setUltimaRevision(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    }
  }, []);

  useEffect(() => {
    revisar();
    const id = setInterval(revisar, INTERVALO_REVISION_MS);
    return () => clearInterval(id);
  }, [revisar]);

  const handlePrueba = async (destino: DestinoImpresion) => {
    setImprimiendo(destino);
    setAviso(null);
    try {
      const { impresora } = await imprimirPrueba(destino);
      setAviso({ tipo: 'ok', texto: `Prueba de ${destino} enviada a ${impresora}.` });
    } catch (err) {
      setAviso({ tipo: 'error', texto: (err as Error).message });
    } finally {
      setImprimiendo(null);
      revisar();
    }
  };

  const handleAsignar = async (destino: DestinoImpresion, impresora: string) => {
    guardandoRef.current = true;
    ++revision.current;
    setRevisando(false);
    setGuardando({ destino, impresora });
    setAviso(null);
    try {
      setEstado(await asignarImpresora(destino, impresora));
      setAviso({ tipo: 'ok', texto: `${impresora} asignada a ${destino}.` });
    } catch (err) {
      setAviso({ tipo: 'error', texto: (err as Error).message });
    } finally {
      guardandoRef.current = false;
      setGuardando(null);
    }
  };

  const nombres = {
    cocina: estado?.asignaciones?.cocina ?? null,
    caja: estado?.asignaciones ? estado.asignaciones.caja : estado?.ticket?.nombre ?? null,
  };
  // Se muestran las impresoras USB y las asignadas a los dos destinos.
  const impresoras = (estado?.impresoras ?? [])
    .filter((i) => i.usb || Object.values(nombres).includes(i.nombre));
  const conectadas = impresoras.filter((i) => i.conectada).length;
  const desconectadas = impresoras.length - conectadas;
  // Sin agente, sin impresoras de tickets o con una asignada que no está: se ofrece el instalador.
  const faltanImpresoras =
    !!estado &&
    (!estado.agente ||
      impresoras.length === 0 ||
      DESTINOS.some(({ id }) => !nombres[id] || !(estado.destinos?.[id] ?? estado.impresoras?.find((i) => i.nombre === nombres[id]))?.conectada));

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Printer className="w-5 h-5 text-amber-500" />
            <span>Impresoras de tickets</span>
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {!estado ? (
              'Revisando…'
            ) : !estado.agente ? (
              <span className="text-rose-700 font-medium">Agente de impresión sin conexión</span>
            ) : (
              <>
                <span className="text-emerald-700 font-medium">{conectadas} conectadas</span>
                {' · '}
                <span className={desconectadas > 0 ? 'text-rose-700 font-medium' : ''}>{desconectadas} desconectadas</span>
              </>
            )}
            {ultimaRevision && <span className="text-neutral-400"> · Revisado a las {ultimaRevision}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          <button
            onClick={revisar}
            disabled={revisando || !!guardando}
            className="px-3.5 py-1.5 text-xs font-semibold text-sky-800 bg-sky-50 border border-sky-200 rounded-lg hover:bg-sky-100 disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${revisando ? 'animate-spin' : ''}`} />
            Volver a revisar
          </button>
        </div>
      </div>

      {estado?.agente && (
        <div className="space-y-2">
          <p className="text-xs text-neutral-600">Los pedidos se imprimen en cocina; los cobros y cortes, en caja.</p>
          <p className="text-xs text-neutral-500">Cada impresora puede asignarse a una sola función. Al cambiarla, se desmarca la anterior.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {DESTINOS.map(({ id, nombre, Icono }) => {
              const seleccionada = estado.destinos?.[id] ?? estado.impresoras?.find((i) => i.nombre === nombres[id]);
              return (
                <div key={id} className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900"><Icono className="w-4 h-4" /> {nombre}</div>
                    <div className="mt-1 text-xs text-neutral-600 break-words">{nombres[id] ?? 'Sin asignar'}</div>
                    {nombres[id] && !seleccionada?.conectada && <div className="mt-1 text-xs text-rose-700">Impresora no disponible</div>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePrueba(id)}
                    disabled={!!imprimiendo || !!guardando || !seleccionada?.conectada}
                    className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {imprimiendo === id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                    Probar {id}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <InstalarImpresoras destacado={faltanImpresoras} />

      {aviso && (
        <div
          role={aviso.tipo === 'error' ? 'alert' : 'status'}
          className={`text-xs px-3 py-2 rounded-lg border ${
            aviso.tipo === 'ok'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {aviso.texto}
        </div>
      )}

      {!estado ? (
        <div className="text-center text-sm text-neutral-500 py-10 border border-dashed border-neutral-300 rounded-lg flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Buscando impresoras…
        </div>
      ) : !estado.agente ? (
        <div className="text-center text-sm text-rose-700 py-10 border border-dashed border-rose-300 bg-rose-50/40 rounded-lg px-4">
          {estado.error || 'No se pudo conectar con el agente de impresión.'}
        </div>
      ) : impresoras.length === 0 ? (
        <div className="text-center text-sm text-neutral-500 py-10 border border-dashed border-neutral-300 rounded-lg">
          No se detectó ninguna impresora de tickets.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {impresoras.map((imp) => {
            const usos = DESTINOS.filter(({ id }) => nombres[id] === imp.nombre).map(({ nombre }) => nombre);
            return (
              <div
                key={imp.nombre}
                className={`border rounded-xl p-4 space-y-3 ${
                  imp.conectada ? 'border-neutral-200' : 'border-rose-200 bg-rose-50/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                      {usos.length ? usos.join(' · ') : 'Sin asignación'}
                    </div>
                    <div className="text-sm font-bold text-neutral-900 truncate" title={imp.nombre}>
                      {imp.nombre}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                      imp.conectada
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {imp.conectada ? <Plug className="w-3 h-3" /> : <Unplug className="w-3 h-3" />}
                    {imp.conectada ? 'Conectada' : 'Desconectada'}
                  </span>
                </div>

                <div className="text-xs text-neutral-600 border-t border-neutral-100 pt-3 space-y-0.5">
                  <div className="truncate" title={imp.driver}>
                    Driver: <span className="text-neutral-900">{imp.driver}</span>
                  </div>
                  <div>
                    Puerto: <span className="font-mono text-neutral-900">{imp.puerto}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {DESTINOS.map(({ id, Icono }) => {
                    const asignada = nombres[id] === imp.nombre;
                    const pendiente = guardando?.destino === id && guardando.impresora === imp.nombre;
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-label={`Asignar ${imp.nombre} a ${id}`}
                        aria-pressed={asignada}
                        onClick={() => handleAsignar(id, imp.nombre)}
                        disabled={asignada || !!guardando || !!imprimiendo}
                        className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs font-semibold transition-colors disabled:cursor-default cursor-pointer ${
                          asignada ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-neutral-200 bg-white text-neutral-700 hover:border-amber-400 hover:bg-amber-50 disabled:opacity-50'
                        }`}
                      >
                        {pendiente ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" /> : asignada ? <Check className="w-4 h-4 shrink-0" /> : <Icono className="w-4 h-4 shrink-0" />}
                        {pendiente ? 'Guardando…' : asignada ? `Asignada a ${id}` : `Asignar a ${id}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * Instalar las impresoras desde aquí: descarga el instalador (drivers de la Star TSP143 y registro de la Axiohm)
 * para abrirlo en la computadora donde están conectadas. Destacado cuando no se detectan; si no, un enlace discreto.
 */
function InstalarImpresoras({ destacado }: { destacado: boolean }) {
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  const descargar = async () => {
    setDescargando(true);
    setError(null);
    try {
      await descargarInstaladorImpresoras();
      setListo(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDescargando(false);
    }
  };

  const boton = (
    <button
      type="button"
      onClick={descargar}
      disabled={descargando}
      className={`flex items-center justify-center gap-2 rounded-lg font-semibold cursor-pointer disabled:opacity-60 ${
        destacado
          ? 'px-4 py-2.5 text-sm bg-amber-500 hover:bg-amber-400 text-neutral-950'
          : 'px-3 py-1.5 text-xs border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700'
      }`}
    >
      {descargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {descargando ? 'Descargando…' : 'Descargar instalador de impresoras'}
    </button>
  );

  if (!destacado) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
        <span>¿Vas a conectar las impresoras en otra computadora?</span>
        {boton}
        {error && <span className="w-full text-rose-700">{error}</span>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 space-y-3">
      <div className="flex items-start gap-2.5">
        <Wrench className="w-5 h-5 shrink-0 mt-0.5 text-amber-700" />
        <div>
          <div className="text-sm font-bold text-amber-950">¿No aparecen las impresoras? Instálalas desde aquí</div>
          <p className="text-xs text-amber-900 mt-0.5">En la computadora donde están conectadas por USB (Star TSP143 de cocina y Axiohm de caja):</p>
        </div>
      </div>
      <ol className="list-decimal pl-9 text-xs text-amber-950 space-y-0.5">
        <li>Descarga el instalador y descomprímelo (clic derecho → Extraer todo).</li>
        <li>Conecta y enciende las impresoras.</li>
        <li>Doble clic en <b>INSTALAR.cmd</b> y acepta el permiso de administrador.</li>
        <li>Regresa aquí y toca «Volver a revisar».</li>
      </ol>
      <div className="flex flex-wrap items-center gap-3">
        {boton}
        {listo && <span className="text-xs font-medium text-emerald-800">Descargado: ábrelo en esa computadora.</span>}
        {error && <span className="text-xs text-rose-700">{error}</span>}
      </div>
    </div>
  );
}
