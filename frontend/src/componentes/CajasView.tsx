// Cajas: las órdenes del turno que pidieron la cuenta (orden.estatus = 1, PAGANDO) y están esperando el cobro,
// agrupadas por tipo de venta: Comer aquí (verde) y Para llevar (morado).
// Una orden dividida (botón Dividir) sale como una tarjeta por cuenta, con una franja del color de esa persona
// («CUENTA 1», «CUENTA 2»…): cada quien paga la suya y, al cobrar la última, la orden queda PAGADO. Si la orden
// cambió después de dividirla, sale completa con «Volver a dividir» o para cobrarla de una vez.
// Se actualiza sola con los avisos en vivo (useMesasTurno → services/enVivo.ts).
import React, { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { AlertTriangle, Banknote, CheckCircle2, Home, ListChecks, Loader2, LucideIcon, Receipt, ShoppingBag, Split } from 'lucide-react';
import { etiquetaMesaRegistrada, MesaRegistrada } from '../services/mesasService';
import { CuentaDividida, cuentaPagada, DetalleOrdenBD, divisionVigente, ExtraOrdenBD, obtenerOrden, OrdenBD } from '../services/pedidosService';
import { useMesasTurno } from '../services/sincronizacion';
import { CuentaDetalle } from './CuentaDetalle';
import { CobrarOrden } from './CobrarOrden';
import { DividirCuenta } from './DividirCuenta';

type Parte = NonNullable<MesaRegistrada['partes_divididas']>[number];

/** Las cuentas por cobrar por separado si la orden está dividida y la división sigue sumando su total. */
const cuentasDe = (m: MesaRegistrada): Parte[] =>
  m.partes_divididas?.length && divisionVigente(m.partes_divididas, Number(m.total)) ? m.partes_divididas : [];

/** Lo que falta cobrar de la orden (en una dividida, solo las cuentas sin pagar). */
const pendienteDe = (m: MesaRegistrada) => {
  const cuentas = cuentasDe(m);
  return cuentas.length ? cuentas.filter((c) => !cuentaPagada(c)).reduce((acc, c) => acc + c.importe, 0) : Number(m.total);
};

const PAGANDO = 1;
const PARA_LLEVAR = 2; // orden.tipo_venta_id
const dinero = (n: number) => `$${n.toFixed(2)}`;

/** «Volver a dividir» desde Cajas: la misma pantalla de Dividir cuenta, con la orden recién leída. */
function DividirDesdeCajas({ idOrden, onCerrar }: { idOrden: number; onCerrar: () => void }) {
  const [datos, setDatos] = useState<{ orden: OrdenBD; detalle: DetalleOrdenBD[]; extras: ExtraOrdenBD[]; cuentas_divididas?: CuentaDividida[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    obtenerOrden(idOrden).then(setDatos, (err) => setError(err instanceof Error ? err.message : 'No se pudo cargar la cuenta.'));
  }, [idOrden]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onCerrar}>
      <div role="dialog" aria-label="Volver a dividir la cuenta" className="w-full max-w-5xl max-h-full flex justify-center" onClick={(e) => e.stopPropagation()}>
        {datos ? (
          <DividirCuenta
            idOrden={idOrden}
            etiqueta={datos.orden.etiqueta}
            total={datos.orden.total}
            detalle={datos.detalle}
            extras={datos.extras ?? []}
            guardadas={datos.cuentas_divididas ?? []}
            ordenPagada={datos.orden.estatus === 2}
            onGuardadas={setDatos}
            onCerrar={onCerrar}
          />
        ) : (
          <div className="bg-white rounded-2xl px-6 py-5 text-sm flex items-center gap-2">
            {error ? <><AlertTriangle className="w-5 h-5 text-rose-600" /> {error}</> : <><Loader2 className="w-5 h-5 animate-spin" /> Cargando la cuenta…</>}
          </div>
        )}
      </div>
    </div>
  );
}

interface TipoVenta {
  titulo: string;
  Icono: LucideIcon;
  esDelTipo: (m: MesaRegistrada) => boolean;
  icono: string; // cuadro del ícono en el encabezado del grupo
  colorTitulo: string;
  linea: string;
  tarjeta: string;
  /** Fondo de la tarjeta de cada cuenta de una orden dividida: el color del tipo, un tono más claro. */
  fondoCuenta: string;
  etiqueta: string;
  cobrar: string;
}

// Clases completas para que Tailwind las genere. Tonos oscuros en los botones para que el texto blanco se lea bien.
const TIPOS_VENTA: TipoVenta[] = [
  {
    titulo: 'Comer aquí',
    Icono: Home,
    esDelTipo: (m) => m.tipo_venta_id !== PARA_LLEVAR,
    icono: 'bg-emerald-700 text-white',
    colorTitulo: 'text-emerald-900',
    linea: 'bg-emerald-200',
    tarjeta: 'border-emerald-300 border-l-emerald-600 ring-emerald-100',
    fondoCuenta: 'bg-emerald-50',
    etiqueta: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    cobrar: 'bg-emerald-700 hover:bg-emerald-600',
  },
  {
    titulo: 'Para llevar',
    Icono: ShoppingBag,
    esDelTipo: (m) => m.tipo_venta_id === PARA_LLEVAR,
    icono: 'bg-violet-600 text-white',
    colorTitulo: 'text-violet-900',
    linea: 'bg-violet-200',
    tarjeta: 'border-violet-300 border-l-violet-600 ring-violet-100',
    fondoCuenta: 'bg-violet-50',
    etiqueta: 'bg-violet-50 text-violet-800 border-violet-200',
    cobrar: 'bg-violet-600 hover:bg-violet-500',
  },
];

