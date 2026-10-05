import React, { useState } from 'react';
import { Account } from '../types/pos';
import { Search, Receipt, BellRing, UtensilsCrossed, Clock, CheckCircle2 } from 'lucide-react';

interface AccountsViewProps {
  accounts: Account[];
  onSelectAccount: (account: Account) => void;
  onInitiateCobro: (account: Account) => void;
  onOpenSimulador: () => void;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  accounts,
  onSelectAccount,
  onInitiateCobro,
  onOpenSimulador,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'todas' | 'solicitadas'>('todas');

  const filteredAccounts = accounts.filter((acc) => {
    const matchesSearch =
      acc.identifier.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.waiterName.toLowerCase().includes(searchQuery.toLowerCase());
    if (filterType === 'solicitadas') {
      return matchesSearch && acc.status === 'cuenta_solicitada';
    }
    return matchesSearch;
  });

  const solicitadasCount = accounts.filter((a) => a.status === 'cuenta_solicitada').length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Receipt className="w-5 h-5 text-amber-500" />
          <span>Cajas</span>
        </h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          {accounts.length} {accounts.length === 1 ? 'cuenta abierta' : 'cuentas abiertas'}
          {solicitadasCount > 0 && ` · ${solicitadasCount} por cobrar`}
        </p>
      </div>

      {/* Top action/filter toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-600" />
          <input
            type="text"
            placeholder="Buscar por mesa o nombre de comensal..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-neutral-200 rounded-lg pl-10 pr-4 py-2 text-sm text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-amber-500/80 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-500 hover:text-neutral-700"
            >
              Limpiar
            </button>
          )}
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-1.5 p-1 bg-white border border-neutral-200 rounded-lg shrink-0">
          <button
            onClick={() => setFilterType('todas')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filterType === 'todas'
                ? 'bg-neutral-100 text-neutral-900 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-800'
            }`}
          >
            Todas ({accounts.length})
          </button>
          <button
            onClick={() => setFilterType('solicitadas')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              filterType === 'solicitadas'
                ? 'bg-amber-500 text-neutral-950 font-semibold shadow-sm'
                : 'text-neutral-600 hover:text-neutral-800'
            }`}
          >
            {solicitadasCount > 0 && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
            <span>Cuenta Solicitada ({solicitadasCount})</span>
          </button>
        </div>
      </div>

      {/* Notice banner when tables have requested bill */}
      {solicitadasCount > 0 && filterType === 'todas' && (
        <div className="bg-amber-50/40 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <BellRing className="w-4 h-4 text-amber-600 animate-bounce shrink-0" />
            <span>
              <strong>{solicitadasCount} {solicitadasCount === 1 ? 'cuenta tiene' : 'cuentas tienen'} solicitud de cobro</strong> desde la tableta del mesero. Se muestran primero para agilizar el servicio.
            </span>
          </div>
          <button
            onClick={() => setFilterType('solicitadas')}
            className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline shrink-0"
          >
            Ver solo pendientes
          </button>
        </div>
      )}

      {/* Accounts Grid */}
      {filteredAccounts.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-12 text-center max-w-lg mx-auto">
          <UtensilsCrossed className="w-10 h-10 text-neutral-500 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-neutral-800 mb-1">
            {searchQuery || filterType === 'solicitadas'
              ? 'No hay cuentas con ese criterio'
              : 'No hay cuentas abiertas'}
          </h3>
          <p className="text-xs text-neutral-600 mb-5">
            {searchQuery || filterType === 'solicitadas'
              ? 'Intenta restablecer la búsqueda o el filtro seleccionado.'
              : 'Las cuentas abiertas por las 4 tabletas de meseros aparecerán automáticamente aquí.'}
          </p>
          <div className="flex justify-center gap-3">
            {(searchQuery || filterType === 'solicitadas') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterType('todas');
                }}
                className="px-4 py-2 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
              >
                Ver todas las cuentas
              </button>
            )}
            <button
              onClick={onOpenSimulador}
              className="px-4 py-2 text-xs font-medium text-amber-600 bg-amber-50/60 border border-amber-200/80 hover:bg-amber-100/60 rounded-lg transition-colors"
            >
              Simular llegada de cuenta
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAccounts.map((account) => {
            const isRequested = account.status === 'cuenta_solicitada';

            return (
              <div
                key={account.id}
                onClick={() => onSelectAccount(account)}
                className={`relative group bg-white rounded-xl border p-4 cursor-pointer transition-all duration-150 flex flex-col justify-between select-none ${
                  isRequested
                    ? 'border-amber-500/80 bg-white/90 ring-1 ring-amber-500/50 hover:border-amber-600 hover:shadow-lg hover:shadow-amber-500/10'
                    : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-100'
                }`}
              >
                {/* Header of Card */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-neutral-900 tracking-tight group-hover:text-amber-600 transition-colors">
                          {account.identifier}
                        </h3>
                        {account.paraLlevar && (
                  <span className="text-[10px] font-black tracking-wider px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 border border-violet-300">
                    PARA LLEVAR
                  </span>
                )}
                        {account.identifierType === 'mesa' && (
                          <span className="text-[11px] text-neutral-600 font-mono">
                            Mesa
                          </span>
                        )}
                      </div>
                      {/* Quiet unboxed metadata */}
                      <div className="flex items-center gap-1.5 text-xs text-neutral-600 mt-0.5">
                        <Clock className="w-3 h-3 text-neutral-500" />
                        <span>Abierta: {account.openedAt}</span>
                      </div>
                    </div>

                    {/* Status Indicator */}
                    {isRequested ? (
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-50/60 border border-amber-400/40 px-2 py-0.5 rounded">
                        <BellRing className="w-3 h-3 animate-pulse" />
                        <span>Solicitada</span>
                      </div>
                    ) : (
                      <div className="text-xs text-neutral-600 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span>Abierta</span>
                      </div>
                    )}
                  </div>

                  {/* Brief content summary */}
                  <div className="text-xs text-neutral-600 border-t border-neutral-200/80 pt-2.5 my-2">
                    <div className="flex justify-between items-center text-neutral-600">
                      <span>{account.items.length} {account.items.length === 1 ? 'producto' : 'productos'}</span>
                      <span className="truncate max-w-[130px] text-neutral-600 text-right">
                        Mesero: {account.waiterName}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Total and Cobro CTA */}
                <div className="mt-3 pt-2.5 border-t border-neutral-200 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] text-neutral-600 uppercase tracking-wider block font-medium">
                      Total Acumulado
                    </span>
                    <span className="text-xl font-bold font-mono text-neutral-900 tabular-nums">
                      ${account.total.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onInitiateCobro(account);
                    }}
                    className={`px-3 py-2 text-xs font-semibold rounded-lg transition-all active:scale-95 whitespace-nowrap cursor-pointer ${
                      isRequested
                        ? 'bg-amber-500 text-neutral-950 hover:bg-amber-400 shadow-sm'
                        : 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200 hover:text-neutral-900 border border-neutral-300'
                    }`}
                  >
                    Cobrar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
