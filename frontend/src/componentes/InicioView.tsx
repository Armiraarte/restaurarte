import React from 'react';
import {
  AlertTriangle,
  BellRing,
  ChefHat,
  ClipboardList,
  Home,
  LayoutGrid,
  LucideIcon,
  Receipt,
  Tablet,
  Wallet,
} from 'lucide-react';
import { Account, Comanda, Mesa, TabletDevice, Turno } from '../types/pos';
import { IntegrationCard, IntegrationVisual, NodoRed } from './IntegrationCard';
import { ImpresoraCard } from './ImpresoraCard';
import { cuentaDeMesa } from '../services/dataService';
import type { MainNavTab } from './SeccionesNav';

interface InicioViewProps {
  nombreUsuario: string;
  accounts: Account[];
  comandas: Comanda[];
  mesas: Mesa[];
  tablets: TabletDevice[];
  currentTurno: Turno | null;
  onNavigate: (tab: MainNavTab) => void;
  onOpenSimulador: () => void;
}

interface Resumen {
  id: string;
  destino: MainNavTab;
  label: string;
  valor: string;
  icon: LucideIcon;
  nota?: { texto: string; tipo: 'aviso' | 'alerta' | 'neutral'; icon?: LucideIcon };
}

const NOTA_ESTILO = {
  aviso: 'text-amber-700',
  alerta: 'text-rose-700',
  neutral: 'text-neutral-500',
};

const formatoMoneda = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });

export const InicioView: React.FC<InicioViewProps> = ({
  nombreUsuario,
  accounts,
  comandas,
  mesas,
  tablets,
  currentTurno,
  onNavigate,
  onOpenSimulador,
}) => {
  const solicitadas = accounts.filter((a) => a.status === 'cuenta_solicitada').length;
  const enCocina = comandas.filter((c) => c.status === 'nueva' || c.status === 'preparando').length;
  const listas = comandas.filter((c) => c.status === 'lista').length;
  const nuevas = comandas.filter((c) => c.status === 'nueva').length;
  const mesasOcupadas = mesas.filter((m) => cuentaDeMesa(m, accounts)).length;
  const tabletsConectadas = tablets.filter((t) => t.status === 'conectada').length;
  const tabletsDesconectadas = tablets.length - tabletsConectadas;
  const turnoAbierto = currentTurno?.status === 'abierto';

  const resumen: Resumen[] = [
    {
      id: 'ventas',
      destino: 'cajas',
      label: 'Ventas del turno',
      valor: formatoMoneda(turnoAbierto ? currentTurno!.totalSales : 0),
      icon: Wallet,
      nota: turnoAbierto
        ? { texto: `${currentTurno!.salesCount} cobros`, tipo: 'neutral' }
        : { texto: 'Sin turno abierto', tipo: 'alerta', icon: AlertTriangle },
    },
    {
      id: 'cuentas',
      destino: 'cajas',
      label: 'Cuentas abiertas',
      valor: String(accounts.length),
      icon: Receipt,
      nota: solicitadas > 0 ? { texto: `${solicitadas} piden la cuenta`, tipo: 'aviso', icon: BellRing } : undefined,
    },
    {
      id: 'cocina',
      destino: 'cocina',
      label: 'En cocina',
      valor: String(enCocina),
      icon: ChefHat,
      nota: listas > 0 ? { texto: `${listas} listas para servir`, tipo: 'aviso' } : undefined,
    },
    {
      id: 'mesas',
      destino: 'mesas',
      label: 'Mesas ocupadas',
      valor: `${mesasOcupadas}/${mesas.length}`,
      icon: LayoutGrid,
    },
    {
      id: 'tablets',
      destino: 'tablets',
      label: 'Tablets conectadas',
      valor: `${tabletsConectadas}/${tablets.length}`,
      icon: Tablet,
      nota:
        tabletsDesconectadas > 0
          ? { texto: `${tabletsDesconectadas} desconectadas`, tipo: 'alerta', icon: AlertTriangle }
          : undefined,
    },
  ];

  // Slots: arriba-izq, arriba-der, centro-izq, centro-der, abajo-centro
  const nodos: NodoRed[] = [
    { id: 'cocina', label: 'Cocina', icon: ChefHat, activo: true, badge: enCocina ? String(enCocina) : undefined, onClick: () => onNavigate('cocina') },
    { id: 'tablets', label: 'Tablet', icon: Tablet, activo: tabletsDesconectadas === 0, badge: `${tabletsConectadas}/${tablets.length}`, onClick: () => onNavigate('tablets') },
    { id: 'comandas', label: 'Comandas', icon: ClipboardList, activo: true, badge: nuevas ? String(nuevas) : undefined, onClick: () => onNavigate('comandas') },
    { id: 'cajas', label: 'Cajas', icon: Receipt, activo: true, badge: String(accounts.length), onClick: () => onNavigate('cajas') },
    { id: 'mesas', label: 'Mesas', icon: LayoutGrid, activo: true, badge: `${mesasOcupadas}/${mesas.length}`, onClick: () => onNavigate('mesas') },
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

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {resumen.map(({ id, destino, label, valor, icon: Icon, nota }) => {
          const NotaIcon = nota?.icon;
          return (
            <button
              key={id}
              onClick={() => onNavigate(destino)}
              className="text-left bg-white border border-neutral-200 hover:border-amber-400 rounded-xl p-4 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                <Icon className="w-4 h-4 text-neutral-400" />
                <span>{label}</span>
              </div>
              <div className="text-2xl font-bold font-mono tracking-tight text-neutral-900 mt-2">{valor}</div>
              <div className={`text-xs mt-1 min-h-4 flex items-center gap-1 ${nota ? NOTA_ESTILO[nota.tipo] : ''}`}>
                {NotaIcon && <NotaIcon className="w-3.5 h-3.5" />}
                {nota?.texto}
              </div>
            </button>
          );
        })}
      </div>

      <ImpresoraCard />

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
