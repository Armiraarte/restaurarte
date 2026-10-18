// Lado tablet: latido al servidor y aviso de "verificando conectividad" cuando el admin lo pide.
import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Wifi } from 'lucide-react';
import { confirmarVerificacion, enviarLatido } from '../services/tabletsService';
import { SesionReemplazadaError } from '../services/authService';

const INTERVALO_LATIDO_MS = 3_000;
const DURACION_VERIFICANDO_MS = 1_800;
const DURACION_VERIFICADA_MS = 2_500;

type Fase = 'verificando' | 'verificada' | null;

/**
 * Mientras la tablet tiene sesión, avisa al servidor que sigue en línea y atiende las verificaciones.
 * Si se entró con la misma cuenta en otro dispositivo, llama a `onSesionReemplazada` con el aviso del servidor.
 */
export function useLatidoTablet(
  activo: boolean,
  tablet: string | null,
  mesero: string | null,
  onSesionReemplazada: (aviso: string) => void,
): Fase {
  const [fase, setFase] = useState<Fase>(null);
  const datos = useRef({ tablet, mesero });
  datos.current = { tablet, mesero };
  const alReemplazar = useRef(onSesionReemplazada);
  alReemplazar.current = onSesionReemplazada;
  const atendiendo = useRef(false);

  useEffect(() => {
    if (!activo) return;
    let cancelado = false;
    const temporizadores: ReturnType<typeof setTimeout>[] = [];

    const latir = async () => {
      try {
        const { verificacion } = await enviarLatido(datos.current);
        if (!verificacion || cancelado || atendiendo.current) return;

        atendiendo.current = true;
        setFase('verificando');
        temporizadores.push(
          setTimeout(async () => {
            try {
              await confirmarVerificacion(verificacion.id);
            } catch {
              // si no llega, el admin la verá pendiente y puede volver a pedirla
            }
            if (cancelado) return;
            setFase('verificada');
            temporizadores.push(
              setTimeout(() => {
                atendiendo.current = false;
                if (!cancelado) setFase(null);
              }, DURACION_VERIFICADA_MS),
            );
          }, DURACION_VERIFICANDO_MS),
        );
      } catch (err) {
        if (err instanceof SesionReemplazadaError) {
          if (!cancelado) alReemplazar.current(err.message);
          return;
        }
        // sin conexión: se reintenta en el siguiente latido
      }
    };

    latir();
    const id = setInterval(latir, INTERVALO_LATIDO_MS);
    return () => {
      cancelado = true;
      atendiendo.current = false;
      clearInterval(id);
      temporizadores.forEach(clearTimeout);
    };
  }, [activo]);

  return fase;
}

export const AvisoVerificacion: React.FC<{ fase: Fase }> = ({ fase }) => (
  <AnimatePresence>
    {fase && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-neutral-950/40 flex items-center justify-center p-4"
        role="alertdialog"
        aria-live="assertive"
      >
        <motion.div
          initial={{ scale: 0.9, y: 10 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95 }}
          className="bg-white rounded-2xl shadow-xl px-8 py-7 w-full max-w-xs text-center space-y-3"
        >
          {fase === 'verificando' ? (
            <>
              <span className="relative mx-auto w-14 h-14 flex items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-sky-400/40 animate-ping" />
                <span className="relative w-14 h-14 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center">
                  <Wifi className="w-7 h-7" />
                </span>
              </span>
              <div className="font-semibold text-neutral-900">Verificando conectividad…</div>
              <p className="text-xs text-neutral-500">El administrador está comprobando la conexión de esta tablet.</p>
            </>
          ) : (
            <>
              <span className="mx-auto w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </span>
              <div className="font-semibold text-neutral-900">Conexión verificada</div>
              <p className="text-xs text-neutral-500">La tablet está conectada con caja.</p>
            </>
          )}
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);
