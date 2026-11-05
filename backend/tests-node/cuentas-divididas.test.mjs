import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calcularCuentasDivididas, divisionVigente, guardarCuentasDivididas, reconciliarDivision, revisarCobroCuenta, validarSolicitudDivision,
} from '../src/cuentasDivididas.ts';
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
  assert.ok(!iguales.some((t) => /Efectivo|Cambio|PAGADA/.test(t)), 'Sin cobro no lleva efectivo ni cambio');

  // Al cobrar esa cuenta en Cajas: PAGADA, quién cobró, efectivo y cambio.
  const cobrada = textos(lineasTicketCuentaDividida({ ...base, cuenta: { numero: 2, personas: 3, modo: 'iguales', importe: 71, total_orden: 213, productos: [], extras: [] },
    cobro: { cobro: 'Ana', recibido: 100, cambio: 29 } }));
  for (const esperado of ['CUENTA 2 DE 3 · PAGADA', 'Atendió: Tablet 01 | Cobró: Ana', 'TOTAL A PAGAR | $71.00', 'Efectivo | $100.00', 'Cambio | $29.00']) {
    assert.ok(cobrada.includes(esperado), esperado);
  }

  // Orden cobrada completa (sin cobrar por cuenta): al reimprimir, cada cuenta dice PAGADA sin efectivo ni cambio.
  const pagadaCompleta = textos(lineasTicketCuentaDividida({ ...base, cuenta: { numero: 1, personas: 3, modo: 'iguales', importe: 71, total_orden: 213, productos: [], extras: [] },
    cobro: { cobro: null, recibido: null, cambio: null } }));
  assert.ok(pagadaCompleta.includes('CUENTA 1 DE 3 · PAGADA'));
  assert.ok(pagadaCompleta.includes('Atendió: Tablet 01'), 'Sin «Cobró» si no se sabe quién');
  assert.ok(!pagadaCompleta.some((t) => /Efectivo|Cambio/.test(t)));
});

test('quitar algo de una cuenta dividida: se descuenta de la cuenta que lo tenía', () => {
  const lonche = renglon({ idDetalle_Orden: 1, categoria: 'Lonches', nombre: 'Mixto', cantidad: 1, subtotal: 70 });
  const sopes = renglon({ idDetalle_Orden: 2, categoria: 'Sopes', nombre: 'Queso', cantidad: 4, subtotal: 60 });
  const cocas = renglon({ idDetalle_Orden: 3, categoria: 'Bebidas', nombre: 'Coca Zero', cantidad: 4, subtotal: 120 });
  const antes = { total: 250, detalle: [lonche, sopes, cocas], extras: [] };
  const guardar = (asignadas, modo = 'productos', personas = 2, orden = antes) =>
    calcularCuentasDivididas(orden, { modo, personas, asignadas }).cuentas
      .map((c) => ({ ...c, creado_por: 'Tablet 04', creado_en: '2026-11-05T05:52:13.000Z', recibido: null, cobrada_por: null, pagada_en: null }));
  // Cuenta 1: lonche, 2 sopes y 1 coca ($130). Cuenta 2: 2 sopes y 3 cocas ($120).
  const cuentas = guardar({ '1-0': 0, '2-0': 0, '2-1': 0, '3-0': 0, '2-2': 1, '2-3': 1, '3-1': 1, '3-2': 1, '3-3': 1 });
  assert.deepEqual(cuentas.map((c) => c.importe), [130, 120]);
  assert.equal(reconciliarDivision(antes, cuentas), null, 'Si sigue cuadrando no se toca');

  const sinLonche = reconciliarDivision({ total: 180, detalle: [sopes, cocas], extras: [] }, cuentas);
  assert.deepEqual(sinLonche.map((c) => [c.numero, c.importe]), [[1, 60], [2, 120]], 'Solo baja la cuenta que tenía el lonche');
  assert.deepEqual(sinLonche[0].productos, [{ cantidad: 2, nombre: 'Sopes Queso', importe: 30 }, { cantidad: 1, nombre: 'Bebidas Coca Zero', importe: 30 }]);
  assert.equal(sinLonche[0].total_orden, 180);

  const soloCocas = reconciliarDivision({ total: 120, detalle: [cocas], extras: [] }, cuentas);
  assert.deepEqual(soloCocas.map((c) => [c.numero, c.personas, c.importe]), [[1, 2, 30], [2, 2, 90]]);

  // Se quita parte de un producto compartido: lo que queda es de las primeras cuentas.
  const dosSopes = renglon({ ...sopes, cantidad: 2, subtotal: 30 });
  assert.deepEqual(reconciliarDivision({ total: 220, detalle: [lonche, dosSopes, cocas], extras: [] }, cuentas).map((c) => c.importe), [130, 90]);

  // Como Mesa 1: la Cuenta 1 tenía justo lo que se quitó; queda una sola cuenta y la orden deja de estar dividida.
  const mesa1 = guardar({ '1-0': 0, '2-0': 0, '2-1': 0, '2-2': 0, '2-3': 1, '3-0': 1, '3-1': 1, '3-2': 1, '3-3': 1 });
  assert.deepEqual(mesa1.map((c) => c.importe), [115, 135]);
  assert.deepEqual(reconciliarDivision({ total: 120, detalle: [cocas], extras: [] }, mesa1), []);

  // Tres cuentas y una se queda vacía: quedan dos, numeradas 1 y 2.
  const tres = guardar({ '1-0': 0, '2-0': 1, '2-1': 1, '2-2': 1, '2-3': 1, '3-0': 2, '3-1': 2, '3-2': 2, '3-3': 2 }, 'productos', 3);
  assert.deepEqual(reconciliarDivision({ total: 180, detalle: [sopes, cocas], extras: [] }, tres).map((c) => [c.numero, c.personas, c.importe]), [[1, 2, 60], [2, 2, 120]]);

  // Partes iguales: el nuevo total entre las mismas personas.
  const iguales = guardar(undefined, 'iguales', 3);
  assert.deepEqual(reconciliarDivision({ total: 100, detalle: [cocas], extras: [] }, iguales).map((c) => c.importe), [33.34, 33.33, 33.33]);

  // No se toca: con una cuenta cobrada, o si la orden tiene algo que no era de nadie.
  assert.equal(reconciliarDivision({ total: 180, detalle: [sopes, cocas], extras: [] }, [{ ...cuentas[0], pagada_en: '2026-11-05T06:00:00Z' }, cuentas[1]]), null);
  const nuevo = renglon({ idDetalle_Orden: 9, categoria: 'Tacos', nombre: 'Pollo', cantidad: 1, subtotal: 18 });
  assert.equal(reconciliarDivision({ total: 198, detalle: [sopes, cocas, nuevo], extras: [] }, cuentas), null);
});

