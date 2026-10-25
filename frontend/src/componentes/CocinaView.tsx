import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ChefHat, LayoutGrid, Loader2, Phone, Printer, RefreshCw, Search, User } from 'lucide-react';
import { obtenerCocina } from '../services/cocinaService';
import { agruparMesasCocina, construirComandasCocina, OrdenCocina, SeccionCocina } from '../services/comandasCocina';
import { CategoriaMenu, obtenerMenu, obtenerOrden } from '../services/pedidosService';
import { imprimirTicketCocina } from '../services/ticketCocinaService';
import { TicketCocina } from '../types/ticketCocina';
import { useEnVivo } from '../services/enVivo';
import { useCadaTantoVisible } from '../services/sincronizacion';
import { TicketCocinaPapel } from './TicketCocinaModal';

const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
const normal = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
const SECCIONES = [
  { id: 'mesas' as const, nombre: 'Mesas', singular: 'una mesa', icono: LayoutGrid },
  { id: 'llamadas' as const, nombre: 'Llamadas', singular: 'una llamada', icono: Phone },
  { id: 'nombres' as const, nombre: 'Nombres', singular: 'un nombre', icono: User },
];

export function CocinaView() {
  const [ordenes, setOrdenes] = useState<OrdenCocina[] | null>(null);
  const [menu, setMenu] = useState<CategoriaMenu[] | null>(null);
  const [mesa, setMesa] = useState<string | null>(null);
  const [seccion, setSeccion] = useState<SeccionCocina | null>(null);
  const [ordenElegida, setOrdenElegida] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [soloActivas, setSoloActivas] = useState(false);
  const [revision, setRevision] = useState(0);
  const [datos, setDatos] = useState<{ id: number; tickets: TicketCocina[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [imprimiendo, setImprimiendo] = useState<string | null>(null);
  const recargar = useCallback(() => {
    Promise.all([obtenerCocina(), obtenerMenu()]).then(([d, catalogo]) => {
      setOrdenes((previa) => JSON.stringify(previa) === JSON.stringify(d.ordenes) ? previa : d.ordenes);
      setMenu((previo) => JSON.stringify(previo) === JSON.stringify(catalogo) ? previo : catalogo);
      setRevision((n) => n + 1);
      setError(null);
    }).catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar las comandas.'));
  }, []);
  useEffect(() => { recargar(); }, [recargar]);
  useEnVivo(['ordenes', 'turno'], recargar);
  useCadaTantoVisible(recargar, 10_000);
  const grupos = useMemo(() => agruparMesasCocina(ordenes ?? []), [ordenes]);
  const mesasEntrada = [
    ...Array.from({ length: 9 }, (_, i) => String(i + 1)),
    ...grupos.filter((g) => g.seccion === 'mesas' && !/^[1-9]$/.test(g.nombre)).map((g) => g.nombre),
  ];
  const mesas = useMemo(() => agruparMesasCocina((ordenes ?? []).filter((o) =>
    (!soloActivas || o.estatus !== 2) && normal(`${o.nombre} ${o.codigo}`).includes(normal(busqueda.trim())),
  )).filter((m) => m.seccion === seccion), [ordenes, soloActivas, busqueda, seccion]);
  const grupo = mesas.find((m) => m.clave === mesa);
  const seccionActual = SECCIONES.find((s) => s.id === seccion);
  const orden = grupo?.ordenes.find((o) => o.id === ordenElegida) ?? [...(grupo?.ordenes ?? [])].reverse().find((o) => o.estatus !== 2) ?? grupo?.ordenes.at(-1);
  const idOrden = orden?.id;
  useEffect(() => {
    if (!idOrden || !menu) return;
    let cancelado = false;
    obtenerOrden(idOrden).then((d) => {
      if (!cancelado) setDatos({ id: idOrden, tickets: construirComandasCocina(d.orden, d.detalle, d.extras, menu) });
    }).catch((e) => { if (!cancelado) setError(e.message); });
    return () => { cancelado = true; };
  }, [idOrden, menu, revision]);
  const tickets = datos && datos.id === idOrden ? datos.tickets : null;
  const imprimir = async (ticket: TicketCocina) => {
    if (imprimiendo) return;
    setImprimiendo(ticket.comanda_id); setAviso(null); setError(null);
    try {
      const impresora = await imprimirTicketCocina(ticket);
      setAviso(`Comanda ${ticket.orden_cocina} enviada a ${impresora}.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo reimprimir.'); }
    finally { setImprimiendo(null); }
  };
  return (
    <div className="h-full min-h-0 flex flex-col gap-3">
      <header className="shrink-0 flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="text-xl font-bold flex items-center gap-2"><ChefHat className="w-6 h-6 text-orange-600" /> Cocina</h2>
          {seccionActual && <p className="text-xs text-neutral-500">{seccionActual.nombre} · Selecciona un envío para reimprimirlo.</p>}</div>
        {seccion && <button onClick={() => { setSeccion(null); setMesa(null); setOrdenElegida(null); setAviso(null); setBusqueda(''); }} className="flex items-center gap-2 px-3 h-10 rounded-xl bg-white border border-neutral-200 font-semibold cursor-pointer"><ArrowLeft className="w-4 h-4" /> Cocina</button>}
        <button onClick={recargar} aria-label="Actualizar comandas" className="p-2 rounded-xl bg-white border border-neutral-200 cursor-pointer"><RefreshCw className="w-5 h-5" /></button>
      </header>
      {error && <div role="alert" className="shrink-0 rounded-xl px-3 py-2 bg-red-50 text-red-800 flex items-center gap-2 text-sm"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</div>}
      {aviso && <div role="status" className="shrink-0 rounded-xl px-3 py-2 bg-emerald-50 text-emerald-800 text-sm">{aviso}</div>}
      {seccion && <div className="shrink-0 flex flex-wrap items-center gap-3">
        <label className="relative flex-1 min-w-48"><Search className="absolute left-3 top-3 w-4 h-4 text-neutral-400" /><input type="search" aria-label="Buscar mesa o nombre" placeholder="Buscar mesa, nombre u orden" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="h-10 w-full pl-9 pr-3 rounded-xl border border-neutral-200 bg-white text-sm" /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={soloActivas} onChange={(e) => setSoloActivas(e.target.checked)} /> Solo cuentas abiertas</label>
      </div>}
      {ordenes === null ? <div className="flex-1 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin" /></div> : !seccion ? (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
          <nav aria-label="Mesas de cocina" className="grid grid-cols-3 gap-3">
            {mesasEntrada.map((numero) => {
              const registrada = grupos.find((g) => g.seccion === 'mesas' && g.nombre === numero);
              return <button key={numero} disabled={!registrada} onClick={() => { setSeccion('mesas'); setMesa(registrada!.clave); setOrdenElegida(null); setBusqueda(''); setAviso(null); }} className="min-h-28 bg-white rounded-2xl border-2 border-orange-200 hover:border-orange-500 hover:bg-orange-50 disabled:bg-neutral-50 disabled:border-neutral-200 disabled:text-neutral-400 disabled:cursor-default flex flex-col items-center justify-center gap-2 cursor-pointer">
                <LayoutGrid className="w-7 h-7" /><span className="text-xl font-bold">Mesa {numero}</span><span className="text-xs">{registrada ? `${registrada.ordenes.reduce((n, o) => n + o.envios, 0)} envíos` : 'Sin comandas'}</span>
              </button>;
            })}
          </nav>
        <nav aria-label="Llamadas y nombres de cocina" className="grid grid-cols-2 gap-3">
          {SECCIONES.filter((s) => s.id !== 'mesas').map(({ id, nombre, icono: Icono }) => {
            const dentro = grupos.filter((g) => g.seccion === id);
            return <button key={id} onClick={() => { setSeccion(id); setMesa(null); setOrdenElegida(null); setBusqueda(''); setAviso(null); }} className="min-h-28 bg-white rounded-2xl border-2 border-orange-200 hover:border-orange-500 hover:bg-orange-50 flex flex-col items-center justify-center gap-2 cursor-pointer">
              <Icono className="w-7 h-7 text-orange-600" /><span className="text-xl font-bold">{nombre}</span><span className="text-xs text-neutral-500">{dentro.reduce((n, g) => n + g.ordenes.length, 0)} pedidos</span>
            </button>;
          })}
        </nav>
        </div>
      ) : !mesas.length ? (
        <div className="flex-1 grid place-items-center text-neutral-500 text-center">{busqueda || soloActivas ? 'No hay comandas con ese filtro.' : `No hay pedidos en ${seccionActual?.nombre.toLowerCase()} en el turno actual.`}</div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-3">
          <nav aria-label={`${seccionActual?.nombre} de cocina`} className="shrink-0 md:w-48 flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto pb-1">
            {mesas.map((m) => <button key={m.clave} onClick={() => { setMesa(m.clave); setOrdenElegida(null); setAviso(null); }} aria-pressed={grupo?.clave === m.clave} className={`shrink-0 p-3 rounded-xl border-2 text-left cursor-pointer ${grupo?.clave === m.clave ? 'bg-orange-100 border-orange-500 text-orange-950' : 'bg-white border-neutral-200'}`}><span className="block font-bold">{m.etiqueta}</span><span className="block text-xs">{m.ordenes.reduce((n, o) => n + o.envios, 0)} envíos · {m.ordenes.length} cuentas</span></button>)}
          </nav>
          <section className="flex-1 min-w-0 min-h-0 flex flex-col gap-3">
            <div className="shrink-0 flex flex-wrap gap-2 items-center">
              <h3 className="font-bold text-lg mr-2">{grupo?.etiqueta}</h3>
              {grupo?.ordenes.map((o) => <button key={o.id} onClick={() => { setOrdenElegida(o.id); setAviso(null); }} aria-pressed={idOrden === o.id} className={`px-3 py-2 rounded-xl border text-sm cursor-pointer ${idOrden === o.id ? 'bg-neutral-900 border-neutral-900 text-white' : 'bg-white border-neutral-200'}`}>{o.codigo} · {o.estatus === 2 ? 'Cobrada' : 'Abierta'}</button>)}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              {!grupo ? <div className="py-12 text-center text-neutral-500">Selecciona {seccionActual?.singular} para ver sus comandas.</div> : !tickets ? <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div> : !tickets.length ? <p className="text-neutral-500">Esta cuenta no tiene comandas de cocina.</p> : (
                <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 items-start gap-3 pb-3">
                  {tickets.map((t) => <article key={t.comanda_id} className="bg-white/90 rounded-2xl border border-neutral-200 overflow-hidden">
                    <header className="flex items-center justify-between gap-2 px-3 py-3 border-b border-neutral-200"><div><b>Envío {t.ronda}</b><span className="block text-xs text-neutral-500">{hora(t.enviada_en)} · {t.total_piezas} piezas</span></div>
                      <button onClick={() => imprimir(t)} disabled={imprimiendo !== null} aria-label={`Reimprimir ${t.mesa} envío ${t.ronda}`} className="flex items-center gap-2 px-3 h-10 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm cursor-pointer disabled:opacity-50">{imprimiendo === t.comanda_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} Reimprimir</button></header>
                    <div className="p-3"><TicketCocinaPapel ticket={t} /></div>
                  </article>)}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
