import assert from 'node:assert/strict';
import test from 'node:test';
import { guardarDetallePedido, itemsValidos, terminoPermitido } from '../src/detallePedido.ts';
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
      const [orden, producto, cantidad, sinQueso, conQueso, carneExtra, mix, opciones, subtotal, , , terminoId] = v;
      filas.push({ orden, producto, cantidad, sinQueso, conQueso, carneExtra, mix, terminoId, opciones: JSON.parse(opciones), subtotal });
      return [{ insertId: filas.length }];
    },
  };
  const productos = new Map([[1, { precio: '15.50' }], [2, { precio: '20.00' }], [3, { precio: '50.00' }]]);
  const complementos = new Map([[1, [{ id: 9, nombre: 'Cebolla' }]]]);
  const items = [
    { idProducto: 1, cantidad: 2, mixGrupo: 1, conQueso: true, sin: [9], mezcla: ['Pollo', 'Barbacoa'], terminoId: 3 },
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
  assert.equal(filas[0].terminoId, 3);
  const segundo = await guardarDetallePedido(conexion, 7, [items[0]], productos, complementos, new Date());
  assert.equal(segundo[0].mix_grupo, 6, 'Otro borrador no se incorpora a un MIX de un envío anterior');
});

test('rechaza grupos, cantidades y opciones de tipos incorrectos', () => {
  const base = { idProducto: 1, cantidad: 1 };
  assert.equal(itemsValidos([base, { ...base, mixGrupo: 1, conQueso: true, mezcla: [] }]), true);
  for (const invalido of [null, { ...base, mixGrupo: 0 }, { ...base, mixGrupo: '1' }, { ...base, mixGrupo: 1.5 }, { ...base, conQueso: 'sí' }, { ...base, mezcla: [null] }, { ...base, cantidad: 0 }, { ...base, terminoId: '1' }, { ...base, terminoId: -1 }, { ...base, sinQueso: true, conQueso: true }]) {
    assert.equal(itemsValidos([invalido]), false);
  }
});

test('CON PAPAS cobra el precio del catálogo por pieza y conserva su referencia y precio', async () => {
  const filas = [];
  const conexion = { async execute(sql, valores) { filas.push(valores); return [{ insertId: filas.length }]; } };
  const papas = { idProducto: 77, nombre: 'Papas a la Francesa', tamano: 'Orden completa', precio: 37.5 };
  await guardarDetallePedido(conexion, 1, [
    { idProducto: 1, cantidad: 2, carneExtra: 1, conPapas: true },
    { idProducto: 1, cantidad: 1 },
  ], new Map([[1, { precio: '50.00' }]]), new Map(), new Date(), papas);
  assert.equal(filas[0][8], '215.00'); // 2 × (50 + 20 + 37.50)
  assert.equal(filas[1][8], '50.00');
  assert.deepEqual(JSON.parse(filas[0][7]).papas, papas);
  assert.equal(JSON.parse(filas[1][7]).papas, undefined);
  assert.equal(itemsValidos([{ idProducto: 1, cantidad: 1, conPapas: 'sí' }]), false);
});

test('términos: los tres en Tacos, solo Blando y Medio en Tacos Dorados, ninguno en otras categorías', () => {
  for (const nombre of ['Blando', 'Medio', 'Dorado']) assert.equal(terminoPermitido('Tacos', nombre), true);
  assert.equal(terminoPermitido('Tacos Dorados', 'Blando'), true);
  assert.equal(terminoPermitido('Tacos Dorados', 'Medio'), true);
  assert.equal(terminoPermitido('Tacos Dorados', 'Dorado'), false);
  assert.equal(terminoPermitido('Tacos', undefined), false);
  for (const categoria of ['Sopes', 'Carnes', 'Bebidas', 'Hamburguesas']) assert.equal(terminoPermitido(categoria, 'Medio'), false);
});

test('ticket agrupa un solo plato sin perder modificadores y separa productos sueltos', () => {
  const producto = (nombre, mix, descripcion = []) => ({ nombre, mix_grupo: mix, cantidad: 1, descripcion });
  const ticket = {
    orden_cocina: '#7-1', mesa: 'Mesa 7', enviada_en: '2026-10-18T18:00:00Z',
    productos: [producto('Taco', 4, ['CON QUESO', 'Sin cebolla']), producto('Suelto', null), producto('Sope', 4, ['Sin crema']), producto('Quesadilla', 5, ['SIN QUESO'])],
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
  for (const area of ['cocina', 'bebidas']) {
    const compacto = lineasTicketCocina({ ...ticket, area });
    assert.deepEqual(compacto.at(-1), { texto: '' });
    assert.equal(compacto.filter((l) => l.texto === '').length, 1, 'Solo queda una línea en blanco antes del corte');
    assert.ok(!compacto.some((l) => l.texto === '.'), 'No se imprime una marca que alargue el papel');
  }
});
