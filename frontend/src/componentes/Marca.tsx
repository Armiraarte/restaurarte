// Identidad de la caja web:
//   MarcaDeAgua → logo completo de Cenaduría Los Diablitos, fijo al fondo y difuminado (public/images/logo-completo-800.jpg)
//   PieDePagina → logo del software Restaurarte y «Hecho por ARMIRARTE», fijo abajo (public/images/restaurarte-recortado.png)
// Las imágenes tienen fondo blanco: mix-blend-multiply (en la capa que se mezcla con la página) lo vuelve
// transparente sobre el fondo crema.
import React from 'react';

/** Logo completo: el encuadre elimina únicamente los márgenes blancos del archivo. */
export const LogoRestaurante: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`overflow-hidden aspect-[800/312] mix-blend-multiply ${className}`}>
    <img
      src="/images/logo-completo-800.jpg"
      alt="Cenaduría Los Diablitos"
      width={800}
      height={600}
      className="block w-full max-w-none -mt-[17.5%]"
    />
  </div>
);

export const EncabezadoTicketRestaurante: React.FC = () => (
  <div className="text-center">
    <LogoRestaurante className="mx-auto w-[50mm] max-w-full" />
    <p className="mt-1 text-[8px] leading-tight text-black">
      Aquí se cena como los Dioses aunque nos llamen Diablitos
    </p>
  </div>
);

export const MarcaDeAgua: React.FC = () => (
  <div
    aria-hidden="true"
    className="pointer-events-none select-none fixed inset-0 z-0 flex items-center justify-center p-8 mix-blend-multiply"
  >
    <img
      src="/images/logo-completo-800.jpg"
      alt=""
      className="w-[min(70vw,56rem)] max-h-[70vh] object-contain opacity-[0.08] blur-[1px]"
    />
  </div>
);

export const PieDePagina: React.FC = () => (
  <footer className="sticky bottom-0 z-30 border-t border-neutral-200 bg-white/70 backdrop-blur-sm">
    <div className="px-4 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-500">
      <div className="flex items-center gap-3">
        <img src="/images/restaurarte-recortado.png" alt="Restaurarte · Soft Restaurant" className="h-10 w-auto mix-blend-multiply" />
      </div>
      <span>
        Hecho por <strong className="font-bold tracking-wide text-infernal">ARMIRARTE</strong> · {new Date().getFullYear()}
      </span>
    </div>
  </footer>
);
