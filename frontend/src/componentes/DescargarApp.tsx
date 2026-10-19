// Tablet abierta en el navegador: solo se ofrece descargar la versión tablet (la app instalada).
// Ya instalada, la tablet solo usa esa versión (main.tsx).
import React, { useEffect } from 'react';
import { BotonInstalarPwa } from './InstalarPwa';
import { LogoRestaurante } from './Marca';

export const DescargarApp: React.FC = () => {
  // Cabe en la pantalla sin scroll (misma escala que el inicio de sesión).
  useEffect(() => {
    document.documentElement.classList.add('inicio-sesion');
    return () => document.documentElement.classList.remove('inicio-sesion');
  }, []);

  return (
    <div className="h-dvh overflow-hidden flex flex-col items-center justify-center gap-8 px-6 bg-gradient-to-br from-red-600 via-red-700 to-red-900 text-crema select-none">
      <div className="w-[min(24rem,80vw)] bg-white rounded-[2rem] p-5 shadow-2xl shadow-black/40 ring-4 ring-white/20">
        <LogoRestaurante className="w-full" />
      </div>
      <div className="w-full max-w-sm">
        <BotonInstalarPwa nombreApp="de la tablet" texto="Descargar versión" variante="grande" />
      </div>
      <p className="absolute bottom-3 inset-x-0 text-center text-xs text-crema/80">
        SOFT RESTAURANTE · Hecho por <strong className="font-bold tracking-wide text-crema">ARMIRARTE</strong>
      </p>
    </div>
  );
};
