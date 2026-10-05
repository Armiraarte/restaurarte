import React from 'react';
import { SocketEventLog, TabletDevice } from '../types/pos';
import { RealtimeEventTicker } from './RealtimeEventTicker';
import { Clock, Tablet, Wifi, WifiOff } from 'lucide-react';

interface TabletsViewProps {
  tablets: TabletDevice[];
  events: SocketEventLog[];
  onOpenSimulador: () => void;
}

export const TabletsView: React.FC<TabletsViewProps> = ({ tablets, events, onOpenSimulador }) => {
  const ordenadas = [...tablets].sort((a, b) => Number(a.number) - Number(b.number));
  const conectadas = tablets.filter((t) => t.status === 'conectada').length;
  const desconectadas = tablets.length - conectadas;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Tablet className="w-5 h-5 text-amber-500" />
              <span>Tablets</span>
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              <span className="text-emerald-700 font-medium">{conectadas} conectadas</span>
              {' · '}
              <span className={desconectadas > 0 ? 'text-rose-700 font-medium' : ''}>{desconectadas} desconectadas</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2 self-start sm:self-auto">
            <a
              href="/tablet"
              target="_blank"
              rel="noopener"
              className="px-3.5 py-1.5 text-xs font-semibold text-sky-800 bg-sky-50 border border-sky-200 rounded-lg hover:bg-sky-100 transition-colors"
            >
              Abrir app de tablet
            </a>
            <button
              onClick={onOpenSimulador}
              className="px-3.5 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer"
            >
              Simular desconexión
            </button>
          </div>
        </div>

        {/* Lista por número */}
        {ordenadas.length === 0 ? (
          <div className="text-center text-sm text-neutral-500 py-10 border border-dashed border-neutral-300 rounded-lg">
            No hay tablets registradas.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {ordenadas.map((tab) => {
              const conectada = tab.status === 'conectada';
              return (
                <div
                  key={tab.id}
                  className={`border rounded-xl p-4 space-y-3 ${
                    conectada ? 'border-neutral-200' : 'border-rose-200 bg-rose-50/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-neutral-500">Tablet</div>
                      <div className="text-3xl font-bold tracking-tight font-mono leading-none">{tab.number}</div>
                    </div>
                    <span
                      className={`flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                        conectada
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {conectada ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                      {conectada ? 'Conectada' : 'Desconectada'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-neutral-600 border-t border-neutral-100 pt-3">
                    <Clock className="w-3.5 h-3.5 text-neutral-400" />
                    {conectada ? (
                      <span>
                        Inició sesión a las <strong className="font-mono text-neutral-900">{tab.sessionStartedAt ?? '—'}</strong>
                      </span>
                    ) : (
                      <span>
                        Desconectada desde <strong className="font-mono text-neutral-900">{tab.lastConnection}</strong>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Eventos en vivo enviados por las tablets */}
      <RealtimeEventTicker events={events} />
    </div>
  );
};
