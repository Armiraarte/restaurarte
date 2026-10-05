import React, { useState, useEffect } from 'react';
import { Account, PaymentBreakdown, PaymentMethod, PaymentRecord, Turno } from '../types/pos';
import { posDataService } from '../services/dataService';
import {
  X,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  PieChart,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  ShieldAlert,
} from 'lucide-react';

interface CobroModalProps {
  account: Account | null;
  currentTurno: Turno | null;
  onClose: () => void;
  onPaymentSuccess: (payment: PaymentRecord) => void;
  onOpenShiftRequired: () => void;
}

export const CobroModal: React.FC<CobroModalProps> = ({
  account,
  currentTurno,
  onClose,
  onPaymentSuccess,
  onOpenShiftRequired,
}) => {
  if (!account) return null;

  const total = account.total;

  const [method, setMethod] = useState<PaymentMethod>('efectivo');

  // Cash state
  const [cashReceivedInput, setCashReceivedInput] = useState<string>(total.toString());
  const cashReceivedNum = parseFloat(cashReceivedInput) || 0;
  const changeAmount = Math.max(0, cashReceivedNum - total);

  // Mixed payment state
  const [mixedCash, setMixedCash] = useState<string>('');
  const [mixedCard, setMixedCard] = useState<string>('');
  const [mixedTransfer, setMixedTransfer] = useState<string>('');

  // Card reference & Transfer reference
  const [cardRef, setCardRef] = useState<string>('');
  const [transferRef, setTransferRef] = useState<string>('');

  // Step state: 'select' | 'confirm' | 'processing'
  const [step, setStep] = useState<'select' | 'confirm'>('select');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset inputs when account changes
  useEffect(() => {
    setCashReceivedInput(total.toString());
    setMixedCash('');
    setMixedCard('');
    setMixedTransfer('');
    setStep('select');
    setErrorMessage(null);
  }, [account]);

  // Mixed calculation
  const mCash = parseFloat(mixedCash) || 0;
  const mCard = parseFloat(mixedCard) || 0;
  const mTransfer = parseFloat(mixedTransfer) || 0;
  const mixedSum = Math.round((mCash + mCard + mTransfer) * 100) / 100;
  const mixedDiff = Math.round((total - mixedSum) * 100) / 100;

  // Validate step 1
  const isFormValid = (): boolean => {
    if (method === 'efectivo') {
      return cashReceivedNum >= total;
    }
    if (method === 'tarjeta' || method === 'transferencia') {
      return true;
    }
    if (method === 'mixto') {
      return Math.abs(mixedDiff) < 0.01 && mixedSum > 0;
    }
    return false;
  };

  const handleProceedToConfirmation = () => {
    setErrorMessage(null);

    if (!currentTurno || currentTurno.status !== 'abierto') {
      setErrorMessage('Es obligatorio tener un turno de caja abierto para registrar cobros.');
      return;
    }

    if (!isFormValid()) {
      if (method === 'efectivo') {
        setErrorMessage('El efectivo recibido debe ser mayor o igual al total a pagar.');
      } else if (method === 'mixto') {
        setErrorMessage(`La suma de los métodos ($${mixedSum.toFixed(2)}) debe cubrir exactamente el total ($${total.toFixed(2)}).`);
      }
      return;
    }

    setStep('confirm');
  };

  const handleFinalizePayment = () => {
    setErrorMessage(null);

    try {
      let breakdown: PaymentBreakdown = {};
      let finalCashReceived: number | undefined = undefined;

      if (method === 'efectivo') {
        breakdown = { efectivo: total };
        finalCashReceived = cashReceivedNum;
      } else if (method === 'tarjeta') {
        breakdown = { tarjeta: total };
      } else if (method === 'transferencia') {
        breakdown = { transferencia: total };
      } else if (method === 'mixto') {
        breakdown = {
          efectivo: mCash > 0 ? mCash : undefined,
          tarjeta: mCard > 0 ? mCard : undefined,
          transferencia: mTransfer > 0 ? mTransfer : undefined,
        };
        if (mCash > 0) {
          finalCashReceived = mCash; // Exact in mixed portion
        }
      }

      // Backend-level transaction with concurrency check
      const paymentRecord = posDataService.processPayment(
        account.id,
        method,
        breakdown,
        finalCashReceived,
        cardRef || undefined,
        transferRef || undefined
      );

      // Successfully processed: Notify and hand over ticket
      onPaymentSuccess(paymentRecord);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al procesar el pago.');
      setStep('select');
    }
  };

  // Quick cash buttons
  const addCashAmount = (extra: number) => {
    const current = parseFloat(cashReceivedInput) || 0;
    setCashReceivedInput((current + extra).toString());
  };

  const setExactCash = () => {
    setCashReceivedInput(total.toString());
  };

  // If no turn is open, show blocker banner
  if (!currentTurno || currentTurno.status !== 'abierto') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
        <div className="bg-white border border-neutral-200 rounded-2xl w-full max-w-md p-6 text-center shadow-2xl">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-neutral-900 mb-2">Turno de Caja Requerido</h2>
          <p className="text-sm text-neutral-600 mb-6">
            El sistema de caja requiere un turno activo con cajero y fondo inicial antes de registrar cobros.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 bg-neutral-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                onClose();
                onOpenShiftRequired();
              }}
              className="px-4 py-2 text-sm font-bold text-neutral-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors cursor-pointer"
            >
              Abrir Turno Ahora
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="bg-white border border-neutral-200 rounded-2xl w-full max-w-xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
              <span>Cobrar Cuenta:</span>
              <span className="text-amber-600">{account.identifier}</span>
            </h2>
            <div className="text-xs text-neutral-600 flex items-center gap-2 mt-0.5">
              <span>Cajero: {currentTurno.cashierName}</span>
              <span>·</span>
              <span>Turno: {currentTurno.id}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-600 hover:text-neutral-900 p-1 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Total Banner - "Para evitar errores, muestra el total actualizado antes de confirmar el pago" */}
        <div className="bg-neutral-50 px-5 py-3 border-b border-neutral-200 flex items-center justify-between">
          <span className="text-xs font-medium text-neutral-600 uppercase tracking-wider">
            Total a Liquidar
          </span>
          <span className="text-2xl font-bold font-mono text-neutral-900 tabular-nums">
            ${total.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Error Alert if any */}
        {errorMessage && (
          <div className="mx-4 mt-3 p-3 rounded-lg bg-rose-50/60 border border-rose-200/80 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Content depending on step */}
        {step === 'select' ? (
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-5">
            {/* Method Tabs */}
            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-2">
                Método de Pago
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setMethod('efectivo')}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer ${
                    method === 'efectivo'
                      ? 'bg-amber-500/10 border-amber-500 text-amber-700 font-semibold ring-1 ring-amber-500/50'
                      : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:text-neutral-800 hover:border-neutral-300'
                  }`}
                >
                  <Banknote className="w-5 h-5" />
                  <span className="text-xs">Efectivo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod('tarjeta')}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer ${
                    method === 'tarjeta'
                      ? 'bg-amber-500/10 border-amber-500 text-amber-700 font-semibold ring-1 ring-amber-500/50'
                      : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:text-neutral-800 hover:border-neutral-300'
                  }`}
                >
                  <CreditCard className="w-5 h-5" />
                  <span className="text-xs">Tarjeta</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod('transferencia')}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer ${
                    method === 'transferencia'
                      ? 'bg-amber-500/10 border-amber-500 text-amber-700 font-semibold ring-1 ring-amber-500/50'
                      : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:text-neutral-800 hover:border-neutral-300'
                  }`}
                >
                  <ArrowRightLeft className="w-5 h-5" />
                  <span className="text-xs">Transferencia</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod('mixto')}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer ${
                    method === 'mixto'
                      ? 'bg-amber-500/10 border-amber-500 text-amber-700 font-semibold ring-1 ring-amber-500/50'
                      : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:text-neutral-800 hover:border-neutral-300'
                  }`}
                >
                  <PieChart className="w-5 h-5" />
                  <span className="text-xs">Pago Mixto</span>
                </button>
              </div>
            </div>

            {/* Method Specific Controls */}
            {method === 'efectivo' && (
              <div className="space-y-4 bg-neutral-50/60 border border-neutral-200 rounded-xl p-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                    Efectivo Recibido del Cliente ($)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-neutral-500 text-lg">
                      $
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={cashReceivedInput}
                      onChange={(e) => setCashReceivedInput(e.target.value)}
                      className="w-full bg-white border border-neutral-300 rounded-lg pl-8 pr-4 py-2.5 font-mono text-xl text-neutral-900 font-bold focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Quick denomination helper buttons */}
                <div>
                  <span className="text-[11px] text-neutral-500 block mb-1.5 font-medium">
                    Accesos rápidos de billetes:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={setExactCash}
                      className="px-2.5 py-1 text-xs font-medium bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded border border-neutral-300 cursor-pointer"
                    >
                      Exacto (${total.toFixed(2)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCashReceivedInput((Math.ceil(total / 50) * 50).toString())}
                      className="px-2.5 py-1 text-xs font-medium bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded border border-neutral-300 cursor-pointer"
                    >
                      Próx $50
                    </button>
                    <button
                      type="button"
                      onClick={() => setCashReceivedInput((Math.ceil(total / 100) * 100).toString())}
                      className="px-2.5 py-1 text-xs font-medium bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded border border-neutral-300 cursor-pointer"
                    >
                      Próx $100
                    </button>
                    <button
                      type="button"
                      onClick={() => setCashReceivedInput((Math.ceil(total / 500) * 500).toString())}
                      className="px-2.5 py-1 text-xs font-medium bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded border border-neutral-300 cursor-pointer"
                    >
                      Próx $500
                    </button>
                    <button
                      type="button"
                      onClick={() => addCashAmount(100)}
                      className="px-2.5 py-1 text-xs font-medium bg-neutral-100 hover:bg-neutral-100 text-amber-700 rounded border border-neutral-300 cursor-pointer"
                    >
                      +$100
                    </button>
                    <button
                      type="button"
                      onClick={() => addCashAmount(200)}
                      className="px-2.5 py-1 text-xs font-medium bg-neutral-100 hover:bg-neutral-100 text-amber-700 rounded border border-neutral-300 cursor-pointer"
                    >
                      +$200
                    </button>
                    <button
                      type="button"
                      onClick={() => addCashAmount(500)}
                      className="px-2.5 py-1 text-xs font-medium bg-neutral-100 hover:bg-neutral-100 text-amber-700 rounded border border-neutral-300 cursor-pointer"
                    >
                      +$500
                    </button>
                  </div>
                </div>

                {/* Change calculation */}
                <div className="pt-3 border-t border-neutral-200 flex items-center justify-between">
                  <span className="text-sm font-semibold text-neutral-700">
                    Cambio a Entregar:
                  </span>
                  <span
                    className={`text-xl font-bold font-mono tabular-nums ${
                      cashReceivedNum >= total ? 'text-emerald-600' : 'text-neutral-500'
                    }`}
                  >
                    ${changeAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {method === 'tarjeta' && (
              <div className="space-y-4 bg-neutral-50/60 border border-neutral-200 rounded-xl p-4">
                <div className="text-xs text-neutral-600">
                  El cliente pagará el total íntegro de <strong>${total.toFixed(2)}</strong> con tarjeta física o digital en terminal bancaria.
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">
                    Número de Autorización / Referencia Terminal (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. AUT-89240"
                    value={cardRef}
                    onChange={(e) => setCardRef(e.target.value)}
                    className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-sm text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            )}

            {method === 'transferencia' && (
              <div className="space-y-4 bg-neutral-50/60 border border-neutral-200 rounded-xl p-4">
                <div className="text-xs text-neutral-600">
                  El cliente transferirá <strong>${total.toFixed(2)}</strong> vía SPEI / Código QR.
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">
                    Clave de Rastreo o Referencia SPEI (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. 128492049"
                    value={transferRef}
                    onChange={(e) => setTransferRef(e.target.value)}
                    className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-sm text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            )}

            {method === 'mixto' && (
              <div className="space-y-4 bg-neutral-50/60 border border-neutral-200 rounded-xl p-4">
                <div className="text-xs text-neutral-600">
                  Ingresa el importe a cubrir con cada forma de pago. La suma debe igualar el total de la cuenta.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1 flex items-center gap-1">
                      <Banknote className="w-3.5 h-3.5 text-neutral-600" />
                      <span>Efectivo ($)</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      value={mixedCash}
                      onChange={(e) => setMixedCash(e.target.value)}
                      className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 font-mono text-sm text-neutral-900 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1 flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5 text-neutral-600" />
                      <span>Tarjeta ($)</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      value={mixedCard}
                      onChange={(e) => setMixedCard(e.target.value)}
                      className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 font-mono text-sm text-neutral-900 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1 flex items-center gap-1">
                      <ArrowRightLeft className="w-3.5 h-3.5 text-neutral-600" />
                      <span>Transferencia ($)</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      value={mixedTransfer}
                      onChange={(e) => setMixedTransfer(e.target.value)}
                      className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 font-mono text-sm text-neutral-900 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Mixed reconciliation balance */}
                <div className="pt-3 border-t border-neutral-200 space-y-1.5 text-xs">
                  <div className="flex justify-between text-neutral-600">
                    <span>Suma registrada:</span>
                    <span className="font-mono tabular-nums text-neutral-900 font-semibold">
                      ${mixedSum.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Diferencia pendiente:</span>
                    <span
                      className={`font-mono tabular-nums font-bold ${
                        Math.abs(mixedDiff) < 0.01
                          ? 'text-emerald-600'
                          : mixedDiff > 0
                          ? 'text-amber-600'
                          : 'text-rose-600'
                      }`}
                    >
                      {Math.abs(mixedDiff) < 0.01
                        ? 'Cubierto Exacto ✓'
                        : mixedDiff > 0
                        ? `Falta: $${mixedDiff.toFixed(2)}`
                        : `Sobra: $${Math.abs(mixedDiff).toFixed(2)}`}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Step 2: Confirmation step required: "Antes de finalizar, muestra una confirmación con la mesa o nombre, total y desglose de pago." */
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
            <div className="bg-amber-50/40 border border-amber-500/30 rounded-xl p-4">
              <h3 className="text-sm font-bold text-amber-700 mb-1 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-600" />
                <span>Confirmación de Cobro</span>
              </h3>
              <p className="text-xs text-amber-800/80">
                Verifica los datos antes de emitir el ticket. Esta acción liberará la mesa y cerrará la cuenta de forma irreversible.
              </p>
            </div>

            <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-4 space-y-3">
              <div className="flex justify-between text-xs text-neutral-600">
                <span>Cuenta:</span>
                <span className="font-bold text-neutral-900 text-sm">{account.identifier}</span>
              </div>
              <div className="flex justify-between text-xs text-neutral-600">
                <span>Cajero responsable:</span>
                <span className="text-neutral-800">{currentTurno.cashierName}</span>
              </div>
              <div className="flex justify-between text-xs text-neutral-600">
                <span>Turno asociado:</span>
                <span className="font-mono text-neutral-800">{currentTurno.id}</span>
              </div>

              <div className="border-t border-neutral-200 pt-3 space-y-1.5">
                <span className="text-xs font-semibold text-neutral-600 uppercase tracking-wider block">
                  Desglose del Pago
                </span>

                {method === 'efectivo' && (
                  <>
                    <div className="flex justify-between text-xs text-neutral-700">
                      <span>Método:</span>
                      <span className="font-medium text-neutral-900">Efectivo</span>
                    </div>
                    <div className="flex justify-between text-xs text-neutral-600">
                      <span>Efectivo entregado por cliente:</span>
                      <span className="font-mono tabular-nums text-neutral-900">
                        ${cashReceivedNum.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-emerald-600 font-medium">
                      <span>Cambio devuelto:</span>
                      <span className="font-mono tabular-nums">${changeAmount.toFixed(2)}</span>
                    </div>
                  </>
                )}

                {method === 'tarjeta' && (
                  <div className="flex justify-between text-xs text-neutral-700">
                    <span>Método:</span>
                    <span className="font-medium text-neutral-900">Tarjeta bancaria (${total.toFixed(2)})</span>
                  </div>
                )}

                {method === 'transferencia' && (
                  <div className="flex justify-between text-xs text-neutral-700">
                    <span>Método:</span>
                    <span className="font-medium text-neutral-900">Transferencia electrónica (${total.toFixed(2)})</span>
                  </div>
                )}

                {method === 'mixto' && (
                  <div className="space-y-1 text-xs">
                    <span className="text-neutral-600">Distribución de pago mixto:</span>
                    {mCash > 0 && (
                      <div className="flex justify-between text-neutral-700 pl-2">
                        <span>• Efectivo:</span>
                        <span className="font-mono text-neutral-900">${mCash.toFixed(2)}</span>
                      </div>
                    )}
                    {mCard > 0 && (
                      <div className="flex justify-between text-neutral-700 pl-2">
                        <span>• Tarjeta:</span>
                        <span className="font-mono text-neutral-900">${mCard.toFixed(2)}</span>
                      </div>
                    )}
                    {mTransfer > 0 && (
                      <div className="flex justify-between text-neutral-700 pl-2">
                        <span>• Transferencia:</span>
                        <span className="font-mono text-neutral-900">${mTransfer.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="border-t border-neutral-200 pt-3 flex justify-between items-baseline">
                <span className="text-sm font-bold text-neutral-900">Total Cobrado:</span>
                <span className="text-2xl font-bold font-mono text-amber-600 tabular-nums">
                  ${total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between gap-3">
          {step === 'select' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleProceedToConfirmation}
                disabled={!isFormValid()}
                className="px-5 py-2.5 text-sm font-bold text-neutral-950 bg-amber-500 hover:bg-amber-400 active:scale-95 disabled:opacity-40 disabled:pointer-events-none rounded-lg shadow-sm transition-all cursor-pointer"
              >
                Revisar Confirmación
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep('select')}
                className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-100 transition-colors"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleFinalizePayment}
                className="px-6 py-2.5 text-sm font-bold text-neutral-950 bg-emerald-500 hover:bg-emerald-400 active:scale-95 rounded-lg shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmar y Finalizar Cobro</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
