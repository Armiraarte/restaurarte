import React from 'react';
import { AlertTriangle, Clock, Home, LayoutGrid, Receipt, Tablet, TrendingUp } from 'lucide-react';
import { IntegrationCard, IntegrationVisual, NodoRed } from './IntegrationCard';
import type { MainNavTab } from './SeccionesNav';

interface InicioViewProps {
  nombreUsuario: string;
  /** Datos reales del turno abierto (BD: orden), los mismos que muestran los botones de la barra. */
  ordenesActivas: number;
  ordenesConPedido: number;
  ordenesPorCobrar: number;
  ordenesCobradas: number;
  hayTurno: boolean;
  /** Tablets que han iniciado sesión (servidor) y cuántas siguen en línea. */
  tabletsConectadas: number;
  tabletsTotal: number;
  onNavigate: (tab: MainNavTab) => void;
  onOpenSimulador: () => void;
}

export const InicioView: React.FC<InicioViewProps> = ({
  nombreUsuario,
  ordenesActivas,
  ordenesConPedido,
  ordenesPorCobrar,
  ordenesCobradas,
  hayTurno,
  tabletsConectadas,
  tabletsTotal,
  onNavigate,
  onOpenSimulador,
}) => {
  const tabletsDesconectadas = tabletsTotal - tabletsConectadas;

  // Slots: arriba-izq, arriba-der, centro-izq, centro-der, abajo-centro
  const nodos: NodoRed[] = [
    { id: 'tablets', label: 'Tablet', icon: Tablet, activo: tabletsDesconectadas === 0, badge: `${tabletsConectadas}/${tabletsTotal}`, onClick: () => onNavigate('tablets') },
    { id: 'cajas', label: 'Cajas', icon: Receipt, activo: true, badge: String(ordenesPorCobrar), onClick: () => onNavigate('cajas') },
    { id: 'mesas', label: 'Órdenes', icon: LayoutGrid, activo: true, badge: `${ordenesConPedido}/${ordenesActivas}`, onClick: () => onNavigate('mesas') },
    { id: 'ventas', label: 'Ventas', icon: TrendingUp, activo: true, badge: String(ordenesCobradas), onClick: () => onNavigate('ventas') },
    { id: 'turnos', label: 'Turnos', icon: Clock, activo: hayTurno, badge: hayTurno ? 'ON' : 'OFF', onClick: () => onNavigate('turnos') },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Home className="w-5 h-5 text-amber-500" />
          <span>Inicio</span>
        </h2>
        <p className="text-sm text-neutral-500 mt-0.5">Hola, {nombreUsuario}. Así va el restaurante ahora.</p>
      </div>

      {/* Red de módulos */}
      <IntegrationCard
        visual={<IntegrationVisual nodos={nodos} />}
        title="Red del restaurante"
        description={
          <>
            <p>Todos los módulos enlazados con la caja de RESTAURARTE. Toca cualquiera para abrirlo.</p>
            {tabletsDesconectadas > 0 && (
              <p className="mt-2 text-rose-700 font-medium flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                {tabletsDesconectadas} tablet(s) sin conexión
              </p>
            )}
          </>
        }
        action={
          <button
            onClick={onOpenSimulador}
            className="h-10 w-fit rounded-full px-5 text-sm font-semibold text-neutral-950 bg-amber-500 hover:bg-amber-400 transition-colors cursor-pointer"
          >
            Simular eventos
          </button>
        }
      />
    </div>
  );
};
