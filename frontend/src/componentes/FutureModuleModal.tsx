import React from 'react';
import { X, Layers, Users, Sliders, BarChart3, Database, ShieldCheck } from 'lucide-react';

interface FutureModuleModalProps {
  moduleName: string | null;
  onClose: () => void;
}

export const FutureModuleModal: React.FC<FutureModuleModalProps> = ({ moduleName, onClose }) => {
  if (!moduleName) return null;

  const getModuleInfo = () => {
    switch (moduleName) {
      case 'PRODUCTOS':
        return {
          icon: <Layers className="w-8 h-8 text-amber-500" />,
          title: 'Catálogo Central de Productos y Menú',
          description:
            'Caja Central será el único punto autorizado para modificar precios, recetas, modificadores y disponibilidad de platillos. Los cambios se sincronizarán instantáneamente en todas las tablets y cocina mediante el backend centralizado.',
          features: [
            'Gestión de precios, IVA y categorías',
            'Modificadores obligatorios y opcionales',
            'Disponibilidad en tiempo real (Agotado / Activo)',
            'Sincronización automática con las 4 tablets de meseros',
          ],
        };
      case 'USUARIOS':
        return {
          icon: <Users className="w-8 h-8 text-amber-500" />,
          title: 'Control de Usuarios y Roles (RBAC)',
          description:
            'Administración de credenciales con PIN numérico de acceso rápido para meseros en tablets y cajeros en Caja Central, evitando cobros o modificaciones no autorizadas.',
          features: [
            'PIN de 4 dígitos para inicio de sesión en tablets',
            'Asignación dinámica de meseros a tablets',
            'Permisos granulares: Mesero vs Cajero vs Administrador',
            'Auditoría de operaciones por usuario',
          ],
        };
      case 'CONFIGURACIÓN':
        return {
          icon: <Sliders className="w-8 h-8 text-amber-500" />,
          title: 'Configuración Central del Restaurante',
          description:
            'Parámetros de conexión de red local, configuración de impresoras térmicas ESC/POS de 80mm en caja y cocina, y datos fiscales para tickets de venta.',
          features: [
            'IPs estáticas y puertos de tablets y pantalla de cocina',
            'Parámetros de ticket de venta (RFC, Razón Social, Dirección)',
            'Reglas de propina sugerida y desglose de IVA (16%)',
            'Alertas sonoras para comanda lista',
          ],
        };
      case 'REPORTES':
        return {
          icon: <BarChart3 className="w-8 h-8 text-amber-500" />,
          title: 'Reportes y Analítica de Ventas',
          description:
            'Informes de ventas por turno, rendimiento de meseros, tiempos promedio de cocción en cocina y conciliación de métodos de pago.',
          features: [
            'Corte Z y arqueos históricos de turnos de caja',
            'Ventas por mesero y promedio de ticket por mesa',
            'Tiempos de servicio: comanda enviada vs orden servida',
            'Exportación a Excel / CSV para contabilidad',
          ],
        };
      default:
        return {
          icon: <Database className="w-8 h-8 text-amber-500" />,
          title: moduleName,
          description: 'Módulo preparado para conexión con la API y base de datos compartida.',
          features: [],
        };
    }
  };

  const info = getModuleInfo();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="bg-white border border-neutral-200 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200">
              {info.icon}
            </div>
            <div>
              <span className="text-[10px] font-mono text-amber-600 uppercase tracking-wider block">
                Arquitectura Centralizada
              </span>
              <h3 className="text-lg font-bold text-neutral-900 tracking-tight">{info.title}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-600 hover:text-neutral-900 p-1 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-neutral-700 leading-relaxed bg-neutral-50/60 p-3.5 rounded-xl border border-neutral-200">
          {info.description}
        </p>

        {info.features.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-semibold text-neutral-600 uppercase tracking-wider block">
              Capacidades Principales en Diseño:
            </span>
            <ul className="space-y-1.5 text-xs text-neutral-700">
              {info.features.map((feat, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="pt-3 border-t border-neutral-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-neutral-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
