import React, { useState } from 'react';
import { Comanda, ComandaStatus } from '../types/pos';
import {
  ClipboardList,
  Search,
  Clock,
  ChefHat,
  CheckCircle,
  Timer,
  AlertCircle,
  CheckCheck,
} from 'lucide-react';

interface ComandasViewProps {
  comandas: Comanda[];
  onOpenSimulador: () => void;
}

export const ComandasView: React.FC<ComandasViewProps> = ({ comandas, onOpenSimulador }) => {
  const [statusFilter, setStatusFilter] = useState<'todas' | ComandaStatus>('todas');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredComandas = comandas.filter((cmd) => {
    const matchesSearch =
      cmd.accountIdentifier.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cmd.waiterName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cmd.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cmd.id.toLowerCase().includes(searchQuery.toLowerCase());

    if (statusFilter !== 'todas') {
      return matchesSearch && cmd.status === statusFilter;
    }
    return matchesSearch;
  });

  const getStatusBadge = (status: ComandaStatus) => {
    switch (status) {
      case 'nueva':
        return (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-sky-600 bg-sky-50/70 border border-sky-300/60 px-2.5 py-0.5 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping"></span>
            NUEVA
          </span>
        );
      case 'preparando':
        return (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-50/70 border border-amber-300/60 px-2.5 py-0.5 rounded-md">
            <Timer className="w-3 h-3 text-amber-600 animate-spin" />
            PREPARANDO
          </span>
        );
      case 'lista':
        return (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50/70 border border-emerald-300/60 px-2.5 py-0.5 rounded-md">
            <CheckCircle className="w-3 h-3 text-emerald-600" />
            LISTA
          </span>
        );
      case 'entregada':
        return (
          <span className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 bg-neutral-100/80 border border-neutral-300/60 px-2 py-0.5 rounded-md">
            <CheckCheck className="w-3 h-3 text-neutral-600" />
            ENTREGADA
          </span>
        );
    }
  };

  const nuevasCount = comandas.filter((c) => c.status === 'nueva').length;
  const preparandoCount = comandas.filter((c) => c.status === 'preparando').length;
  const listasCount = comandas.filter((c) => c.status === 'lista').length;
  const entregadasCount = comandas.filter((c) => c.status === 'entregada').length;

  return (
    <div className="space-y-6">
      {/* Informative banner: Read-only supervision for cashier */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-amber-500" />
            <span>Comandas</span>
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Órdenes enviadas por los meseros y su avance en cocina.
          </p>
        </div>

        <button
          onClick={onOpenSimulador}
          className="text-xs font-medium text-amber-600 hover:text-amber-700 bg-amber-50/60 border border-amber-200/80 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer"
        >
          Simular nueva orden de tablet
        </button>
      </div>

      {/* Filter and search toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-600" />
          <input
            type="text"
            placeholder="Buscar por orden (#00124), mesa o mesero..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-neutral-200 rounded-lg pl-10 pr-4 py-2 text-sm text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-amber-500/80 transition-colors"
          />
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center gap-1 p-1 bg-white border border-neutral-200 rounded-lg shrink-0 overflow-x-auto">
          <button
            onClick={() => setStatusFilter('todas')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              statusFilter === 'todas'
                ? 'bg-neutral-100 text-neutral-900 shadow-sm font-semibold'
                : 'text-neutral-600 hover:text-neutral-800'
            }`}
          >
            Todas ({comandas.length})
          </button>

          <button
            onClick={() => setStatusFilter('nueva')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'nueva'
                ? 'bg-sky-50 border border-sky-200 text-sky-700 font-semibold'
                : 'text-neutral-600 hover:text-neutral-800'
            }`}
          >
            <span>Nuevas</span>
            <span className="font-mono text-[11px] bg-neutral-100 px-1.5 rounded">{nuevasCount}</span>
          </button>

          <button
            onClick={() => setStatusFilter('preparando')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'preparando'
                ? 'bg-amber-50 border border-amber-200 text-amber-700 font-semibold'
                : 'text-neutral-600 hover:text-neutral-800'
            }`}
          >
            <span>Preparando</span>
            <span className="font-mono text-[11px] bg-neutral-100 px-1.5 rounded">{preparandoCount}</span>
          </button>

          <button
            onClick={() => setStatusFilter('lista')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'lista'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold'
                : 'text-neutral-600 hover:text-neutral-800'
            }`}
          >
            <span>Listas</span>
            <span className="font-mono text-[11px] bg-neutral-100 px-1.5 rounded">{listasCount}</span>
          </button>

          <button
            onClick={() => setStatusFilter('entregada')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'entregada'
                ? 'bg-neutral-100 text-neutral-800 font-semibold'
                : 'text-neutral-600 hover:text-neutral-800'
            }`}
          >
            <span>Entregadas</span>
            <span className="font-mono text-[11px] bg-neutral-100 px-1.5 rounded">{entregadasCount}</span>
          </button>
        </div>
      </div>

      {/* Comandas Grid */}
      {filteredComandas.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-12 text-center max-w-lg mx-auto">
          <ClipboardList className="w-10 h-10 text-neutral-500 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-neutral-800 mb-1">
            No hay comandas registradas
          </h3>
          <p className="text-xs text-neutral-600 mb-5">
            Cuando los meseros envíen pedidos a cocina desde sus tabletas, aparecerán aquí para control de caja.
          </p>
          <button
            onClick={onOpenSimulador}
            className="px-4 py-2 text-xs font-medium text-amber-600 bg-amber-50/60 border border-amber-200/80 hover:bg-amber-100/60 rounded-lg transition-colors cursor-pointer"
          >
            Simular comanda desde tableta
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredComandas.map((cmd) => (
            <div
              key={cmd.id}
              className="bg-white border border-neutral-200 rounded-xl p-4 flex flex-col justify-between"
            >
              {/* Card top */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-neutral-900 tracking-tight">
                        {cmd.accountIdentifier}
                      </span>
                      {cmd.paraLlevar && (
                  <span className="text-[10px] font-black tracking-wider px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 border border-violet-300">
                    PARA LLEVAR
                  </span>
                )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-neutral-600 mt-1 font-mono">
                      <span>Orden: <strong className="text-neutral-900">{cmd.orderNumber}</strong></span>
                      <span>·</span>
                      <span className="flex items-center gap-1 text-neutral-600">
                        <Clock className="w-3 h-3 text-neutral-500" />
                        {cmd.sentAt}
                      </span>
                    </div>
                  </div>

                  {getStatusBadge(cmd.status)}
                </div>

                {/* Items in this comanda */}
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider">
                    Platillos y Bebidas ({cmd.items.length})
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {cmd.items.map((item, i) => (
                      <div
                        key={item.id || i}
                        className="text-xs bg-neutral-50/80 border border-neutral-200/60 rounded-lg p-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2">
                            <span className="font-mono font-bold text-amber-600 bg-neutral-100 px-1.5 rounded">
                              {item.quantity}x
                            </span>
                            <span className="font-medium text-neutral-800">
                              {item.productName}
                            </span>
                          </div>
                          <span className="font-mono text-neutral-600 tabular-nums shrink-0">
                            ${item.totalPrice.toFixed(2)}
                          </span>
                        </div>

                        {item.modifiers && item.modifiers.length > 0 && (
                          <div className="text-[11px] text-neutral-600 pl-6 mt-0.5">
                            {item.modifiers.join(', ')}
                          </div>
                        )}

                        {item.notes && (
                          <div className="text-[11px] text-amber-700/80 italic pl-6 mt-0.5">
                            Nota: {item.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {cmd.generalNotes && (
                    <div className="text-xs text-amber-700 bg-amber-50/30 border border-amber-200/40 p-2 rounded-lg mt-2 italic">
                      Comentario general: {cmd.generalNotes}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer summary */}
              <div className="mt-4 pt-3 border-t border-neutral-200 flex items-center justify-between text-xs text-neutral-600">
                <span>Total de esta orden:</span>
                <span className="text-sm font-bold font-mono text-neutral-900 tabular-nums">
                  $
                  {cmd.items
                    .reduce((sum, it) => sum + it.totalPrice, 0)
                    .toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