export const CajasView: React.FC<{ puedeQuitar?: boolean }> = ({ puedeQuitar = false }) => {
  const { mesas, error } = useMesasTurno();
  const porCobrar = (mesas ?? []).filter((m) => m.estatus === PAGANDO);
  const totalPorCobrar = porCobrar.reduce((acc, m) => acc + pendienteDe(m), 0);
  const [cuentaAbierta, setCuentaAbierta] = useState<number | null>(null);
  const [dividiendo, setDividiendo] = useState<number | null>(null);
  // Se guarda la orden al abrir el cobro: al cobrarla deja de estar en la lista (PAGADO) pero la pantalla sigue.
  const [porCobrarAbierta, setPorCobrarAbierta] = useState<
    { id: number; etiqueta: string; total: number; cuenta?: { numero: number; personas: number } } | null
  >(null);
  const cobrar = (m: MesaRegistrada, cuenta?: Parte) =>
    setPorCobrarAbierta({
      id: m.id,
      etiqueta: etiquetaMesaRegistrada(m),
      total: cuenta ? cuenta.importe : Number(m.total),
      ...(cuenta && { cuenta: { numero: cuenta.numero, personas: cuentasDe(m).length } }),
    });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Receipt className="w-5 h-5 text-amber-500" />
          <span>Cajas</span>
        </h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          {porCobrar.length} {porCobrar.length === 1 ? 'orden pidió' : 'órdenes pidieron'} la cuenta · por cobrar{' '}
          <span className="font-mono font-semibold text-neutral-800">{dinero(totalPorCobrar)}</span>
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {mesas === null ? (
        <div className="py-16 flex justify-center text-neutral-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : porCobrar.length === 0 ? (
        <div className="bg-white border border-dashed border-neutral-300 rounded-2xl py-16 px-4 text-center text-sm text-neutral-500">
          Ninguna orden ha pedido la cuenta. Aparecerán aquí en cuanto una tablet toque «PEDIR CUENTA».
        </div>
      ) : (
        TIPOS_VENTA.map((tipo) => {
          const ordenes = porCobrar.filter(tipo.esDelTipo);
          if (ordenes.length === 0) return null;
          const subtotal = ordenes.reduce((acc, m) => acc + pendienteDe(m), 0);
          return (
            <section key={tipo.titulo} aria-label={tipo.titulo} className="space-y-3">
              <div className="flex items-center gap-3">
                <span className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center shadow-sm ${tipo.icono}`}>
                  <tipo.Icono className="w-5 h-5" />
                </span>
                <div>
                  <h3 className={`text-lg font-bold leading-tight ${tipo.colorTitulo}`}>{tipo.titulo}</h3>
                  <p className="text-xs text-neutral-600">
                    {ordenes.length} {ordenes.length === 1 ? 'orden' : 'órdenes'} · por cobrar{' '}
                    <span className="font-mono font-semibold text-neutral-900">{dinero(subtotal)}</span>
                  </p>
                </div>
                <span className={`flex-1 h-px ${tipo.linea}`} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {ordenes.flatMap((m) => {
                  const cuentas = cuentasDe(m);
                  // Dividida: una tarjeta por cuenta. Si no (o si cambió después de dividirla), la orden completa.
                  return (cuentas.length ? cuentas : [undefined]).map((cuenta) => {
                    const pagada = !!cuenta && cuentaPagada(cuenta);
                    const vieja = !cuenta && (m.cuentas_divididas ?? 0) > 0;
                    return (
                      <div
                        key={cuenta ? `${m.id}-${cuenta.numero}` : m.id}
                        className={`border border-l-[6px] ring-2 rounded-xl p-4 flex flex-col gap-3 ${tipo.tarjeta} ${cuenta ? tipo.fondoCuenta : 'bg-white'} ${pagada ? 'opacity-60' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            {/* Cuenta de una orden dividida: «Mesa 1» y debajo «Cuenta 1» */}
                            <div className="text-2xl font-bold tracking-tight leading-tight break-words">
                              {etiquetaMesaRegistrada(m)}
                              {cuenta && <span className={`block ${tipo.colorTitulo}`}>Cuenta {cuenta.numero}</span>}
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1">
                              <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${tipo.etiqueta}`}>
                                <tipo.Icono className="w-3.5 h-3.5" />
                                {tipo.titulo}
                              </span>
                              {(cuenta || vieja) && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border bg-violet-100 text-violet-800 border-violet-300">
                                  <Split className="w-3.5 h-3.5" /> {cuenta ? `CUENTA ${cuenta.numero} DE ${cuentas.length}` : `DIVIDIDA EN ${m.cuentas_divididas}`}
                                </span>
                              )}
                            </div>
                          </div>
                          {pagada ? (
                            <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold tracking-wide px-2 py-0.5 rounded-full border bg-emerald-100 text-emerald-800 border-emerald-300">
                              <CheckCircle2 className="w-3.5 h-3.5" /> PAGADA
                            </span>
                          ) : (
                            <span className="shrink-0 text-[11px] font-bold tracking-wide px-2 py-0.5 rounded-full border bg-amber-100 text-amber-800 border-amber-300">
                              PAGANDO
                            </span>
                          )}
                        </div>
                        <div className={`flex items-baseline justify-between border-t pt-3 ${cuenta ? tipo.linea.replace('bg-', 'border-') : 'border-neutral-100'}`}>
                          <span className="text-xs text-neutral-500">
                            {cuenta ? (pagada ? 'Ya pagó' : 'A cobrar de esta cuenta') : 'Total a cobrar'}
                            {cuenta && <span className="block text-[11px]">Orden completa {dinero(Number(m.total))}</span>}
                          </span>
                          <span className="text-xl font-bold font-mono">{dinero(cuenta ? cuenta.importe : Number(m.total))}</span>
                        </div>
                        {vieja && (
                          <p className="-mt-1 text-xs font-semibold text-amber-800 flex items-start gap-1.5">
                            <AlertTriangle className="w-4 h-4 shrink-0" /> Se quitó algo después de dividirla y las cuentas ya no cuadran: vuelve a dividirla o cóbrala completa.
                          </p>
                        )}
                        <div className={`grid gap-2 ${pagada ? 'grid-cols-1' : 'grid-cols-[auto_1fr]'}`}>
                          <button
                            onClick={() => setCuentaAbierta(m.id)}
                            className="h-11 px-3 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <ListChecks className="w-4 h-4" /> Ver cuenta
                          </button>
                          {!pagada && (
                            <button
                              onClick={() => cobrar(m, cuenta)}
                              className={`h-11 rounded-lg text-white text-base font-bold flex items-center justify-center gap-1.5 cursor-pointer ${tipo.cobrar}`}
                            >
                              <Banknote className="w-5 h-5 shrink-0" /> <span className={`whitespace-nowrap ${vieja ? 'text-sm' : ''}`}>{vieja ? 'Cobrar todo' : 'Cobrar'}</span>
                            </button>
                          )}
                        </div>
                        {/* Dividir desde Cajas (o volver a dividir si ya no cuadra); una vez dividida, cada cuenta sale aparte */}
                        {!cuenta && (
                          <button
                            onClick={() => setDividiendo(m.id)}
                            className={`rounded-lg border-2 border-violet-300 bg-violet-50 hover:bg-violet-100 text-violet-800 text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer ${vieja ? 'h-11' : 'h-10'}`}
                          >
                            <Split className="w-4 h-4" /> {vieja ? 'Volver a dividir' : 'Dividir cuenta'}
                          </button>
                        )}
                      </div>
                    );
                  });
                })}
              </div>
            </section>
          );
        })
      )}

      <AnimatePresence>
        {cuentaAbierta !== null && (
          <CuentaDetalle
            idOrden={cuentaAbierta}
            onCerrar={() => setCuentaAbierta(null)}
            puedeQuitar={puedeQuitar}
            acciones={(() => {
              const m = porCobrar.find((x) => x.id === cuentaAbierta);
              const tipo = m && (TIPOS_VENTA.find((t) => t.esDelTipo(m)) ?? TIPOS_VENTA[0]);
              if (!m || !tipo) return null;
              const cuentas = cuentasDe(m);
              // Dividida: un botón por cada cuenta que falta cobrar.
              const opciones = cuentas.length ? cuentas.filter((c) => !cuentaPagada(c)) : [undefined];
              return (
                <div className={`grid gap-2 ${opciones.length > 1 ? 'grid-cols-2' : ''}`}>
                  {opciones.map((c) => (
                    <button
                      key={c?.numero ?? 'orden'}
                      onClick={() => {
                        setCuentaAbierta(null);
                        cobrar(m, c);
                      }}
                      className={`w-full min-h-12 px-2 rounded-xl text-white font-bold flex items-center justify-center gap-2 cursor-pointer ${c ? 'text-base' : 'text-lg'} ${tipo.cobrar}`}
                    >
                      <Banknote className="w-5 h-5 shrink-0" /> {c ? `Cobrar cuenta ${c.numero} · ${dinero(c.importe)}` : 'Cobrar'}
                    </button>
                  ))}
                </div>
              );
            })()}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {porCobrarAbierta && (
          <CobrarOrden
            idOrden={porCobrarAbierta.id}
            etiqueta={porCobrarAbierta.etiqueta}
            total={porCobrarAbierta.total}
            cuenta={porCobrarAbierta.cuenta}
            onCerrar={() => setPorCobrarAbierta(null)}
          />
        )}
      </AnimatePresence>
      {dividiendo !== null && <DividirDesdeCajas idOrden={dividiendo} onCerrar={() => setDividiendo(null)} />}
    </div>
  );
};
