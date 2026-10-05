import React, { useState } from 'react';
import { SocketEventLog } from '../types/pos';
import { ChevronDown, ChevronUp, Radio } from 'lucide-react';

interface RealtimeEventTickerProps {
  events: SocketEventLog[];
}

export const RealtimeEventTicker: React.FC<RealtimeEventTickerProps> = ({ events }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const latestEvent = events[0];

  const getEventBadge = (type: SocketEventLog['eventType']) => {
    switch (type) {
      case 'kitchen.ready':
        return <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">LISTA EN COCINA</span>;
      case 'account.requested':
        return <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">CUENTA SOLICITADA</span>;
      case 'tablet.disconnected':
        return <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">DISPOSITIVO OFFLINE</span>;
      case 'tablet.connected':
        return <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">TABLET ONLINE</span>;
      case 'order.sent_to_kitchen':
        return <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">ORDEN ENVIADA</span>;
      case 'kitchen.preparing':
        return <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">PREPARANDO</span>;
      case 'account.paid':
        return <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">PAGO CONFIRMADO</span>;
      default:
        return <span className="text-[10px] font-mono text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded">{type}</span>;
    }
  };

  return (
    <section aria-label="Eventos en tiempo real" className="bg-white border border-neutral-200 rounded-xl text-xs overflow-hidden">
      {/* Ticker Bar */}
      <div className="px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-hidden flex-1">
          <div className="flex items-center gap-1.5 text-amber-600 font-mono font-semibold shrink-0">
            <Radio className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
            <span className="hidden sm:inline">EVENTOS EN VIVO:</span>
          </div>

          {latestEvent ? (
            <div className="flex items-center gap-2 truncate">
              {getEventBadge(latestEvent.eventType)}
              <span className="text-neutral-600 font-mono text-[11px] shrink-0">[{latestEvent.timestamp}]</span>
              <span className="text-neutral-800 font-medium truncate">{latestEvent.message}</span>
              <span className="text-[10px] text-neutral-600 font-mono shrink-0 hidden md:inline">
                ({latestEvent.source})
              </span>
            </div>
          ) : (
            <span className="text-neutral-600 font-mono">Esperando eventos de red...</span>
          )}
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors shrink-0 cursor-pointer"
        >
          <span>Historial ({events.length})</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expanded Log Drawer */}
      {isExpanded && (
        <div className="border-t border-neutral-200 max-h-56 overflow-y-auto p-3 space-y-1.5 bg-neutral-50/60 font-mono text-[11px]">
          {events.length === 0 ? (
            <div className="text-neutral-600 text-center py-2">Sin eventos registrados</div>
          ) : (
            events.map((evt) => (
              <div
                key={evt.id}
                className="flex items-start justify-between gap-3 p-1.5 rounded hover:bg-neutral-100/60 transition-colors"
              >
                <div className="flex items-center gap-2 overflow-hidden flex-1">
                  <span className="text-neutral-600">{evt.timestamp}</span>
                  {getEventBadge(evt.eventType)}
                  <span className="text-neutral-800 truncate">{evt.message}</span>
                </div>
                <span className="text-neutral-600 shrink-0">Origen: {evt.source}</span>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
};
