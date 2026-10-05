import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Comanda } from '../types/pos';
import { posDataService } from '../services/dataService';
import {
  ChefHat,
  Clock,
  Play,
  CheckCircle2,
  Send,
  Timer,
  Tablet,
  User,
  Check,
  ClipboardList,
  History,
  LucideIcon,
} from 'lucide-react';

type VistaCocina = 'ordenes' | 'preparacion' | 'historial';

const BOTONES_VISTA: Record<VistaCocina, { label: string; icon: LucideIcon; normal: string; activo: string; contador: string }> = {
  ordenes: {
    label: 'Órdenes',
    icon: ClipboardList,
    normal: 'bg-sky-50 border-sky-200 text-sky-800 hover:bg-sky-100',
    activo: 'bg-sky-100 border-sky-400 text-sky-900',
    contador: 'bg-sky-600 text-white',
  },
  preparacion: {
    label: 'Preparación',
    icon: Timer,
    normal: 'bg-orange-50 border-orange-200 text-orange-800 hover:bg-orange-100',
    activo: 'bg-orange-100 border-orange-400 text-orange-900',
    contador: 'bg-orange-500 text-white',
  },
  historial: {
    label: 'Historial',
    icon: History,
    normal: 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100',
    activo: 'bg-slate-100 border-slate-400 text-slate-900',
    contador: 'bg-slate-600 text-white',
  },
};

interface KitchenKdsViewProps {
  comandas: Comanda[];
  onOpenSimulador: () => void;
}

