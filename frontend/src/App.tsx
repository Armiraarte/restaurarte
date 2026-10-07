/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Account, Comanda, Mesa, PaymentRecord, ProductCatalogItem, SocketEventLog, TabletDevice, Turno } from './types/pos';
import { cuentaDeMesa, posDataService } from './services/dataService';
import { Header } from './componentes/Header';
import { SeccionesNav, MainNavTab } from './componentes/SeccionesNav';
import { ComandasView } from './componentes/ComandasView';
import { AccountsView } from './componentes/AccountsView';
import { AccountDetailModal } from './componentes/AccountDetailModal';
import { CobroModal } from './componentes/CobroModal';
import { SalesTicketModal } from './componentes/SalesTicketModal';
import { KitchenKdsView } from './componentes/KitchenKdsView';
import { TabletsView } from './componentes/TabletsView';
import { SimulationPanel } from './componentes/SimulationPanel';
import { LoginView } from './componentes/LoginView';
import { MesasView } from './componentes/MesasView';
import { ConfiguracionView } from './componentes/ConfiguracionView';
import { InicioView } from './componentes/InicioView';
import { logout, obtenerSesion, Usuario } from './services/authService';

export default function App() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [verificandoSesion, setVerificandoSesion] = useState(true);

  useEffect(() => {
    obtenerSesion()
      .then(setUsuario)
      .catch(() => setUsuario(null))
      .finally(() => setVerificandoSesion(false));
  }, []);

  const handleLogout = () => {
    logout();
    setUsuario(null);
  };

  if (verificandoSesion) {
    return <div className="min-h-screen bg-neutral-100" />;
  }

  if (!usuario) {
    return <LoginView onLoginSuccess={setUsuario} />;
  }

  // Las cuentas de tipo tablet no usan la caja: van a la app de meseros.
  if (usuario.rol === 'tablet') {
    window.location.replace('/tablet');
    return <div className="min-h-screen bg-neutral-100" />;
  }

  return <PosDashboard usuario={usuario} onLogout={handleLogout} />;
}

