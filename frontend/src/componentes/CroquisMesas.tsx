// Croquis del restaurante, como están acomodadas las mesas:
//   izquierda → 4 mesas largas (8 sillas), de la 1 (arriba) a la 4 (abajo)
//   derecha   → 5 mesas angostas (6 sillas), de la 5 (abajo) a la 9 (arriba)
// El cliente se sienta donde quiere: se toca su mesa y se abre la orden ahí mismo.
// Un solo SVG que escala completo al espacio disponible. Ligero para tablets: las sombras son
// rectángulos desplazados (sin filtros ni desenfoque).
import React from 'react';
import type { MesaRegistrada } from '../services/mesasService';
import { piezasSinEnviar } from '../services/borradorPedido';

interface MesaCroquis {
  numero: number;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  larga: boolean;
}

// Compacto en vertical (el croquis se ajusta al alto de la pantalla): así las mesas se ven más grandes.
const LARGA = { ancho: 400, alto: 124, larga: true };
const ANGOSTA = { ancho: 100, alto: 176, larga: false };
const MESAS: MesaCroquis[] = [
  ...[1, 2, 3, 4].map((numero, i) => ({ numero, x: 150, y: 66 + i * 240, ...LARGA })),
  // Pasillo amplio entre las dos filas, como en el restaurante.
  ...[9, 8, 7, 6, 5].map((numero, i) => ({ numero, x: 1080, y: 20 + i * 190, ...ANGOSTA })),
];

/** Órdenes activas que están en una mesa del croquis (número 1 a 9), por número. */
export function ordenesPorMesa(ordenes: MesaRegistrada[]) {
  const porNumero = new Map<number, MesaRegistrada>();
  for (const o of ordenes) {
    if (/^[1-9]$/.test(o.nombre) && !porNumero.has(Number(o.nombre))) porNumero.set(Number(o.nombre), o);
  }
  return porNumero;
}

type Lado = 'arriba' | 'abajo' | 'izquierda' | 'derecha';
/** Sillas alrededor de la mesa (con su respaldo hacia afuera); quedan un poco debajo de la cubierta. */
function sillas(m: MesaCroquis) {
  const lista: { x: number; y: number; w: number; h: number; lado: Lado }[] = [];
  if (m.larga) {
    for (const dx of [80, 200, 320]) {
      lista.push({ x: m.x + dx - 32, y: m.y - 40, w: 64, h: 46, lado: 'arriba' });
      lista.push({ x: m.x + dx - 32, y: m.y + m.alto - 6, w: 64, h: 46, lado: 'abajo' });
    }
    lista.push({ x: m.x - 40, y: m.y + m.alto / 2 - 32, w: 46, h: 64, lado: 'izquierda' });
    lista.push({ x: m.x + m.ancho - 6, y: m.y + m.alto / 2 - 32, w: 46, h: 64, lado: 'derecha' });
  } else {
    for (const dy of [30, 88, 146]) {
      lista.push({ x: m.x - 40, y: m.y + dy - 24, w: 46, h: 48, lado: 'izquierda' });
      lista.push({ x: m.x + m.ancho - 6, y: m.y + dy - 24, w: 46, h: 48, lado: 'derecha' });
    }
  }
  return lista;
}

/** Respaldo de la silla: una franja del lado de afuera. */
function respaldo(s: { x: number; y: number; w: number; h: number; lado: Lado }) {
  const g = 13;
  if (s.lado === 'arriba') return { x: s.x, y: s.y, w: s.w, h: g };
  if (s.lado === 'abajo') return { x: s.x, y: s.y + s.h - g, w: s.w, h: g };
  if (s.lado === 'izquierda') return { x: s.x, y: s.y, w: g, h: s.h };
  return { x: s.x + s.w - g, y: s.y, w: g, h: s.h };
}

const monto = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

// Colores por estado: libre (madera clara), abierta (cian) y pidió la cuenta (naranja).
const ESTILO = {
  libre: {
    arriba: '#fbf8f3', abajo: '#efe7dc', borde: '#d3c7b8', numero: '#57534e',
    silla: '#ebe8e4', sillaBorde: '#b8b2aa', respaldo: '#d6d1ca', pastilla: '#ffffff', pastillaBorde: '#d6d3d1', pastillaTexto: '#78716c',
  },
  abierta: {
    arriba: '#ecfeff', abajo: '#a5f3fc', borde: '#0891b2', numero: '#164e63',
    silla: '#e0f7fa', sillaBorde: '#22b8cf', respaldo: '#a5e9f3', pastilla: '#0891b2', pastillaBorde: '#0891b2', pastillaTexto: '#ffffff',
  },
  cuenta: {
    arriba: '#fff7ed', abajo: '#fed7aa', borde: '#ea580c', numero: '#7c2d12',
    silla: '#fff1e6', sillaBorde: '#fb923c', respaldo: '#fdc89a', pastilla: '#ea580c', pastillaBorde: '#ea580c', pastillaTexto: '#ffffff',
  },
};
type Estado = keyof typeof ESTILO;

