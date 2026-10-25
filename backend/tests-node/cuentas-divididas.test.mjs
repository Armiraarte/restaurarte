import assert from 'node:assert/strict';
import test from 'node:test';
import { calcularCuentasDivididas, divisionVigente, guardarCuentasDivididas, validarSolicitudDivision } from '../src/cuentasDivididas.ts';
import { unidadesDeCuenta } from '../src/dividirCuenta.ts';
import { lineasTicketCuentaDividida } from '../src/ticketCuentaDividida.ts';
import { lineasTicketCobro } from '../src/ticketCobro.ts';

const renglon = (datos) => ({ sin_queso: false, con_queso: false, carne_extra: 0, tamano: null, opciones: null, ...datos });
const orden = {
  total: 155,
  detalle: [
    renglon({ idDetalle_Orden: 10, categoria: 'Tacos', nombre: 'Pollo', cantidad: 3, subtotal: 54 }),
    renglon({ idDetalle_Orden: 11, categoria: 'Bebidas', nombre: 'Coca-Cola', cantidad: 1, subtotal: 30 }),
    // MIXTAS: 2 Mixto ($30) + 1 Jamón ($25) con papas en todo el renglón.
    renglon({ idDetalle_Orden: 12, categoria: 'Lonches', nombre: 'Mixto', cantidad: 3, subtotal: 66,
      opciones: { reparto: [{ nombre: 'Mixto', cantidad: 2, precio: 20 }, { nombre: 'Jamón', cantidad: 1, precio: 15 }] } }),
  ],
  extras: [{ id: 3, descripcion: 'Desechables', importe: 5 }],
};

test('partes iguales: Cuenta 1…N que suman el total exacto, los centavos que sobran en las primeras', () => {
  const r = calcularCuentasDivididas({ ...orden, total: 100 }, { modo: 'iguales', personas: 3 });
  assert.deepEqual(r.cuentas.map((c) => [c.numero, c.importe]), [[1, 33.34], [2, 33.33], [3, 33.33]]);
  assert.ok(r.cuentas.every((c) => c.personas === 3 && c.total_orden === 100 && c.productos.length === 0));
  assert.equal(divisionVigente(r.cuentas, 100), true);
  assert.equal(divisionVigente(r.cuentas, 130), false, 'Si se agregó algo después, la división ya no cuadra');
});

test('por productos: usa las mismas piezas que la pantalla y junta lo de cada persona como en el ticket de cobro', () => {
  // Las claves son las de la pantalla (frontend/src/services/dividirCuenta.ts reexporta el mismo cálculo).
  const claves = unidadesDeCuenta(orden.detalle.map((d) => ({ clave: String(d.idDetalle_Orden), nombre: d.nombre, cantidad: d.cantidad, subtotal: d.subtotal, reparto: d.opciones?.reparto })),
    orden.extras.map((e) => ({ clave: String(e.id), descripcion: e.descripcion, importe: e.importe }))).map((u) => u.clave);
  assert.deepEqual(claves, ['10-0', '10-1', '10-2', '11-0', '12-0', '12-1', '12-2', 'extra-3']);

  const asignadas = { '10-0': 0, '10-1': 0, '10-2': 1, '11-0': 1, '12-0': 0, '12-1': 1, '12-2': 1, 'extra-3': 0 };
  const r = calcularCuentasDivididas(orden, { modo: 'productos', personas: 2, asignadas });
  const [c1, c2] = r.cuentas;
  // MIXTAS: cada pieza a su precio y los $11 de más del renglón repartidos entre las tres (3.67, 3.67, 3.66).
  assert.deepEqual(c1.productos, [{ cantidad: 2, nombre: 'Tacos Pollo', importe: 36 }, { cantidad: 1, nombre: 'Lonches Mixto', importe: 23.67 }]);
  assert.deepEqual(c1.extras, [{ descripcion: 'Desechables', importe: 5 }]);
  assert.deepEqual(c2.productos, [
    { cantidad: 1, nombre: 'Tacos Pollo', importe: 18 }, { cantidad: 1, nombre: 'Bebidas Coca-Cola', importe: 30 },
    { cantidad: 1, nombre: 'Lonches Mixto', importe: 23.67 }, { cantidad: 1, nombre: 'Lonches Jamón', importe: 18.66 },
  ]);
  assert.deepEqual([c1.importe, c2.importe], [64.67, 90.33]);
  assert.equal(divisionVigente(r.cuentas, 155), true, 'Las cuentas suman exacto el total de la orden');
  assert.deepEqual([c1.numero, c2.numero, c1.modo], [1, 2, 'productos']);
});

test('por productos: no se guarda si falta asignar algo, si alguien quedó vacío o si la cuenta cambió', () => {
  const todas = { '10-0': 0, '10-1': 0, '10-2': 0, '11-0': 0, '12-0': 0, '12-1': 0, '12-2': 0, 'extra-3': 1 };
  const { '12-2': _quitada, ...incompleta } = todas;
  assert.match(calcularCuentasDivididas(orden, { modo: 'productos', personas: 2, asignadas: incompleta }).error, /Falta asignar 1 producto/);
  assert.match(calcularCuentasDivididas(orden, { modo: 'productos', personas: 3, asignadas: todas }).error, /Persona 3 no tiene productos/);
  assert.match(calcularCuentasDivididas(orden, { modo: 'productos', personas: 2, asignadas: { ...todas, '99-0': 0 } }).error, /cambió/);
});

