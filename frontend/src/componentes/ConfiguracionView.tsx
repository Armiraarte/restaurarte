// Módulo de configuración: solo para usuarios con rol admin (se abre con el engrane del encabezado).
import React, { useState } from 'react';
import { ArrowLeft, LucideIcon, Settings, Users } from 'lucide-react';
import { UsuariosConfig } from './UsuariosConfig';

type SeccionId = 'usuarios';

const SECCIONES: { id: SeccionId; label: string; icon: LucideIcon }[] = [{ id: 'usuarios', label: 'Usuarios', icon: Users }];

export const ConfiguracionView: React.FC<{ onVolver: () => void }> = ({ onVolver }) => {
  const [seccion, setSeccion] = useState<SeccionId>('usuarios');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onVolver}
          className="h-10 px-3 rounded-lg bg-white border border-neutral-200 hover:border-neutral-300 flex items-center gap-1.5 text-sm font-medium cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <div className="flex items-center gap-2">
          <Settings className="w-6 h-6 text-neutral-700" />
          <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        {/* Menú lateral */}
        <nav className="flex md:flex-col gap-1 md:self-start bg-white border border-neutral-200 rounded-xl p-2">
          {SECCIONES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSeccion(id)}
              className={`h-10 px-3 rounded-lg flex items-center gap-2 text-sm font-medium text-left cursor-pointer transition-colors ${
                seccion === id ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>

        <div className="min-w-0">{seccion === 'usuarios' && <UsuariosConfig />}</div>
      </div>
    </div>
  );
};