export const KitchenKdsView: React.FC<KitchenKdsViewProps> = ({
  comandas,
  onOpenSimulador,
}) => {
  // Ninguna lista visible hasta que se toque un botón; tocar el activo la oculta.
  const [vista, setVista] = useState<VistaCocina | null>(null);
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);

  const notifyAction = (msg: string) => {
    setActionSuccessNotice(msg);
    setTimeout(() => setActionSuccessNotice(null), 4000);
  };

  const handleStartPreparing = (comandaId: string) => {
    try {
      const updated = posDataService.kitchenStartPreparing(comandaId);
      notifyAction(`✓ Comanda ${updated.orderNumber} (${updated.accountIdentifier}) pasó a estado "PREPARANDO".`);
    } catch (err: any) {
      alert(err.message || 'Error al actualizar comanda');
    }
  };

  const handleMarkAsReady = (comandaId: string) => {
    try {
      const updated = posDataService.kitchenMarkReady(comandaId);
      notifyAction(
        `✓ ¡Orden ${updated.orderNumber} (${updated.accountIdentifier}) LISTA! Se envió notificación a ${updated.sentByTablet} (${updated.waiterName}).`
      );
    } catch (err: any) {
      alert(err.message || 'Error al marcar como lista');
    }
  };

  const handleMarkAsDelivered = (comandaId: string) => {
    try {
      const updated = posDataService.kitchenMarkDelivered(comandaId);
      notifyAction(`✓ Orden ${updated.orderNumber} marcada como ENTREGADA a los comensales.`);
    } catch (err: any) {
      alert(err.message || 'Error al marcar como entregada');
    }
  };

  // Grouping
  const nuevas = comandas.filter((c) => c.status === 'nueva');
  const preparando = comandas.filter((c) => c.status === 'preparando');
  const listas = comandas.filter((c) => c.status === 'lista');
  const entregadas = comandas.filter((c) => c.status === 'entregada');

  const conteos: Record<VistaCocina, number> = {
    ordenes: nuevas.length,
    preparacion: preparando.length,
    historial: listas.length, // las listas siguen pendientes de servir
  };

  const renderLista = (lista: Comanda[], vacio: string) =>
    lista.length === 0 ? (
      <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center text-sm text-neutral-500">{vacio}</div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{lista.map((cmd) => renderComandaCard(cmd))}</div>
    );

  const renderComandaCard = (cmd: Comanda) => {
    const isNew = cmd.status === 'nueva';
    const isPreparing = cmd.status === 'preparando';
    const isReady = cmd.status === 'lista';
    const isDelivered = cmd.status === 'entregada';

    // Color code elapsed time
    const isDelayed = cmd.elapsedMinutes > 20;

    return (
      <div
        key={cmd.id}
        className={`bg-white rounded-xl border p-4 flex flex-col justify-between transition-all select-none ${
          isReady
            ? 'border-emerald-500/70 ring-1 ring-emerald-500/40 bg-white/90'
            : isPreparing
            ? 'border-amber-500/60 ring-1 ring-amber-500/30'
            : isNew
            ? 'border-sky-500/60 ring-1 ring-sky-500/30'
            : 'border-neutral-200 opacity-70'
        }`}
      >
        <div>
          {/* Card Top: Table & Order Number */}
          <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-neutral-200">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold text-neutral-900 tracking-tight">
                  {cmd.accountIdentifier.toUpperCase()}
                </span>
                {cmd.paraLlevar && (
                  <span className="text-[10px] font-black tracking-wider px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 border border-violet-300">
                    PARA LLEVAR
                  </span>
                )}
                {cmd.isAddition && (
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50/80 border border-amber-200/80 px-1.5 py-0.2 rounded">
                    + Adición #{cmd.sequenceNumber}
                  </span>
                )}
              </div>
              <div className="text-xs font-mono text-neutral-600 mt-0.5">
                Orden <strong className="text-neutral-900">{cmd.orderNumber}</strong>
              </div>
            </div>

            {/* Time badge */}
            <div className="text-right">
              <span className="text-xs text-neutral-600 font-mono flex items-center justify-end gap-1">
                <Clock className="w-3 h-3 text-neutral-500" />
                <span>{cmd.sentAt}</span>
              </span>
              <span
                className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded mt-0.5 inline-block ${
                  isDelayed
                    ? 'bg-rose-50/80 border border-rose-200 text-rose-700 animate-pulse'
                    : 'bg-neutral-50 text-neutral-600 border border-neutral-200'
                }`}
              >
                ⏱ {cmd.elapsedMinutes} min
              </span>
            </div>
          </div>

          {/* Device metadata */}
          <div className="flex items-center justify-between text-[11px] text-neutral-600 py-1.5 border-b border-neutral-200">
            <span className="flex items-center gap-1">
              <Tablet className="w-3 h-3 text-neutral-500" />
              <span>{cmd.sentByTablet}</span>
            </span>
            <span className="flex items-center gap-1">
              <User className="w-3 h-3 text-neutral-500" />
              <span>{cmd.waiterName}</span>
            </span>
          </div>

          {/* Product Items List formatted like tickets with modifiers in bullets */}
          <div className="py-3 space-y-2">
            {cmd.items.map((item, idx) => (
              <div key={item.id || idx} className="bg-neutral-50/70 p-2.5 rounded-lg border border-neutral-200">
                <div className="flex items-start gap-2">
                  <span className="font-mono text-sm font-bold bg-neutral-100 text-amber-600 px-2 py-0.5 rounded shrink-0">
                    {item.quantity} x
                  </span>
                  <div className="flex-1">
                    <span className="text-sm font-bold text-neutral-900">
                      {item.productName}
                    </span>

                    {/* Modifiers bullet list as required */}
                    {item.modifiers && item.modifiers.length > 0 && (
                      <ul className="mt-1 space-y-0.5 pl-2 text-xs text-neutral-600 list-disc list-inside">
                        {item.modifiers.map((mod, mIdx) => (
                          <li key={mIdx} className="text-neutral-700">
                            {mod}
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Special Notes */}
                    {item.notes && (
                      <div className="text-xs text-amber-700 mt-1 italic pl-1 border-l-2 border-amber-500/60">
                        Nota: {item.notes}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {cmd.generalNotes && (
              <div className="text-xs text-amber-700 bg-amber-50/40 border border-amber-200/60 p-2 rounded-lg italic">
                Nota general: {cmd.generalNotes}
              </div>
            )}
          </div>
        </div>

        {/* Tipo de orden de la cuenta: se ve claro en cocina */}
        {cmd.paraLlevar && (
          <div className="mb-3 py-2 rounded-lg bg-violet-100 border-2 border-violet-400 text-violet-900 text-center text-sm font-black tracking-wider">
            PARA LLEVAR
          </div>
        )}

        {/* Action Button Area */}
        <div className="pt-2 border-t border-neutral-200">
          {isNew && (
            <button
              onClick={() => handleStartPreparing(cmd.id)}
              className="w-full py-2.5 text-xs font-bold text-neutral-950 bg-amber-500 hover:bg-amber-400 active:scale-98 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>INICIAR PREPARACIÓN</span>
            </button>
          )}

          {isPreparing && (
            <button
              onClick={() => handleMarkAsReady(cmd.id)}
              className="w-full py-2.5 text-xs font-bold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 active:scale-98 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>MARCAR COMO LISTA</span>
            </button>
          )}

          {isReady && (
            <div className="space-y-1.5">
              <div className="text-[11px] text-center text-emerald-600 font-semibold bg-emerald-50/60 border border-emerald-200/60 py-1 rounded">
                ✓ Notificado a {cmd.sentByTablet} ({cmd.waiterName})
              </div>
              <button
                onClick={() => handleMarkAsDelivered(cmd.id)}
                className="w-full py-2 text-xs font-medium text-neutral-800 bg-neutral-100 hover:bg-neutral-200 active:scale-98 rounded-lg border border-neutral-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Marcar Entregada a Comensales</span>
              </button>
            </div>
          )}

          {isDelivered && (
            <div className="text-xs text-neutral-600 text-center py-1 font-mono">
              Entregada · Finalizada
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* KDS Header Banner */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ChefHat className="w-5 h-5 text-amber-500" />
          <h2 className="text-xl font-bold text-neutral-900 tracking-tight">Cocina</h2>
        </div>

        <button
          onClick={onOpenSimulador}
          className="self-start md:self-auto px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50/60 border border-amber-200/80 rounded-lg hover:bg-amber-100/60 transition-colors cursor-pointer"
        >
          Simular eventos
        </button>
      </div>

      {/* Action feedback banner */}
      {actionSuccessNotice && (
        <div className="p-3 bg-emerald-50/80 border border-emerald-400/60 rounded-xl text-emerald-800 text-xs flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccessNotice}</span>
        </div>
      )}

      {/* ÓRDENES | PREPARACIÓN | HISTORIAL */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {(Object.keys(BOTONES_VISTA) as VistaCocina[]).map((id) => {
          const { label, icon: Icon, normal, activo, contador } = BOTONES_VISTA[id];
          const cantidad = conteos[id];
          const seleccionado = vista === id;
          return (
            <button
              key={id}
              onClick={() => setVista(seleccionado ? null : id)}
              aria-expanded={seleccionado}
              className={`relative min-h-[72px] flex flex-col items-center justify-center gap-1.5 px-2 py-3 rounded-xl border-2 text-sm transition-colors cursor-pointer ${
                seleccionado ? `${activo} font-semibold shadow-sm` : `${normal} font-medium`
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className="whitespace-nowrap">{label}</span>
              {cantidad > 0 && (
                <span className={`absolute top-1.5 right-1.5 min-w-6 h-6 px-1.5 rounded-full text-xs font-bold flex items-center justify-center ${contador}`}>
                  {cantidad}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Contenido de la opción elegida */}
      <AnimatePresence mode="wait">
        {vista && (
          <motion.div
            key={vista}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="space-y-5"
          >
            {vista === 'ordenes' && renderLista(nuevas, 'No hay órdenes nuevas.')}
            {vista === 'preparacion' && renderLista(preparando, 'No hay órdenes en preparación.')}
            {vista === 'historial' && (
              <>
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                    Listas para servir ({listas.length})
                  </h3>
                  {renderLista(listas, 'No hay órdenes esperando a ser servidas.')}
                </div>
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-600">
                    Entregadas ({entregadas.length})
                  </h3>
                  {renderLista(entregadas, 'Aún no se ha entregado ninguna orden.')}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
