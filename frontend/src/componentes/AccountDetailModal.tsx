import React from 'react';
import { Account } from '../types/pos';
import { X, Tablet, User, Clock, BellRing, Receipt, AlertTriangle } from 'lucide-react';

interface AccountDetailModalProps {
  account: Account | null;
  onClose: () => void;
  onInitiateCobro: (account: Account) => void;
}

export const AccountDetailModal: React.FC<AccountDetailModalProps> = ({
  account,
  onClose,
  onInitiateCobro,
}) => {
  if (!account) return null;

  const isRequested = account.status === 'cuenta_solicitada';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="bg-white border border-neutral-200 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-neutral-200 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
                {account.identifier}
              </h2>
              {account.paraLlevar && (
                  <span className="text-[10px] font-black tracking-wider px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 border border-violet-300">
                    PARA LLEVAR
                  </span>
                )}
              {isRequested ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-50/80 border border-amber-500/50 px-2.5 py-1 rounded-md">
                  <BellRing className="w-3.5 h-3.5 animate-pulse" />
                  Cuenta Solicitada por Mesero
                </span>
              ) : (
                <span className="text-xs text-neutral-600 bg-neutral-100/80 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Cuenta Abierta
                </span>
              )}
            </div>

            {/* Tablet and metadata kept inside detail as requested */}
            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-neutral-600 mt-2">
              <div className="flex items-center gap-1.5 text-neutral-700">
                <Tablet className="w-3.5 h-3.5 text-amber-600" />
                <span>Origen: {account.openedByTablet}</span>
              </div>
              <span className="text-neutral-400">·</span>
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-neutral-500" />
                <span>Mesero: {account.waiterName}</span>
              </div>
              <span className="text-neutral-400">·</span>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-neutral-500" />
                <span>Apertura: {account.openedAt}</span>
              </div>
              {account.requestedAt && (
                <>
                  <span className="text-neutral-400">·</span>
                  <div className="text-amber-600 font-medium">
                    Solicitud de ticket: {account.requestedAt}
                  </div>
                </>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-neutral-600 hover:text-neutral-900 p-1 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body - Items list */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          <div className="flex items-center justify-between text-xs text-neutral-600 font-medium uppercase tracking-wider pb-1 border-b border-neutral-200">
            <span>Detalle de Consumo ({account.items.length} productos)</span>
            <span>Importe</span>
          </div>

          {account.items.length === 0 ? (
            <div className="text-center py-8 text-neutral-500 text-sm">
              Esta cuenta aún no tiene comandas ni productos registrados desde la tableta.
            </div>
          ) : (
            <div className="space-y-3">
              {account.items.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="bg-neutral-50/60 border border-neutral-200/80 rounded-xl p-3 flex flex-col sm:flex-row sm:items-start justify-between gap-2"
                >
                  <div className="flex items-start gap-3">
                    <span className="font-mono text-sm font-bold bg-neutral-100 text-amber-600 px-2 py-0.5 rounded shrink-0">
                      {item.quantity}x
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-neutral-900">
                        {item.productName}
                      </div>
                      <div className="text-xs text-neutral-600 mt-0.5">
                        ${item.unitPrice.toFixed(2)} c/u
                      </div>

                      {/* Modifiers / combinations */}
                      {item.modifiers && item.modifiers.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {item.modifiers.map((mod, mIdx) => (
                            <span
                              key={mIdx}
                              className="text-[11px] text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200"
                            >
                              {mod}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Observations / notes */}
                      {item.notes && (
                        <div className="text-xs text-amber-700/90 mt-1 italic">
                          Nota: {item.notes}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="font-mono text-sm font-bold text-neutral-900 tabular-nums self-end sm:self-start">
                    ${item.totalPrice.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer: Totals and Action */}
        <div className="p-4 sm:p-6 bg-neutral-50 border-t border-neutral-200">
          <div className="space-y-1.5 text-xs text-neutral-600 mb-4">
            <div className="flex justify-between">
              <span>Subtotal neto:</span>
              <span className="font-mono tabular-nums text-neutral-800">
                ${account.subtotal.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Impuestos (16% IVA incluido):</span>
              <span className="font-mono tabular-nums text-neutral-800">
                ${account.tax.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-baseline pt-2 border-t border-neutral-200 text-sm">
              <span className="text-base font-bold text-neutral-900">Total a Cobrar:</span>
              <span className="text-2xl font-bold font-mono text-amber-600 tabular-nums">
                ${account.total.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              Cerrar
            </button>
            <button
              onClick={() => {
                onClose();
                onInitiateCobro(account);
              }}
              disabled={account.items.length === 0}
              className="px-5 py-2.5 text-sm font-bold text-neutral-950 bg-amber-500 hover:bg-amber-400 active:scale-95 disabled:opacity-50 disabled:pointer-events-none rounded-lg shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <Receipt className="w-4 h-4" />
              <span>Iniciar Cobro</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
