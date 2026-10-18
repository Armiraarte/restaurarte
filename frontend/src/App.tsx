/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Account, Comanda, Mesa, PaymentRecord, ProductCatalogItem, SocketEventLog, TabletDevice, Turno } from './types/pos';
import { cuentaDeMesa, posDataService } from './services/dataService';
import { Header } from './componentes/Header';
import { SeccionesNav, MainNavTab } from './componentes/SeccionesNav';
import { CajasView } from './componentes/CajasView';
import { MarcaDeAgua, PieDePagina } from './componentes/Marca';
import { VentasView } from './componentes/VentasView';
import { TurnosView } from './componentes/TurnosView';
import { AccountDetailModal } from './componentes/AccountDetailModal';
import { CobroModal } from './componentes/CobroModal';
import { SalesTicketModal } from './componentes/SalesTicketModal';
import { TabletsView } from './componentes/TabletsView';
import { SimulationPanel } from './componentes/SimulationPanel';
import { InicioSesion } from './componentes/InicioSesion';
import { MesasView } from './componentes/MesasView';
import { ConfiguracionView } from './componentes/ConfiguracionView';
import { InicioView } from './componentes/InicioView';
import { getToken, logout, obtenerSesion, Usuario } from './services/authService';
import { useMesasTurno, useTurnoActual } from './services/sincronizacion';
import { useTabletsEnLinea } from './services/tabletsService';
import { AvisoIniciarTurno, BannerSinTurno, SeccionSinTurno } from './componentes/TurnoRequerido';
import { AnimatePresence as AnimarTurno } from 'framer-motion';
import { esOrdenActiva, etiquetaMesaRegistrada } from './services/mesasService';
import { navegarApp } from './services/appNavigation';
import { LimiteDeErrores } from './componentes/AlertasErrores';