function PosDashboard({ usuario, onLogout }: { usuario: Usuario; onLogout: () => void }) {
  const [currentTab, setCurrentTab] = useState<MainNavTab>('inicio');
  // Módulo de configuración (solo admin): se muestra en lugar de la sección actual.
  const [enConfiguracion, setEnConfiguracion] = useState(false);
  const verConfiguracion = enConfiguracion && usuario.rol === 'admin';

  const irASeccion = (tab: MainNavTab) => {
    setEnConfiguracion(false);
    setCurrentTab(tab);
  };

  // Core state synced with reactive posDataService
  const [openAccounts, setOpenAccounts] = useState<Account[]>([]);
  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [tablets, setTablets] = useState<TabletDevice[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [productos, setProductos] = useState<ProductCatalogItem[]>([]);
  const [currentTurno, setCurrentTurno] = useState<Turno | null>(null);
  const [recentEvents, setRecentEvents] = useState<SocketEventLog[]>([]);

  // Modals state
  const [detailAccount, setDetailAccount] = useState<Account | null>(null);
  const [cobroAccount, setCobroAccount] = useState<Account | null>(null);
  const [activeTicket, setActiveTicket] = useState<PaymentRecord | null>(null);
  const [isSimuladorOpen, setIsSimuladorOpen] = useState(false);

  // Sync with shared central data service
  useEffect(() => {
    const updateLocalState = () => {
      setOpenAccounts(posDataService.getOpenAccounts());
      setComandas(posDataService.getComandas());
      setTablets(posDataService.getTablets());
      setMesas(posDataService.getMesas());
      setProductos(posDataService.getProductos());
      setCurrentTurno(posDataService.getCurrentTurno());
      setRecentEvents(posDataService.getRecentEvents());

      // If active account in detail was updated/paid, update reference
      setDetailAccount((prev) => (prev ? posDataService.getAccountById(prev.id) || null : null));
    };

    updateLocalState();
    const unsubscribeState = posDataService.subscribe(updateLocalState);
    const unsubscribeEvents = posDataService.subscribeEvents(() => {
      setRecentEvents(posDataService.getRecentEvents());
    });

    return () => {
      unsubscribeState();
      unsubscribeEvents();
    };
  }, []);

  const solicitadasCount = openAccounts.filter((a) => a.status === 'cuenta_solicitada').length;
  const mesasOcupadas = mesas.filter((m) => cuentaDeMesa(m, openAccounts)).length;
  const nuevasComandasCount = comandas.filter((c) => c.status === 'nueva').length;
  const cocinaActiveCount = comandas.filter((c) => c.status === 'nueva' || c.status === 'preparando').length;

  const handleSelectAccount = (account: Account) => {
    setDetailAccount(account);
  };

  const handleInitiateCobro = (account: Account) => {
    setDetailAccount(null);
    setCobroAccount(account);
  };

  const handlePaymentSuccess = (payment: PaymentRecord) => {
    setCobroAccount(null);
    setActiveTicket(payment);
  };

  // Sin vista de turno por ahora: el cobro requiere un turno abierto (el de ejemplo ya lo está).
  const handleOpenShiftRequired = () => {
    setCobroAccount(null);
  };

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 flex flex-col font-sans selection:bg-amber-500 selection:text-neutral-950">
      {/* 1. Navbar: logo y usuario */}
      <Header
        usuario={usuario}
        onLogout={onLogout}
        onOpenConfig={() => setEnConfiguracion((v) => !v)}
        configActiva={verConfiguracion}
      />

      {/* Secciones: INICIO | COCINA | TABLET | CAJAS | MESAS | COMANDAS */}
      <SeccionesNav
        currentTab={currentTab}
        onTabChange={irASeccion}
        cocinaActiveCount={cocinaActiveCount}
        hasDisconnectedTablet={tablets.some((t) => t.status === 'desconectada')}
        openAccountsCount={openAccounts.length}
        solicitadasCount={solicitadasCount}
        mesasOcupadas={mesasOcupadas}
        mesasTotal={mesas.length}
        nuevasComandasCount={nuevasComandasCount}
      />

      {/* 2. Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {verConfiguracion && <ConfiguracionView onVolver={() => setEnConfiguracion(false)} />}

        {!verConfiguracion && currentTab === 'inicio' && (
          <InicioView
            nombreUsuario={usuario.nombre}
            accounts={openAccounts}
            comandas={comandas}
            mesas={mesas}
            tablets={tablets}
            currentTurno={currentTurno}
            onNavigate={irASeccion}
            onOpenSimulador={() => setIsSimuladorOpen(true)}
          />
        )}

        {!verConfiguracion && currentTab === 'cocina' && (
          <KitchenKdsView
            comandas={comandas}
            onOpenSimulador={() => setIsSimuladorOpen(true)}
          />
        )}

        {!verConfiguracion && currentTab === 'tablets' && (
          <TabletsView
            tablets={tablets}
            events={recentEvents}
            esAdmin={usuario.rol === 'admin'}
            onOpenSimulador={() => setIsSimuladorOpen(true)}
          />
        )}

        {!verConfiguracion && currentTab === 'cajas' && (
          <AccountsView
            accounts={openAccounts}
            onSelectAccount={handleSelectAccount}
            onInitiateCobro={handleInitiateCobro}
            onOpenSimulador={() => setIsSimuladorOpen(true)}
          />
        )}

        {!verConfiguracion && currentTab === 'mesas' && (
          <MesasView
            mesas={mesas}
            accounts={openAccounts}
            productos={productos}
            nombreUsuario={usuario.nombre}
            onSelectAccount={handleSelectAccount}
          />
        )}

        {!verConfiguracion && currentTab === 'comandas' && (
          <ComandasView comandas={comandas} onOpenSimulador={() => setIsSimuladorOpen(true)} />
        )}

      </main>

      {/* 3. Modals & Overlays */}
      {/* Account Detail Modal */}
      {detailAccount && (
        <AccountDetailModal
          account={detailAccount}
          onClose={() => setDetailAccount(null)}
          onInitiateCobro={handleInitiateCobro}
        />
      )}

      {/* Multi-method Cobro Modal */}
      {cobroAccount && (
        <CobroModal
          account={cobroAccount}
          currentTurno={currentTurno}
          onClose={() => setCobroAccount(null)}
          onPaymentSuccess={handlePaymentSuccess}
          onOpenShiftRequired={handleOpenShiftRequired}
        />
      )}

      {/* Sales Ticket Modal (Printable) */}
      {activeTicket && (
        <SalesTicketModal
          payment={activeTicket}
          onClose={() => setActiveTicket(null)}
        />
      )}

      {/* Multi-device Simulator Panel */}
      <SimulationPanel
        isOpen={isSimuladorOpen}
        onClose={() => setIsSimuladorOpen(false)}
        accounts={openAccounts}
        comandas={comandas}
        onSelectAccount={handleSelectAccount}
      />
    </div>
  );
}
