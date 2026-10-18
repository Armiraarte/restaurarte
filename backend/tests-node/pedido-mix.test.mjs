import assert from 'node:assert/strict';
import test from 'node:test';
import { guardarDetallePedido, itemsValidos } from '../src/detallePedido.ts';
import { lineasTicketCocina, validarTicketCocina } from '../src/ticketCocina.ts';

test('MIX conserva productos, cantidades, precios y opciones; cada envío recibe grupos nuevos', async () => {
  const filas = [];
  const conexion = {
    async query(sql, valores) {
      assert.match(sql, /MAX\(mix_grupo\)/);
      assert.deepEqual(valores, [7]);
      return [[{ ultimo: Math.max(3, ...filas.map((f) => f.mix ?? 0)) }]];
    },
    async execute(sql, v) {
      assert.match(sql, /INSERT INTO orden_has_detalle/);
      const [orden, producto, cantidad, sinQueso, conQueso, carneExtra, mix, opciones, subtotal] = v;
      filas.push({ orden, producto, cantidad, sinQueso, conQueso, carneExtra, mix, opciones: JSON.parse(opciones), subtotal });
      return [{ insertId: filas.length }];
    },
  };
  const productos = new Map([[1, { precio: '15.50' }], [2, { precio: '20.00' }], [3, { precio: '50.00' }]]);
  const complementos = new Map([[1, [{ id: 9, nombre: 'Cebolla' }]]]);
  const items = [
    { idProducto: 1, cantidad: 2, mixGrupo: 1, conQueso: true, sin: [9], mezcla: ['Pollo', 'Barbacoa'] },
    { idProducto: 2, cantidad: 1, mixGrupo: 1 },
    { idProducto: 1, cantidad: 1, mixGrupo: 2 },
    { idProducto: 3, cantidad: 2, carneExtra: 2 },
  ];
  const guardados = await guardarDetallePedido(conexion, 7, items, productos, complementos, new Date());
  assert.equal(filas.length, 4, 'Mismo producto en dos platos sigue siendo dos renglones');
  assert.deepEqual(guardados.map((d) => d.mix_grupo), [4, 4, 5, null]);
  assert.deepEqual(filas.map((d) => d.cantidad), [2, 1, 1, 2]);
  assert.deepEqual(filas.map((d) => d.subtotal), ['31.00', '20.00', '15.50', '180.00']);
  assert.deepEqual(filas[0].opciones, { sin: [{ id: 9, nombre: 'Cebolla' }], mezcla: ['Pollo', 'Barbacoa'] });
  assert.equal(filas[0].conQueso, 1);
  const segundo = await guardarDetallePedido(conexion, 7, [items[0]], productos, complementos, new Date());
  assert.equal(segundo[0].mix_grupo, 6, 'Otro borrador no se incorpora a un MIX de un envío anterior');
});

test('rechaza grupos, cantidades y opciones de tipos incorrectos', () => {
  const base = { idProducto: 1, cantidad: 1 };
  assert.equal(itemsValidos([base, { ...base, mixGrupo: 1, conQueso: true, mezcla: [] }]), true);
  for (const invalido of [null, { ...base, mixGrupo: 0 }, { ...base, mixGrupo: '1' }, { ...base, mixGrupo: 1.5 }, { ...base, conQueso: 'sí' }, { ...base, mezcla: [null] }, { ...base, cantidad: 0 }]) {
    assert.equal(itemsValidos([invalido]), false);
  }
});

test('ticket agrupa un solo plato sin perder modificadores y separa productos sueltos', () => {
  const producto = (nombre, mix, descripcion = []) => ({ nombre, mix_grupo: mix, cantidad: 1, descripcion });
  const ticket = {
    orden_cocina: '#7-1', mesa: 'Mesa 7', enviada_en: '2026-10-18T18:00:00Z',
    productos: [producto('Taco', 4, ['CON QUESO', 'Sin cebolla']), producto('Suelto', null), producto('Sope', 4, ['Sin crema']), producto('Quesadilla', 5, ['NO QUESO'])],
  };
  assert.equal(validarTicketCocina(ticket), null);
  const lineas = lineasTicketCocina(ticket).map((l) => l.texto).filter(Boolean);
  const inicio = lineas.indexOf('MIX 4 · UN SOLO PLATO');
  assert.deepEqual(lineas.slice(inicio, inicio + 6), ['MIX 4 · UN SOLO PLATO', '1x Taco', '  - CON QUESO', '  - Sin cebolla', '1x Sope', '  - Sin crema']);
  assert.ok(lineas.indexOf('1x Suelto') > lineas.indexOf('1x Sope'));
  assert.ok(lineas.includes('MIX 5 · UN SOLO PLATO'));
  assert.equal(lineas.filter((l) => l.includes('UN SOLO PLATO')).length, 2);
  assert.ok(validarTicketCocina({ ...ticket, productos: [producto('Mal', -1)] }));
  assert.equal(lineasTicketCocina({ ...ticket, productos: [producto('Anterior', undefined)] }).some((l) => l.texto?.includes('MIX')), false);
});