test('cobrar una cuenta dividida: solo en Cajas, con la división vigente, una vez y con efectivo suficiente', () => {
  const cuenta = (numero, importe, pagada_en = null) => ({ numero, personas: 3, modo: 'iguales', importe, total_orden: 100, productos: [], extras: [],
    creado_por: 'Tablet 01', creado_en: '', recibido: pagada_en ? importe : null, cobrada_por: pagada_en ? 'Ana' : null, pagada_en });
  const cuentas = [cuenta(1, 33.34), cuenta(2, 33.33), cuenta(3, 33.33)];
  const enCajas = { estatus: 1, total: 100 };

  const ok = revisarCobroCuenta(enCajas, cuentas, 2, 50);
  assert.equal(ok.cuenta.numero, 2);
  assert.equal(ok.cambio, 16.67);
  assert.equal(ok.ultima, false);
  assert.equal(revisarCobroCuenta(enCajas, cuentas, 1, 33.34).cambio, 0, 'Exacto');

  assert.deepEqual(revisarCobroCuenta(enCajas, cuentas, 2, 33.32), { status: 400, error: 'El monto recibido debe ser de al menos $33.33.' });
  assert.equal(revisarCobroCuenta(enCajas, cuentas, 4, 50).status, 404);
  assert.equal(revisarCobroCuenta({ estatus: 0, total: 100 }, cuentas, 1, 50).status, 409);
  assert.match(revisarCobroCuenta({ estatus: 2, total: 100 }, cuentas, 1, 50).error, /ya está pagada/);
  assert.match(revisarCobroCuenta({ estatus: 1, total: 120 }, cuentas, 1, 50).error, /cambió después de dividirla/);

  const dosPagadas = [cuenta(1, 33.34, '2026-11-05T03:00:00Z'), cuenta(2, 33.33), cuenta(3, 33.33, '2026-11-05T03:05:00Z')];
  assert.match(revisarCobroCuenta(enCajas, dosPagadas, 1, 50).error, /Cuenta 1 ya se cobró/);
  assert.equal(revisarCobroCuenta(enCajas, dosPagadas, 2, 50).ultima, true, 'La última que falta deja la orden pagada');
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
