import assert from 'node:assert/strict';
import test from 'node:test';
import { importeAQuitar, repartoAQuitar } from '../src/services/quitarDelPedido.ts';

const renglon = (idDetalle_Orden, cantidad, subtotal, opciones = null) => ({ idDetalle_Orden, cantidad, subtotal, opciones });

test('un renglón: completo o solo algunas piezas, a su precio por pieza', () => {
  const tacos = [renglon(4, 3, 54)];
  assert.deepEqual(repartoAQuitar(tacos, 3), [{ linea: tacos[0], piezas: undefined }]);
  assert.deepEqual(repartoAQuitar(tacos, 1), [{ linea: tacos[0], piezas: 1 }]);
  assert.equal(importeAQuitar(repartoAQuitar(tacos, 1)), 18);
  assert.equal(importeAQuitar(repartoAQuitar(tacos, 3)), 54);
});

test('el mismo producto en varios envíos: se quita primero de lo más reciente', () => {
  const viejo = renglon(2, 2, 36);
  const nuevo = renglon(9, 1, 18);
  const pasos = repartoAQuitar([viejo, nuevo], 2);
  assert.deepEqual(pasos, [{ linea: nuevo, piezas: undefined }, { linea: viejo, piezas: 1 }]);
  assert.equal(importeAQuitar(pasos), 36);
});

test('MIXTAS se quitan completas aunque se pidan menos piezas', () => {
  const mixtas = renglon(5, 10, 130, { reparto: [{ nombre: 'BBQ', cantidad: 4 }, { nombre: 'Naturales', cantidad: 6 }] });
  assert.deepEqual(repartoAQuitar([mixtas], 3), [{ linea: mixtas, piezas: undefined }]);
  assert.equal(importeAQuitar(repartoAQuitar([mixtas], 3)), 130);
});

test('centavos: lo que queda se redondea como en el servidor', () => {
  // 3 piezas por $10.00: quedan 2 → $6.67, se quitan $3.33.
  assert.equal(importeAQuitar(repartoAQuitar([renglon(1, 3, 10)], 1)), 3.33);
});
