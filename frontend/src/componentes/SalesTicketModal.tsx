import React from 'react';
import { PaymentRecord } from '../types/pos';
import { Printer, Check, X } from 'lucide-react';

interface SalesTicketModalProps {
  payment: PaymentRecord | null;
  onClose: () => void;
}

export const SalesTicketModal: React.FC<SalesTicketModalProps> = ({ payment, onClose }) => {
  if (!payment) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="bg-white border border-neutral-200 rounded-2xl w-full max-w-md max-h-[95vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
              Cobro Exitoso · Ticket de Venta
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-600 hover:text-neutral-900 p-1 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Printable Ticket Preview */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex justify-center bg-neutral-50">
          <div
            id="printable-ticket"
            className="w-full max-w-[320px] bg-white text-neutral-900 p-5 rounded-md shadow-md text-xs font-mono select-text"
          >
            {/* Header info */}
            <div className="text-center pb-3 border-b border-dashed border-neutral-400">
              <h3 className="text-base font-bold tracking-tight text-neutral-950">
                RESTAURANTE EL ASADOR
              </h3>
              <p className="text-[10px] text-neutral-600">RFC: REA-220419-8K2</p>
              <p className="text-[10px] text-neutral-600">Av. Insurgentes Sur 1480, CDMX</p>
              <p className="text-[10px] text-neutral-600">Tel: (55) 5589-3200</p>
              <div className="mt-2 text-[11px] font-bold">
                TICKET DE VENTA: {payment.ticketNumber}
              </div>
            </div>

            {/* Account & Cashier info */}
            <div className="py-2.5 border-b border-dashed border-neutral-400 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>CUENTA:</span>
                <span className="font-bold">{payment.accountIdentifier}</span>
              </div>
              <div className="flex justify-between">
                <span>TIPO DE ORDEN:</span>
                <span className="font-bold">{payment.paraLlevar ? 'PARA LLEVAR' : 'COMER AQUÍ'}</span>
              </div>
              <div className="flex justify-between">
                <span>FECHA/HORA:</span>
                <span>{payment.paidAt}</span>
              </div>
              <div className="flex justify-between">
                <span>CAJERO:</span>
                <span>{payment.cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span>TURNO:</span>
                <span>{payment.turnoId}</span>
              </div>
            </div>

            {/* Items */}
            <div className="py-2.5 border-b border-dashed border-neutral-400">
              <div className="flex justify-between font-bold pb-1 text-[10px] uppercase">
                <span>Cant / Producto</span>
                <span>Importe</span>
              </div>
              <div className="space-y-1.5 pt-1">
                {payment.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start text-[11px]">
                    <div className="pr-2">
                      <div>
                        {item.quantity}x {item.productName}
                      </div>
                      {item.modifiers && item.modifiers.length > 0 && (
                        <div className="text-[9px] text-neutral-600 pl-3">
                          {item.modifiers.join(', ')}
                        </div>
                      )}
                    </div>
                    <span className="tabular-nums font-bold whitespace-nowrap">
                      ${item.totalPrice.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="py-2.5 border-b border-dashed border-neutral-400 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>Subtotal neto:</span>
                <span className="tabular-nums">${payment.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>IVA (16% Trasladado):</span>
                <span className="tabular-nums">${payment.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-1 border-t border-neutral-300">
                <span>TOTAL:</span>
                <span className="tabular-nums">${payment.total.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Method Breakdown */}
            <div className="py-2.5 border-b border-dashed border-neutral-400 space-y-1 text-[11px]">
              <div className="flex justify-between font-bold">
                <span>FORMA DE PAGO:</span>
                <span className="uppercase">{payment.method}</span>
              </div>

              {payment.breakdown.efectivo !== undefined && (
                <div className="flex justify-between text-neutral-700">
                  <span>Pago Efectivo:</span>
                  <span>${payment.breakdown.efectivo.toFixed(2)}</span>
                </div>
              )}
              {payment.cashReceived !== undefined && (
                <div className="flex justify-between text-neutral-700">
                  <span>Efectivo Entregado:</span>
                  <span>${payment.cashReceived.toFixed(2)}</span>
                </div>
              )}
              {payment.changeGiven !== undefined && payment.changeGiven > 0 && (
                <div className="flex justify-between text-neutral-700 font-bold">
                  <span>Cambio Entregado:</span>
                  <span>${payment.changeGiven.toFixed(2)}</span>
                </div>
              )}

              {payment.breakdown.tarjeta !== undefined && (
                <div className="flex justify-between text-neutral-700">
                  <span>Pago Tarjeta:</span>
                  <span>${payment.breakdown.tarjeta.toFixed(2)}</span>
                </div>
              )}
              {payment.cardReference && (
                <div className="flex justify-between text-[10px] text-neutral-600">
                  <span>Ref Tarjeta:</span>
                  <span>{payment.cardReference}</span>
                </div>
              )}

              {payment.breakdown.transferencia !== undefined && (
                <div className="flex justify-between text-neutral-700">
                  <span>Pago Transferencia:</span>
                  <span>${payment.breakdown.transferencia.toFixed(2)}</span>
                </div>
              )}
              {payment.transferReference && (
                <div className="flex justify-between text-[10px] text-neutral-600">
                  <span>Ref SPEI:</span>
                  <span>{payment.transferReference}</span>
                </div>
              )}
            </div>

            {/* Footer notice */}
            <div className="text-center pt-3 text-[10px] text-neutral-600 space-y-1">
              <p>Mesa liberada correctamente.</p>
              <p className="font-bold text-neutral-900">¡GRACIAS POR SU PREFERENCIA!</p>
              <p className="text-[9px] text-neutral-400 mt-2">www.elasador.com.mx</p>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-white border-t border-neutral-200 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
          >
            Listo / Cerrar
          </button>
          <button
            onClick={handlePrint}
            className="px-5 py-2.5 text-xs font-bold text-neutral-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-sm transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Ticket</span>
          </button>
        </div>
      </div>
    </div>
  );
};
