// Avisos en vivo del servidor (GET /api/eventos, Server-Sent Events).
// Una sola conexión por pestaña; cada pantalla se suscribe a los tipos que le interesan y vuelve a leer
// de la base en cuanto llega un aviso. Si la conexión se cae, el navegador reconecta solo y, al volver,
// se avisa a todos para recuperar lo que haya cambiado mientras tanto.
// El sondeo cada pocos segundos se conserva como respaldo.
import { useEffect, useRef } from 'react';
import { getToken } from './authService';

export type TipoEvento = 'ordenes' | 'turno';
type Oyente = (tipo: TipoEvento) => void;

const oyentes = new Set<{ tipos: TipoEvento[]; fn: Oyente }>();
let fuente: EventSource | null = null;
let tokenFuente: string | null = null;
let huboError = false;

function avisar(tipo: TipoEvento | 'todos') {
  for (const o of oyentes) {
    if (tipo === 'todos') o.fn(o.tipos[0]);
    else if (o.tipos.includes(tipo)) o.fn(tipo);
  }
}

function conectar() {
  const token = getToken();
  if (fuente && tokenFuente === token) return;
  fuente?.close();
  fuente = null;
  tokenFuente = token;
  if (!token || typeof EventSource === 'undefined') return;

  fuente = new EventSource(`/api/eventos?token=${encodeURIComponent(token)}`);
  fuente.onmessage = (e) => {
    try {
      const { tipo } = JSON.parse(e.data) as { tipo: TipoEvento };
      avisar(tipo);
    } catch {
      // mensaje desconocido: se ignora
    }
  };
  fuente.onerror = () => {
    huboError = true;
  };
  fuente.onopen = () => {
    if (huboError) avisar('todos'); // reconectó: recuperar lo perdido
    huboError = false;
  };
}

function desconectarSiNadieEscucha() {
  if (oyentes.size > 0) return;
  fuente?.close();
  fuente = null;
  tokenFuente = null;
}

/** Fuera de un componente: llama a `fn` con cada aviso de esos tipos. Devuelve la función para dejar de escuchar. */
export function escucharEnVivo(tipos: TipoEvento[], fn: () => void): () => void {
  const oyente = { tipos, fn };
  oyentes.add(oyente);
  conectar();
  return () => {
    oyentes.delete(oyente);
    desconectarSiNadieEscucha();
  };
}

/** Llama a `alCambiar` cada vez que el servidor avisa un cambio de esos tipos. */
export function useEnVivo(tipos: TipoEvento[], alCambiar: () => void) {
  const ref = useRef(alCambiar);
  ref.current = alCambiar;
  const clave = tipos.join(',');
  useEffect(() => escucharEnVivo(clave.split(',') as TipoEvento[], () => ref.current()), [clave]);
}
