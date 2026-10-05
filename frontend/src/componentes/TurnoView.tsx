import React, { useState } from 'react';
import { Turno, PaymentRecord } from '../types/pos';
import { posDataService } from '../services/dataService';
import {
  Clock,
  User,
  Banknote,
  CreditCard,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  FileText,
  Lock,
  History,
  ShieldCheck,
  Receipt,
  PlusCircle,
} from 'lucide-react';

interface TurnoViewProps {
  currentTurno: Turno | null;
  turnosHistory: Turno[];
  onOpenPaymentTicket: (payment: PaymentRecord) => void;
}

export const TurnoView: React.FC<TurnoViewProps> = ({
  currentTurno,
  turnosHistory,
  onOpenPaymentTicket,
}) => {
  // Opening turn form state
  const [cashierNameInput, setCashierNameInput] = useState('');
  const [initialCashInput, setInitialCashInput] = useState('2000');
  const [openError, setOpenError] = useState<string | null>(null);

  // Closing turn modal state
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [countedCashInput, setCountedCashInput] = useState('');
  const [observationInput, setObservationInput] = useState('');
  const [closeError, setCloseError] = useState<string | null>(null);

  // Tab: Current vs History
  const [activeTab, setActiveTab] = useState<'activo' | 'historial'>('activo');

  const handleOpenTurnoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOpenError(null);

    if (!cashierNameInput.trim()) {
      setOpenError('Por favor ingresa el nombre del cajero responsable.');
      return;
    }

    const initCash = parseFloat(initialCashInput);
    if (isNaN(initCash) || initCash < 0) {
      setOpenError('El fondo inicial de efectivo debe ser un número válido igual o mayor a cero.');
      return;
    }

    try {
      posDataService.openTurno(cashierNameInput, initCash);
      setCashierNameInput('');
      setInitialCashInput('2000');
    } catch (err: any) {
      setOpenError(err.message || 'Error al abrir el turno');
    }
  };

  const handleOpenClosingModal = () => {
    if (!currentTurno) return;
    setCountedCashInput(currentTurno.expectedCash.toString());
    setObservationInput('');
    setCloseError(null);
    setIsClosingModalOpen(true);
  };

  const handleCloseTurnoConfirm = () => {
    if (!currentTurno) return;
    setCloseError(null);

    const counted = parseFloat(countedCashInput);
    if (isNaN(counted) || counted < 0) {
      setCloseError('Por favor ingresa la cantidad de efectivo físico contado en caja.');
      return;
    }

    const diff = counted - currentTurno.expectedCash;
    if (Math.abs(diff) > 0.01 && !observationInput.trim()) {
      setCloseError('Existe una diferencia entre el efectivo esperado y el contado. Agrega una observación explicando el motivo.');
      return;
    }

    try {
      posDataService.closeTurno(counted, observationInput);
      setIsClosingModalOpen(false);
    } catch (err: any) {
      setCloseError(err.message || 'Error al cerrar el turno');
    }
  };

  const countedNum = parseFloat(countedCashInput) || 0;
  const expectedNum = currentTurno ? currentTurno.expectedCash : 0;
  const liveDiff = Math.round((countedNum - expectedNum) * 100) / 100;

  return (
    <div className="space-y-6">
      {/* Sub tabs if history exists */}
      <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            <span>Control de Turnos de Caja</span>
          </h2>
          <p className="text-xs text-neutral-600 mt-0.5">
            Supervisión del arqueo de caja, fondos iniciales, cobros por método y corte de turno.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-white border border-neutral-200 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('activo')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'activo'
                ? 'bg-neutral-100 text-neutral-900 font-semibold'
                : 'text-neutral-600 hover:text-neutral-800'
            }`}
          >
            Turno Actual
          </button>
          <button
            onClick={() => setActiveTab('historial')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'historial'
                ? 'bg-neutral-100 text-neutral-900 font-semibold'
                : 'text-neutral-600 hover:text-neutral-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Historial ({turnosHistory.length})</span>
          </button>
        </div>
      </div>

      {activeTab === 'historial' ? (
        /* History View */
        <div className="space-y-4">
          {turnosHistory.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-xl p-10 text-center max-w-md mx-auto">
              <History className="w-8 h-8 text-neutral-500 mx-auto mb-2" />
              <div className="text-sm font-semibold text-neutral-700">Sin turnos archivados</div>
              <div className="text-xs text-neutral-500 mt-1">
                Los turnos cerrados aparecerán aquí para auditoría y consulta histórica.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {turnosHistory.map((t) => (
                <div
                  key={t.id}
                  className="bg-white border border-neutral-200 rounded-xl p-5 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-base font-bold text-neutral-900">{t.id}</div>
                      <div className="text-xs text-neutral-600">Cajero: {t.cashierName}</div>
                    </div>
                    <span className="text-xs font-semibold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded">
                      Cerrado
                    </span>
                  </div>

                  <div className="text-xs text-neutral-600 grid grid-cols-2 gap-2 bg-neutral-50/60 p-2.5 rounded-lg border border-neutral-200">
                    <div>Apertura: {t.openedAt}</div>
                    <div>Cierre: {t.closedAt}</div>
                    <div>Fondo inicial: ${t.initialCash.toFixed(2)}</div>
                    <div>Cuentas cobradas: {t.salesCount}</div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-neutral-50 p-2 rounded border border-neutral-200">
                      <span className="text-neutral-500 block text-[10px]">Total Ventas</span>
                      <span className="font-mono font-bold text-neutral-900">${t.totalSales.toFixed(2)}</span>
                    </div>
                    <div className="bg-neutral-50 p-2 rounded border border-neutral-200">
                      <span className="text-neutral-500 block text-[10px]">Efectivo Esperado</span>
                      <span className="font-mono font-bold text-neutral-700">
                        ${t.expectedCash.toFixed(2)}
                      </span>
                    </div>
                    <div className="bg-neutral-50 p-2 rounded border border-neutral-200">
                      <span className="text-neutral-500 block text-[10px]">Efectivo Contado</span>
                      <span className="font-mono font-bold text-amber-600">
                        ${(t.countedCash ?? 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {t.difference !== undefined && (
                    <div
                      className={`text-xs p-2 rounded flex justify-between font-mono ${
                        Math.abs(t.difference) < 0.01
                          ? 'bg-emerald-50/40 text-emerald-700 border border-emerald-200/40'
                          : t.difference > 0
                          ? 'bg-amber-50/40 text-amber-700 border border-amber-200/40'
                          : 'bg-rose-50/40 text-rose-700 border border-rose-200/40'
                      }`}
                    >
                      <span>
                        Diferencia en arqueo:{' '}
                        {Math.abs(t.difference) < 0.01
                          ? 'Exacto (Sin descuadre)'
                          : t.difference > 0
                          ? `Sobrante de $${t.difference.toFixed(2)}`
                          : `Faltante de $${Math.abs(t.difference).toFixed(2)}`}
                      </span>
                    </div>
                  )}

                  {t.closingObservation && (
                    <div className="text-xs text-neutral-600 italic bg-neutral-50 p-2 rounded border border-neutral-200">
                      Nota de cierre: "{t.closingObservation}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : currentTurno && currentTurno.status === 'abierto' ? (
        /* Active Shift Dashboard - Simple summary as required:
           - Total cobrado en efectivo.
           - Total cobrado con tarjeta.
           - Total cobrado por transferencia.
           - Total de ventas.
           - Número de cuentas cobradas.
           - Efectivo esperado en caja: fondo inicial más cobros en efectivo, menos el cambio entregado.
           - Distribución de pagos mixtos sin duplicar.
        */
        <div className="space-y-6">
          {/* Active Turn Header banner */}
          <div className="bg-white border border-neutral-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                  Turno de Caja Abierto
                </span>
                <span className="font-mono text-xs text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded">
                  {currentTurno.id}
                </span>
              </div>
              <h3 className="text-lg font-bold text-neutral-900">{currentTurno.cashierName}</h3>
              <div className="flex items-center gap-3 text-xs text-neutral-600 mt-1">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-neutral-500" />
                  Apertura: {currentTurno.openedAt}
                </span>
                <span>·</span>
                <span>Fondo inicial: ${currentTurno.initialCash.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handleOpenClosingModal}
              className="px-5 py-2.5 text-xs font-bold text-neutral-900 bg-rose-100/80 hover:bg-rose-200 border border-rose-300/80 rounded-lg shadow-sm transition-all flex items-center gap-2 cursor-pointer self-start md:self-center"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Cerrar Turno de Caja</span>
            </button>
          </div>

          {/* Simple Metric Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Total Sales */}
            <div className="bg-white border border-neutral-200 rounded-xl p-4">
              <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider block mb-1">
                Ventas Totales
              </span>
              <span className="text-xl font-bold font-mono text-neutral-900 tabular-nums block">
                ${currentTurno.totalSales.toFixed(2)}
              </span>
              <span className="text-[11px] text-neutral-600 mt-1 block">
                {currentTurno.salesCount} {currentTurno.salesCount === 1 ? 'cuenta cobrada' : 'cuentas cobradas'}
              </span>
            </div>

            {/* Efectivo Cobrado */}
            <div className="bg-white border border-neutral-200 rounded-xl p-4">
              <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <Banknote className="w-3 h-3 text-emerald-600" />
                <span>Cobros Efectivo</span>
              </span>
              <span className="text-xl font-bold font-mono text-neutral-900 tabular-nums block">
                ${currentTurno.totalCashCollected.toFixed(2)}
              </span>
              <span className="text-[11px] text-neutral-600 mt-1 block">Neto recibido</span>
            </div>

            {/* Tarjeta Cobrada */}
            <div className="bg-white border border-neutral-200 rounded-xl p-4">
              <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <CreditCard className="w-3 h-3 text-sky-600" />
                <span>Cobros Tarjeta</span>
              </span>
              <span className="text-xl font-bold font-mono text-neutral-900 tabular-nums block">
                ${currentTurno.totalCardCollected.toFixed(2)}
              </span>
              <span className="text-[11px] text-neutral-600 mt-1 block">En terminales</span>
            </div>

            {/* Transferencia Cobrada */}
            <div className="bg-white border border-neutral-200 rounded-xl p-4">
              <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <ArrowRightLeft className="w-3 h-3 text-purple-600" />
                <span>Transferencias</span>
              </span>
              <span className="text-xl font-bold font-mono text-neutral-900 tabular-nums block">
                ${currentTurno.totalTransferCollected.toFixed(2)}
              </span>
              <span className="text-[11px] text-neutral-600 mt-1 block">SPEI / Banco</span>
            </div>

            {/* Fondo Inicial */}
            <div className="bg-white border border-neutral-200 rounded-xl p-4">
              <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider block mb-1">
                Fondo Inicial
              </span>
              <span className="text-xl font-bold font-mono text-neutral-800 tabular-nums block">
                ${currentTurno.initialCash.toFixed(2)}
              </span>
              <span className="text-[11px] text-neutral-600 mt-1 block">Caja chica</span>
            </div>

            {/* Efectivo Esperado en Caja */}
            <div className="bg-white border border-amber-500/50 rounded-xl p-4 ring-1 ring-amber-500/30">
              <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider block mb-1">
                Efectivo Esperado
              </span>
              <span className="text-xl font-bold font-mono text-amber-600 tabular-nums block">
                ${currentTurno.expectedCash.toFixed(2)}
              </span>
              <span className="text-[10px] text-neutral-600 mt-1 block">
                Fondo + Efectivo neto
              </span>
            </div>
          </div>

          {/* List of Payments in this Shift */}
          <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-neutral-900">
                  Cuentas Cobradas en Este Turno ({currentTurno.payments.length})
                </h4>
                <p className="text-xs text-neutral-600">
                  Cada venta registrada distribuye sus importes en su método de cobro respectivo.
                </p>
              </div>
            </div>

            {currentTurno.payments.length === 0 ? (
              <div className="text-center py-8 text-neutral-500 text-xs">
                Aún no has cobrado cuentas en este turno. Las cuentas liquidadas se registrarán aquí con su ticket.
              </div>
            ) : (
              <div className="divide-y divide-neutral-200">
                {currentTurno.payments.map((p) => (
                  <div
                    key={p.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-neutral-100/40 px-2 rounded-lg transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-neutral-900 text-sm">{p.accountIdentifier}</span>
                        <span className="font-mono text-xs text-amber-600 bg-neutral-100 px-1.5 rounded">
                          {p.ticketNumber}
                        </span>
                        <span className="text-xs text-neutral-600 capitalize">
                          · {p.method}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-600 mt-0.5">
                        Hora: {p.paidAt} · {p.items.length} productos
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <span className="font-mono font-bold text-sm text-neutral-900 tabular-nums">
                        ${p.total.toFixed(2)}
                      </span>
                      <button
                        onClick={() => onOpenPaymentTicket(p)}
                        className="px-2.5 py-1 text-xs font-medium text-neutral-700 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded border border-neutral-300 flex items-center gap-1.5 cursor-pointer"
                        title="Ver ticket de venta"
                      >
                        <Receipt className="w-3.5 h-3.5 text-neutral-600" />
                        <span>Ticket</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* No shift is currently open: Form to Open Shift */
        <div className="max-w-lg mx-auto bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center mx-auto mb-3">
              <Lock className="w-6 h-6 text-amber-600" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900">Abrir Nuevo Turno de Caja</h3>
            <p className="text-xs text-neutral-600 mt-1">
              Es necesario registrar la apertura para comenzar a cobrar cuentas y registrar ingresos.
            </p>
          </div>

          {openError && (
            <div className="p-3 rounded-lg bg-rose-50/60 border border-rose-200/80 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{openError}</span>
            </div>
          )}

          <form onSubmit={handleOpenTurnoSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1.5">
                Cajero Responsable
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Sebastián Martínez"
                value={cashierNameInput}
                onChange={(e) => setCashierNameInput(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-300 rounded-lg px-3.5 py-2.5 text-sm text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1.5">
                Fondo Inicial de Efectivo en Caja ($)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-neutral-500">
                  $
                </span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  placeholder="2000.00"
                  value={initialCashInput}
                  onChange={(e) => setInitialCashInput(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-lg pl-8 pr-4 py-2.5 font-mono text-sm text-neutral-900 focus:outline-none focus:border-amber-500"
                />
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">
                Monto en monedas y billetes entregado al inicio para dar cambio.
              </p>
            </div>

            <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200 text-xs text-neutral-600 flex items-center gap-2">
              <Clock className="w-4 h-4 text-neutral-500 shrink-0" />
              <span>
                Fecha y hora de inicio: <strong>Automáticas al confirmar</strong>
              </span>
            </div>

            <button
              type="submit"
              className="w-full py-3 text-sm font-bold text-neutral-950 bg-amber-500 hover:bg-amber-400 active:scale-98 rounded-lg shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Abrir Turno de Caja</span>
            </button>
          </form>
        </div>
      )}

      {/* Modal for Closing Turn */}
      {isClosingModalOpen && currentTurno && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="bg-white border border-neutral-200 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-rose-500" />
                  <span>Corte y Cierre de Turno</span>
                </h3>
                <p className="text-xs text-neutral-600">
                  Arqueo final de efectivo y validación de diferencias.
                </p>
              </div>
            </div>

            {closeError && (
              <div className="p-3 rounded-lg bg-rose-50/60 border border-rose-200/80 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{closeError}</span>
              </div>
            )}

            {/* Expected vs Counted summary */}
            <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 space-y-3">
              <div className="flex justify-between text-xs text-neutral-600">
                <span>Cajero responsable:</span>
                <span className="font-semibold text-neutral-900">{currentTurno.cashierName}</span>
              </div>
              <div className="flex justify-between text-xs text-neutral-600">
                <span>Fondo inicial:</span>
                <span className="font-mono text-neutral-800">${currentTurno.initialCash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-neutral-600">
                <span>Cobros en efectivo recibidos:</span>
                <span className="font-mono text-neutral-800">
                  +${currentTurno.totalCashCollected.toFixed(2)}
                </span>
              </div>

              <div className="pt-2 border-t border-neutral-200 flex justify-between items-baseline">
                <span className="text-sm font-semibold text-neutral-800">Efectivo Esperado en Caja:</span>
                <span className="text-lg font-bold font-mono text-neutral-900 tabular-nums">
                  ${expectedNum.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Step 1: Physical cash counted */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                1. Efectivo Contado Físicamente en Caja ($)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-neutral-500 text-lg">
                  $
                </span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  placeholder="0.00"
                  value={countedCashInput}
                  onChange={(e) => setCountedCashInput(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-lg pl-8 pr-4 py-2.5 font-mono text-lg font-bold text-neutral-900 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Step 2: Show difference calculation */}
            <div
              className={`p-3 rounded-xl border text-xs flex justify-between items-center ${
                Math.abs(liveDiff) < 0.01
                  ? 'bg-emerald-50/40 border-emerald-200/60 text-emerald-700'
                  : liveDiff > 0
                  ? 'bg-amber-50/40 border-amber-200/60 text-amber-700'
                  : 'bg-rose-50/40 border-rose-200/60 text-rose-700'
              }`}
            >
              <span className="font-medium">Resultado del Arqueo:</span>
              <span className="font-mono font-bold text-sm tabular-nums">
                {Math.abs(liveDiff) < 0.01
                  ? 'Exacto (Diferencia: $0.00)'
                  : liveDiff > 0
                  ? `Sobrante: +$${liveDiff.toFixed(2)}`
                  : `Faltante: -$${Math.abs(liveDiff).toFixed(2)}`}
              </span>
            </div>

            {/* Step 3: Observation if difference exists */}
            {Math.abs(liveDiff) > 0.01 && (
              <div>
                <label className="block text-xs font-semibold text-amber-700 mb-1.5">
                  3. Observación obligatoria por diferencia en caja
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Describe la razón del sobrante o faltante..."
                  value={observationInput}
                  onChange={(e) => setObservationInput(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-lg p-2.5 text-xs text-neutral-900 placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            )}

            {/* Step 4: Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-200">
              <button
                type="button"
                onClick={() => setIsClosingModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCloseTurnoConfirm}
                className="px-5 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 active:scale-95 rounded-lg shadow-sm transition-all cursor-pointer"
              >
                Confirmar y Cerrar Turno
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
