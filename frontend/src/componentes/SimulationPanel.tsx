import React, { useState } from 'react';
import { Account, Comanda } from '../types/pos';
import { posDataService } from '../services/dataService';
import {
  X,
  Sparkles,
  Tablet,
  ChefHat,
  BellRing,
  RotateCcw,
  Plus,
  Send,
  CheckCircle,
  Timer,
  AlertCircle,
  WifiOff,
  Wifi,
} from 'lucide-react';

interface SimulationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  comandas: Comanda[];
  onSelectAccount?: (account: Account) => void;
}

export const SimulationPanel: React.FC<SimulationPanelProps> = ({
  isOpen,
  onClose,
  accounts,
  comandas,
}) => {
  const [activeTab, setActiveTab] = useState<'quick' | 'tabletas' | 'cocina'>('quick');

  // Tablet form state
  const [newAccType, setNewAccType] = useState<'mesa' | 'nombre'>('mesa');
  const [newAccValue, setNewAccValue] = useState('Mesa 8');
  const tablets = posDataService.getTablets();
  const productos = posDataService.getProductos();
  const [selectedTablet, setSelectedTablet] = useState(tablets[0]?.name || '');
  const selectedWaiter = tablets.find((t) => t.name === selectedTablet)?.assignedWaiter || '';

  // Comanda form state
  const [targetAccountId, setTargetAccountId] = useState(accounts[0]?.id || '');
  const [selectedProductId, setSelectedProductId] = useState(productos[0]?.id ?? '');
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [itemNote, setItemNote] = useState('');

  const [feedback, setFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  };

  // Quick simulation actions
  const handleQuickAddAccountAndComanda = () => {
    try {
      const tablet = tablets[0];
      const product = productos[0];
      if (!tablet || !product) throw new Error('Se necesita al menos una tablet y un producto.');
      const mesaNum = Math.floor(10 + Math.random() * 20);
      const acc = posDataService.simulateIncomingAccount(
        'mesa',
        `Mesa ${mesaNum}`,
        tablet.name,
        tablet.assignedWaiter
      );
      posDataService.simulateNewComanda(
        acc.id,
        [{ itemId: product.id, quantity: 1 }],
        tablet.name,
        tablet.assignedWaiter
      );
      showFeedback(`✓ Creada Mesa ${mesaNum} con comanda inicial de ${product.name}.`);
    } catch (e: any) {
      showFeedback(`Error: ${e.message}`);
    }
  };

  const handleQuickAdvanceKitchen = () => {
    const pendingCmd = comandas.find((c) => c.status === 'nueva' || c.status === 'preparando');
    if (!pendingCmd) {
      showFeedback('No hay comandas pendientes para avanzar en cocina.');
      return;
    }
    if (pendingCmd.status === 'nueva') {
      posDataService.kitchenStartPreparing(pendingCmd.id);
      showFeedback(`✓ Cocina inició preparación de ${pendingCmd.orderNumber} (${pendingCmd.accountIdentifier}).`);
    } else if (pendingCmd.status === 'preparando') {
      posDataService.kitchenMarkReady(pendingCmd.id);
      showFeedback(
        `✓ ¡Orden ${pendingCmd.orderNumber} de ${pendingCmd.accountIdentifier} LISTA! Tablet ${pendingCmd.sentByTablet} recibió notificación.`
      );
    }
  };

  const handleQuickRequestBill = () => {
    const normalOpen = accounts.find((a) => a.status === 'abierta');
    if (!normalOpen) {
      showFeedback('No hay cuentas en estado abierta para solicitar cuenta.');
      return;
    }
    posDataService.simulateRequestBill(normalOpen.id);
    showFeedback(`✓ Mesero solicitó la cuenta en ${normalOpen.identifier}. Se destacó al frente en Caja.`);
  };

  const handleQuickToggleTablet = () => {
    const tablet = tablets[0];
    if (!tablet) return;

    const nextStatus = tablet.status === 'desconectada' ? 'conectada' : 'desconectada';
    posDataService.updateTabletStatus(tablet.id, nextStatus);
    showFeedback(
      nextStatus === 'conectada'
        ? `✓ ${tablet.name} (${tablet.assignedWaiter}) se reconectó a la red WiFi local.`
        : `⚠️ ${tablet.name} (${tablet.assignedWaiter}) perdió conexión con el servidor.`
    );
  };

  const handleManualOpenAccount = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const acc = posDataService.simulateIncomingAccount(
        newAccType,
        newAccValue,
        selectedTablet,
        selectedWaiter
      );
      showFeedback(`✓ Cuenta "${acc.identifier}" abierta desde ${selectedTablet}.`);
      setNewAccValue(newAccType === 'mesa' ? `Mesa ${Math.floor(12 + Math.random() * 20)}` : 'Sofía Castro');
    } catch (err: any) {
      showFeedback(`Error: ${err.message}`);
    }
  };

  const handleManualSendComanda = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAccountId) {
      showFeedback('Selecciona una cuenta de destino.');
      return;
    }
    try {
      const cmd = posDataService.simulateNewComanda(
        targetAccountId,
        [
          {
            itemId: selectedProductId,
            quantity: selectedQuantity,
            notes: itemNote || undefined,
          },
        ],
        selectedTablet,
        selectedWaiter
      );
      showFeedback(
        `✓ Comanda ${cmd.orderNumber} ${cmd.isAddition ? '(Adición)' : '(Inicial)'} enviada a Cocina para ${cmd.accountIdentifier}.`
      );
      setItemNote('');
    } catch (err: any) {
      showFeedback(`Error: ${err.message}`);
    }
  };

  const handleResetData = () => {
    if (window.confirm('¿Borrar todos los registros (cuentas, comandas, ventas y turnos)? El menú y las mesas se conservan.')) {
      posDataService.limpiarRegistros();
      showFeedback('✓ Registros borrados.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/30 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-md h-full bg-white border-l border-neutral-200 flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-4 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-600" />
            <div>
              <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
                Simulador de Red y Dispositivos
              </h2>
              <p className="text-[11px] text-neutral-600">
                Prueba el flujo entre las tablets, cocina y caja central
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-600 hover:text-neutral-900 p-1 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback message banner */}
        {feedback && (
          <div className="bg-amber-500/20 border-b border-amber-500/40 text-amber-700 text-xs px-4 py-2 flex items-center gap-2 animate-in fade-in">
            <CheckCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span className="font-medium">{feedback}</span>
          </div>
        )}

        {/* Segmented nav */}
        <div className="p-3 bg-white border-b border-neutral-200">
          <div className="grid grid-cols-3 gap-1 bg-neutral-50 p-1 rounded-lg border border-neutral-200">
            <button
              onClick={() => setActiveTab('quick')}
              className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                activeTab === 'quick'
                  ? 'bg-neutral-100 text-neutral-900 font-semibold'
                  : 'text-neutral-600 hover:text-neutral-800'
              }`}
            >
              1-Clic Rápido
            </button>
            <button
              onClick={() => setActiveTab('tabletas')}
              className={`py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                activeTab === 'tabletas'
                  ? 'bg-neutral-100 text-neutral-900 font-semibold'
                  : 'text-neutral-600 hover:text-neutral-800'
              }`}
            >
              <Tablet className="w-3.5 h-3.5" />
              <span>Tablets</span>
            </button>
            <button
              onClick={() => setActiveTab('cocina')}
              className={`py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                activeTab === 'cocina'
                  ? 'bg-neutral-100 text-neutral-900 font-semibold'
                  : 'text-neutral-600 hover:text-neutral-800'
              }`}
            >
              <ChefHat className="w-3.5 h-3.5" />
              <span>Cocina</span>
            </button>
          </div>
        </div>

        {/* Tab contents */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'quick' && (
            <div className="space-y-3">
              <div className="text-xs text-neutral-600">
                Dispara los eventos del ciclo de vida operativo con un solo clic:
              </div>

              {/* Action 1: Incoming Account from tablet */}
              <button
                onClick={handleQuickAddAccountAndComanda}
                className="w-full p-3 bg-neutral-50 border border-neutral-200 hover:border-amber-500/60 rounded-xl text-left transition-all group flex items-start gap-3 cursor-pointer"
              >
                <div className="p-2 bg-white rounded-lg text-amber-600 group-hover:scale-105 transition-transform">
                  <Tablet className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-neutral-900 group-hover:text-amber-600">
                    1. Tablet crea Mesa y envía comanda
                  </div>
                  <div className="text-[11px] text-neutral-600 mt-0.5">
                    Abre nueva mesa con ribeye y cervezas, reflejada al instante en Caja y Cocina.
                  </div>
                </div>
              </button>

              {/* Action 2: Kitchen advances status */}
              <button
                onClick={handleQuickAdvanceKitchen}
                className="w-full p-3 bg-neutral-50 border border-neutral-200 hover:border-amber-500/60 rounded-xl text-left transition-all group flex items-start gap-3 cursor-pointer"
              >
                <div className="p-2 bg-white rounded-lg text-emerald-600 group-hover:scale-105 transition-transform">
                  <ChefHat className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-neutral-900 group-hover:text-amber-600">
                    2. Cocina avanza estado (Nueva → Preparando → Lista)
                  </div>
                  <div className="text-[11px] text-neutral-600 mt-0.5">
                    Notifica en tiempo real a la tablet del mesero cuando la orden está lista.
                  </div>
                </div>
              </button>

              {/* Action 3: Waiter requests bill */}
              <button
                onClick={handleQuickRequestBill}
                className="w-full p-3 bg-neutral-50 border border-neutral-200 hover:border-amber-500/60 rounded-xl text-left transition-all group flex items-start gap-3 cursor-pointer"
              >
                <div className="p-2 bg-white rounded-lg text-amber-600 group-hover:scale-105 transition-transform">
                  <BellRing className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-neutral-900 group-hover:text-amber-600">
                    3. Mesero presiona "Solicitar cuenta"
                  </div>
                  <div className="text-[11px] text-neutral-600 mt-0.5">
                    Destaca la cuenta al frente en Caja Central con banner de solicitud.
                  </div>
                </div>
              </button>

              {/* Action 4: Toggle Tablet Disconnection */}
              <button
                onClick={handleQuickToggleTablet}
                className="w-full p-3 bg-neutral-50 border border-neutral-200 hover:border-rose-500/60 rounded-xl text-left transition-all group flex items-start gap-3 cursor-pointer"
              >
                <div className="p-2 bg-white rounded-lg text-rose-600 group-hover:scale-105 transition-transform">
                  <WifiOff className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-neutral-900 group-hover:text-amber-600">
                    4. Alternar Desconexión / Reconexión de {tablets[0]?.name ?? 'la tablet'}
                  </div>
                  <div className="text-[11px] text-neutral-600 mt-0.5">
                    Prueba el indicador rojo y la alerta de pérdida de conexión en el header.
                  </div>
                </div>
              </button>

              <div className="pt-3 border-t border-neutral-200">
                <button
                  onClick={handleResetData}
                  className="w-full py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 bg-neutral-50 border border-neutral-200 hover:bg-neutral-100 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Limpiar todos los registros</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'tabletas' && (
            <div className="space-y-5">
              {/* Form: Open Account */}
              <form onSubmit={handleManualOpenAccount} className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 space-y-3">
                <div className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-amber-600" />
                  <span>Crear Mesa / Abrir Cuenta desde Tablet</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewAccType('mesa');
                      setNewAccValue('Mesa 8');
                    }}
                    className={`py-1 text-xs font-medium rounded cursor-pointer ${
                      newAccType === 'mesa' ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-500'
                    }`}
                  >
                    Por Mesa
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewAccType('nombre');
                      setNewAccValue('Laura Gómez');
                    }}
                    className={`py-1 text-xs font-medium rounded cursor-pointer ${
                      newAccType === 'nombre' ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-500'
                    }`}
                  >
                    Por Nombre
                  </button>
                </div>

                <div>
                  <label className="text-[11px] text-neutral-600 block mb-1">
                    {newAccType === 'mesa' ? 'Número de Mesa:' : 'Nombre del Cliente:'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newAccValue}
                    onChange={(e) => setNewAccValue(e.target.value)}
                    className="w-full bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs text-neutral-900"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-neutral-600 block mb-1">Tablet Emisora:</label>
                  <select
                    value={selectedTablet}
                    onChange={(e) => setSelectedTablet(e.target.value)}
                    className="w-full bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs text-neutral-900"
                  >
                    {tablets.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name} ({t.assignedWaiter})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Abrir Cuenta en Caja Central
                </button>
              </form>

              {/* Form: Send Comanda */}
              <form onSubmit={handleManualSendComanda} className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 space-y-3">
                <div className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-sky-600" />
                  <span>Enviar Orden / Comanda de Adición</span>
                </div>

                <div>
                  <label className="text-[11px] text-neutral-600 block mb-1">Mesa / Cuenta Destino:</label>
                  <select
                    value={targetAccountId}
                    onChange={(e) => setTargetAccountId(e.target.value)}
                    className="w-full bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs text-neutral-900"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.identifier} (${a.total.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-[11px] text-neutral-600 block mb-1">Producto:</label>
                    <select
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      className="w-full bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs text-neutral-900"
                    >
                      {productos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (${p.price})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-neutral-600 block mb-1">Cant:</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={selectedQuantity}
                      onChange={(e) => setSelectedQuantity(parseInt(e.target.value) || 1)}
                      className="w-full bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs text-neutral-900 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-neutral-600 block mb-1">Modificadores / Nota:</label>
                  <input
                    type="text"
                    placeholder="Ej. Sin cebolla, término medio..."
                    value={itemNote}
                    onChange={(e) => setItemNote(e.target.value)}
                    className="w-full bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs text-neutral-900"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Enviar Orden a Cocina
                </button>
              </form>
            </div>
          )}

          {activeTab === 'cocina' && (
            <div className="space-y-3">
              <div className="text-xs text-neutral-600">
                Cambia el estado de las comandas desde esta ventana de prueba:
              </div>

              {comandas.map((cmd) => (
                <div
                  key={cmd.id}
                  className="bg-neutral-50 p-3 rounded-xl border border-neutral-200 space-y-2 text-xs"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-neutral-900">{cmd.accountIdentifier}</span>
                    <span className="font-mono text-[10px] text-neutral-600">{cmd.orderNumber}</span>
                  </div>

                  <div className="text-[11px] text-neutral-600">
                    {cmd.items.map((it) => `${it.quantity}x ${it.productName}`).join(', ')}
                  </div>

                  <div className="pt-2 border-t border-neutral-200 flex items-center justify-between gap-1 text-[11px]">
                    <button
                      onClick={() => posDataService.kitchenStartPreparing(cmd.id)}
                      className="px-2 py-1 rounded bg-amber-50 border border-amber-200 text-amber-700 font-medium hover:bg-amber-100 cursor-pointer"
                    >
                      Iniciar Preparación
                    </button>
                    <button
                      onClick={() => posDataService.kitchenMarkReady(cmd.id)}
                      className="px-2 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium hover:bg-emerald-100 cursor-pointer"
                    >
                      Marcar Lista
                    </button>
                    <button
                      onClick={() => posDataService.kitchenMarkDelivered(cmd.id)}
                      className="px-2 py-1 rounded bg-neutral-100 border border-neutral-300 text-neutral-700 hover:text-neutral-900 cursor-pointer"
                    >
                      Entregada
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