export default function App() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [verificandoSesion, setVerificandoSesion] = useState(true);
  // Token con el que se verificó la sesión que se está mostrando. La caja y la app de meseros comparten
  // la sesión del navegador: si después se entró con una cuenta de tablet (en otra pestaña, o con «atrás»
  // el navegador devuelve la caja como la tenía en memoria), el token ya no es este y se vuelve a verificar
  // antes de mostrar nada. Así una tablet nunca ve el panel de la caja.
  const [tokenVerificado, setTokenVerificado] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const tokenCambio = getToken() !== tokenVerificado;

  useEffect(() => {
    // Si el servidor no responde (se reinició), se reintenta cada 3 s en vez de mandar al login.
    let cancelado = false;
    let reintento: ReturnType<typeof setTimeout>;
    const verificar = () => {
      const token = getToken();
      obtenerSesion()
        .then((u) => {
          if (cancelado) return;
          setUsuario(u);
          setTokenVerificado(u ? token : null);
          setVerificandoSesion(false);
        })
        .catch(() => {
          if (!cancelado) reintento = setTimeout(verificar, 3_000);
        });
    };
    verificar();
    return () => {
      cancelado = true;
      clearTimeout(reintento);
    };
  }, [revision]);

  // Cada vez que se vuelve a la caja (atrás/adelante, otra pestaña, la app vuelve a la vista) o cambia la
  // sesión guardada, se revisa si sigue siendo la misma; si no, se verifica de nuevo.
  useEffect(() => {
    const revisar = (e?: Event) => {
      const restaurada = e instanceof PageTransitionEvent && e.persisted;
      if (restaurada || getToken() !== tokenVerificado) setRevision((r) => r + 1);
    };
    const alCambiarVista = () => {
      if (document.visibilityState === 'visible') revisar();
    };
    window.addEventListener('pageshow', revisar);
    window.addEventListener('popstate', revisar);
    window.addEventListener('focus', revisar);
    window.addEventListener('storage', revisar);
    document.addEventListener('visibilitychange', alCambiarVista);
    return () => {
      window.removeEventListener('pageshow', revisar);
      window.removeEventListener('popstate', revisar);
      window.removeEventListener('focus', revisar);
      window.removeEventListener('storage', revisar);
      document.removeEventListener('visibilitychange', alCambiarVista);
    };
  }, [tokenVerificado]);

  const handleLogout = () => {
    logout();
    setUsuario(null);
    setTokenVerificado(null);
  };

  const entrar = (u: Usuario) => {
    setUsuario(u);
    setTokenVerificado(getToken());
  };

  useEffect(() => {
    if (usuario?.rol === 'tablet') navegarApp('meseros', { reemplazar: true });
  }, [usuario]);

  if (verificandoSesion) {
    return <div className="min-h-screen bg-neutral-100" />;
  }

  // La sesión guardada ya no es la que se verificó: no se muestra nada hasta revisarla (lo hace el efecto).
  if (usuario && tokenCambio) {
    return <div className="min-h-screen bg-neutral-100" />;
  }

  if (!usuario) {
    return <InicioSesion app="caja" onEntrar={entrar} />;
  }

  // Las cuentas de tipo tablet no usan la caja: van a la app de meseros.
  if (usuario.rol === 'tablet') {
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

  // Turno de caja (BD: turnos): ya no se abre solo al iniciar sesión. Sin turno no se cobra ni se activan tabletas.
  // undefined = cargando, null = sin turno. Al entrar sin turno sale el aviso para iniciarlo.
  const turnoCaja = useTurnoActual();
  // Tablets reales (servidor), para el Inicio y el aviso del botón Tablet.
  const { tablets: tabletsEnLinea } = useTabletsEnLinea();
  const tabletsConectadas = (tabletsEnLinea ?? []).filter((t) => t.conectada).length;
  const tabletsTotal = tabletsEnLinea?.length ?? 0;
  const sinTurno = turnoCaja === null;
  const [avisoTurnoVisto, setAvisoTurnoVisto] = useState(false);

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
  // Contador del botón Mesas: mesas registradas en el turno (base de datos) y cuántas tienen pedido en esta caja.
  const { mesas: mesasTurno } = useMesasTurno();
  // Botón Cajas: órdenes que pidieron la cuenta (orden.estatus = 1, PAGANDO).
  const ordenesPagando = (mesasTurno ?? []).filter((m) => m.estatus === 1).length;
  // Botón Ventas: órdenes cobradas en el turno (orden.estatus = 2, PAGADO).
  const ordenesPagadas = (mesasTurno ?? []).filter((m) => m.estatus === 2).length;
  // Botón Órdenes: órdenes activas (no cobradas) y cuántas tienen pedido (BD: orden.total).
  const ordenesActivas = (mesasTurno ?? []).filter(esOrdenActiva);
  const mesasOcupadas = ordenesActivas.filter((m) => Number(m.total) > 0).length;

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
    // Encabezado arriba y pie abajo, siempre a la vista; en medio, el menú de secciones y el contenido con su propio scroll.
    <div className="cristal relative h-dvh overflow-hidden bg-neutral-100 text-neutral-900 flex flex-col font-sans selection:bg-amber-500 selection:text-neutral-950">
      {/* Logo de la cenaduría de fondo, difuminado */}
      <MarcaDeAgua />

      {/* 1. Navbar: logo y usuario */}
      <Header
        usuario={usuario}
        onLogout={onLogout}
        onOpenConfig={() => setEnConfiguracion((v) => !v)}
        configActiva={verConfiguracion}
      />

      <div className="relative flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* Secciones: barra lateral en pantallas grandes, barra horizontal en las angostas */}
        <SeccionesNav
          currentTab={currentTab}
          onTabChange={irASeccion}
          hasDisconnectedTablet={tabletsConectadas < tabletsTotal}
          openAccountsCount={ordenesPagando}
          solicitadasCount={ordenesPagando}
          mesasOcupadas={mesasOcupadas}
          mesasTotal={ordenesActivas.length}
          ventasCount={ordenesPagadas}
        />

        <div className="flex-1 min-w-0 min-h-0 overflow-y-auto overscroll-contain flex flex-col">
          {sinTurno && <BannerSinTurno />}
          <AnimarTurno>{sinTurno && !avisoTurnoVisto && <AvisoIniciarTurno onCerrar={() => setAvisoTurnoVisto(true)} />}</AnimarTurno>

          {/* 2. Main Content Area */}
          <main className="relative z-10 flex-1 w-full px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
            {/* Si una sección falla, se ve el problema ahí mismo y el menú sigue funcionando. */}
            <LimiteDeErrores key={verConfiguracion ? 'configuracion' : currentTab}>
              {verConfiguracion && <ConfiguracionView onVolver={() => setEnConfiguracion(false)} />}

              {!verConfiguracion && currentTab === 'inicio' && (
                <InicioView
                  nombreUsuario={usuario.nombre}
                  ordenesActivas={ordenesActivas.length}
                  ordenesConPedido={mesasOcupadas}
                  ordenesPorCobrar={ordenesPagando}
                  ordenesCobradas={ordenesPagadas}
                  hayTurno={!!turnoCaja}
                  tabletsConectadas={tabletsConectadas}
                  tabletsTotal={tabletsTotal}
                  onNavigate={irASeccion}
                  onOpenSimulador={() => setIsSimuladorOpen(true)}
                />
              )}

              {!verConfiguracion && currentTab === 'tablets' && (
                <TabletsView events={recentEvents} esAdmin={usuario.rol === 'admin'} />
              )}

              {!verConfiguracion && currentTab === 'cajas' && (
                // Órdenes que pidieron la cuenta (orden.estatus = 1, PAGANDO)
                sinTurno ? <SeccionSinTurno seccion="Cajas" /> : <CajasView />
              )}

              {/* Órdenes cobradas del turno abierto (orden.estatus = 2, PAGADO) */}
              {!verConfiguracion && currentTab === 'ventas' && (sinTurno ? <SeccionSinTurno seccion="Ventas" /> : <VentasView />)}

              {/* Turno actual, corte de turno e historial de cortes */}
              {!verConfiguracion && currentTab === 'turnos' && <TurnosView onIrA={irASeccion} />}

              {!verConfiguracion && currentTab === 'mesas' && (
                sinTurno ? <SeccionSinTurno seccion="Órdenes" /> : <MesasView nombreUsuario={usuario.nombre} />
              )}
            </LimiteDeErrores>
          </main>
        </div>
      </div>

      <PieDePagina />

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