export function CroquisMesas({
  ordenes,
  abriendo,
  onTocar,
}: {
  /** Órdenes activas del turno; las de número 1 a 9 se dibujan en su mesa. */
  ordenes: MesaRegistrada[];
  /** Mesa que se está registrando en el servidor (se ignoran otros toques mientras tanto). */
  abriendo: number | null;
  onTocar: (numero: number, orden: MesaRegistrada | undefined) => void;
}) {
  const porNumero = ordenesPorMesa(ordenes);

  return (
    <svg viewBox="100 12 1130 958" className="w-full h-full select-none" role="group" aria-label="Croquis de mesas del restaurante">
      <defs>
        {(Object.keys(ESTILO) as Estado[]).map((e) => (
          <linearGradient key={e} id={`cubierta-${e}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ESTILO[e].arriba} />
            <stop offset="100%" stopColor={ESTILO[e].abajo} />
          </linearGradient>
        ))}
      </defs>
      {MESAS.map((m) => {
        const orden = porNumero.get(m.numero);
        const pidio = orden?.estatus === 1; // PAGANDO: pidió la cuenta
        const estado: Estado = !orden ? 'libre' : pidio ? 'cuenta' : 'abierta';
        const c = ESTILO[estado];
        const total = Number(orden?.total ?? 0);
        const sinEnviar = orden && !pidio ? piezasSinEnviar(orden.id) : 0;
        const cargando = abriendo === m.numero;
        const cx = m.x + m.ancho / 2;
        // Texto de la pastilla: en las largas cabe la frase; en las angostas, lo esencial.
        const etiqueta = cargando
          ? 'ABRIENDO…'
          : !orden ? 'LIBRE'
          : m.larga
            ? pidio ? `CUENTA · ${monto(total)}` : total > 0 ? `CON PEDIDO · ${monto(total)}` : 'ABIERTA'
            : pidio ? 'CUENTA' : total > 0 ? monto(total) : 'ABIERTA';
        const tamLetra = m.larga ? 22 : etiqueta.length > 7 ? 13 : 17;
        const anchoPastilla = m.larga ? Math.min(m.ancho - 40, etiqueta.length * 14 + 36) : m.ancho - 14;
        const yPastilla = m.larga ? m.y + 80 : m.y + 100;
        const tocar = () => {
          if (abriendo === null) onTocar(m.numero, orden);
        };
        return (
          <g
            key={m.numero}
            role="button"
            tabIndex={0}
            aria-label={`Mesa ${m.numero}: ${!orden ? 'libre' : pidio ? `pidió la cuenta, ${monto(total)}` : `abierta, ${monto(total)}`}`}
            onClick={tocar}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                tocar();
              }
            }}
            className={`cursor-pointer outline-none focus-visible:opacity-80 active:opacity-70 ${cargando ? 'opacity-60' : ''}`}
          >
            {sillas(m).map((s, i) => {
              const r = respaldo(s);
              return (
                <g key={i}>
                  <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={11} fill={c.silla} stroke={c.sillaBorde} strokeWidth={2} />
                  <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={6} fill={c.respaldo} />
                </g>
              );
            })}
            {/* Sombra suave (sin desenfoque) y cubierta */}
            <rect x={m.x + 5} y={m.y + 9} width={m.ancho} height={m.alto} rx={16} fill="#000" opacity={0.07} />
            <rect x={m.x} y={m.y} width={m.ancho} height={m.alto} rx={16} fill={`url(#cubierta-${estado})`} stroke={c.borde} strokeWidth={orden ? 4 : 2.5} />
            <rect x={m.x + 7} y={m.y + 7} width={m.ancho - 14} height={m.alto - 14} rx={11} fill="none" stroke="#fff" strokeOpacity={0.7} strokeWidth={2} />

            <text x={cx} y={m.larga ? m.y + 62 : m.y + 72} textAnchor="middle" fontSize={m.larga ? 54 : 52} fontWeight={900} fill={c.numero}>
              {m.numero}
            </text>
            <rect x={cx - anchoPastilla / 2} y={yPastilla} width={anchoPastilla} height={30} rx={15} fill={c.pastilla} stroke={c.pastillaBorde} strokeWidth={1.5} />
            <text x={cx} y={yPastilla + 21} textAnchor="middle" fontSize={tamLetra} fontWeight={800} letterSpacing={0.5} fill={c.pastillaTexto}>
              {etiqueta}
            </text>
            {/* En las angostas, el monto de la cuenta pedida va debajo de la pastilla */}
            {!m.larga && pidio && !cargando && (
              <text x={cx} y={m.y + 156} textAnchor="middle" fontSize={19} fontWeight={800} fill={c.numero}>{monto(total)}</text>
            )}

            {/* Productos agregados en este dispositivo que todavía no se envían a cocina */}
            {sinEnviar > 0 && (
              <>
                <circle cx={m.x + m.ancho - 4} cy={m.y + 4} r={22} fill="#f97316" stroke="#fff" strokeWidth={3} />
                <text x={m.x + m.ancho - 4} y={m.y + 12} textAnchor="middle" fontSize={22} fontWeight={900} fill="#fff">{sinEnviar}</text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