test('valida lo que manda la pantalla', () => {
  assert.equal(validarSolicitudDivision({ modo: 'iguales', personas: 5 }), null);
  assert.equal(validarSolicitudDivision({ modo: 'productos', personas: 2, asignadas: { 'a-0': 1 } }), null);
  for (const s of [null, { modo: 'otro', personas: 2 }, { modo: 'iguales', personas: 1 }, { modo: 'iguales', personas: 13 }, { modo: 'iguales', personas: 2.5 },
    { modo: 'productos', personas: 2 }, { modo: 'productos', personas: 2, asignadas: { 'a-0': 2 } }, { modo: 'productos', personas: 2, asignadas: [] }]) {
    assert.notEqual(validarSolicitudDivision(s), null, JSON.stringify(s));
  }
});

test('guardar reemplaza la división anterior de la orden', async () => {
  const sql = [];
  const conexion = { async execute(consulta, valores) { sql.push({ consulta, valores }); return [{}]; } };
  const { cuentas } = calcularCuentasDivididas({ ...orden, total: 10 }, { modo: 'iguales', personas: 2 });
  await guardarCuentasDivididas(conexion, 7, cuentas, 'Tablet 01', new Date('2026-10-25T20:00:00Z'));
  assert.match(sql[0].consulta, /^DELETE FROM orden_cuenta_dividida WHERE idOrden = \?/);
  assert.deepEqual(sql.slice(1).map((s) => s.valores.slice(0, 8)), [
    [7, 1, 2, 'iguales', '5.00', '10.00', null, 'Tablet 01'],
    [7, 2, 2, 'iguales', '5.00', '10.00', null, 'Tablet 01'],
  ]);
});

test('ticket de cada persona: CUENTA N DE M con sus productos o su parte igual', () => {
  const base = { idOrden: 4, etiqueta: 'Mesa 1', paraLlevar: false, abiertaPor: 'Tablet 01', fecha: new Date('2026-10-25T03:00:00Z') };
  const textos = (lineas) => lineas.map((l) => [l.texto, l.derecha].filter(Boolean).join(' | '));
  const productos = textos(lineasTicketCuentaDividida({ ...base, cuenta: { numero: 2, personas: 5, modo: 'productos', importe: 71, total_orden: 990,
    productos: [{ cantidad: 2, nombre: 'Tacos Pollo', importe: 36 }], extras: [{ descripcion: 'Desechables', importe: 5 }] } }));
  for (const esperado of ['Mesa 1', 'CUENTA 2 DE 5', '2  Tacos Pollo | $36.00', 'EXTRAS', 'Desechables | $5.00', 'TOTAL A PAGAR | $71.00', 'Cuenta dividida · Orden total | $990.00']) {
    assert.ok(productos.includes(esperado), esperado);
  }
  const iguales = textos(lineasTicketCuentaDividida({ ...base, paraLlevar: true, reimpresion: true,
    cuenta: { numero: 1, personas: 5, modo: 'iguales', importe: 198, total_orden: 990, productos: [], extras: [] } }));
  for (const esperado of ['Mesa 1 · PARA LLEVAR', 'CUENTA 1 DE 5', '*** REIMPRESIÓN ***', 'Parte igual de la cuenta', 'Total de la orden | $990.00', 'Dividida entre 5 personas', 'TOTAL A PAGAR | $198.00']) {
    assert.ok(iguales.includes(esperado), esperado);
  }
});

test('ticket de cobro: marca la cuenta dividida y lo de cada cuenta', () => {
  const lineas = lineasTicketCobro({ idOrden: 4, etiqueta: 'Mesa 1', paraLlevar: false, abiertaPor: 'Tablet 01', cobro: 'Caja', fecha: new Date(),
    productos: [{ cantidad: 1, nombre: 'Tacos Pollo', importe: 20 }], total: 20, recibido: null, cambio: null,
    cuentasDivididas: [{ numero: 1, importe: 10 }, { numero: 2, importe: 10 }] });
  const textos = lineas.map((l) => [l.texto, l.derecha].filter(Boolean).join(' | '));
  assert.ok(textos.includes('CUENTA DIVIDIDA EN 2'));
  assert.ok(textos.includes('Cuenta 2 | $10.00'));
  const sinDividir = lineasTicketCobro({ idOrden: 4, etiqueta: 'Mesa 1', paraLlevar: false, abiertaPor: 'Tablet 01', cobro: 'Caja', fecha: new Date(),
    productos: [], total: 20, recibido: null, cambio: null });
  assert.ok(!sinDividir.some((l) => /DIVIDIDA/.test(l.texto ?? '')));
});
