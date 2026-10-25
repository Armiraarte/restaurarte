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

test('copia el nombre, complementos y origen para reimprimir sin depender de cambios del menú', async () => {
  let opciones;
  const conexion = { async execute(sql, valores) { opciones = JSON.parse(valores[7]); return [{ insertId: 1 }]; } };
  const p = { nombre: 'Res', tamano: null, categoria: 'Hamburguesas', precio: 50 };
  const ofrecidos = [{ id: 1, nombre: 'Cebolla' }];
  await guardarDetallePedido(conexion, 1, [{ idProducto: 1, cantidad: 1 }], new Map([[1, p]]), new Map([[1, ofrecidos]]), new Date(), null, new Map(), 'Tablet 02');
  assert.deepEqual(opciones.comanda, { origen: 'Tablet 02', producto: { nombre: 'Res', tamano: null, categoria: 'Hamburguesas' }, ofrecidos });
});

test('el papel usa las mismas abreviaturas de Cocina y conserva piezas y modificadores', () => {
  const ticket = { orden_cocina: '#1-1', mesa: 'Mesa 2', productos: [
    { categoria: 'Tacos Dorados', nombre: 'Tacos Dorados · Papa', cantidad: 2, descripcion: ['SIN CHILE, CEBOLLA'] },
    { categoria: 'Hamburguesas', nombre: 'Hamburguesas · Res', cantidad: 1, descripcion: ['DOBLE CARNE'] },
    { categoria: 'Carnes', nombre: 'Carnes · Milanesa', cantidad: 1, descripcion: [] },
    { categoria: 'Alitas', nombre: 'Alitas · MIXTAS', cantidad: 10, reparto: [{ opcion: 'BBQ', cantidad: 4 }, { opcion: 'Buffalo', cantidad: 6 }], descripcion: ['4 BBQ', '6 Buffalo'] },
  ] };
  const textos = lineasTicketCocina(ticket).map((l) => l.texto).filter(Boolean);
  for (const texto of ['2 T Papa', '1 Ham Res', '1 Milanesa', '4 BBQ', '6 Buffalo', '  - SIN CHILE, CEBOLLA', '  - DOBLE CARNE']) assert.ok(textos.includes(texto), texto);
  assert.equal(textos.some((t) => t.includes('Alitas') || t.includes('Hamburguesas') || t.includes('Carnes')), false);
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
  // El MIX solo agrupa: sin número ni leyenda; la cantidad va sin «x».
  const inicio = lineas.indexOf('MIX');
  assert.deepEqual(lineas.slice(inicio, inicio + 6), ['MIX', '1 Taco', '  - CON QUESO', '  - Sin cebolla', '1 Sope', '  - Sin crema']);
  assert.ok(lineas.indexOf('1 Suelto') > lineas.indexOf('1 Sope'));
  assert.equal(lineas.filter((l) => l === 'MIX').length, 2);
  assert.ok(!lineas.some((l) => /UN SOLO PLATO|^d+x /.test(l)));
  assert.ok(!lineas.some((l) => /MIX \d/.test(l)));
  assert.ok(validarTicketCocina({ ...ticket, productos: [producto('Mal', -1)] }));
  assert.equal(lineasTicketCocina({ ...ticket, productos: [producto('Anterior', undefined)] }).some((l) => l.texto?.includes('MIX')), false);
  for (const area of ['cocina', 'bebidas']) {
    const compacto = lineasTicketCocina({ ...ticket, area });
    assert.deepEqual(compacto.at(-1), { texto: '' });
    assert.equal(compacto.filter((l) => l.texto === '').length, 1, 'Solo queda una línea en blanco antes del corte');
    assert.ok(!compacto.some((l) => l.texto === '.'), 'No se imprime una marca que alargue el papel');
  }
});

test('MEZCLAR (Alitas): un solo renglón con las piezas de cada sabor', async () => {
  const filas = [];
  const conexion = { async execute(sql, v) { filas.push({ cantidad: v[2], opciones: JSON.parse(v[7]), subtotal: v[8] }); return [{ insertId: filas.length }]; } };
  const reparto = [{ nombre: 'BBQ', cantidad: 4 }, { nombre: 'Buffalo', cantidad: 6 }];
  const item = { idProducto: 50, cantidad: 10, mezcla: ['BBQ', 'Buffalo'], reparto };
  assert.equal(itemsValidos([item]), true);
  await guardarDetallePedido(conexion, 1, [item], new Map([[50, { precio: '13.00' }]]), new Map(), new Date());
  assert.equal(filas.length, 1);
  assert.equal(filas[0].cantidad, 10);
  assert.equal(filas[0].subtotal, '130.00');
  assert.deepEqual(filas[0].opciones.reparto, reparto);
  // Las piezas deben sumar la cantidad; cada sabor una vez, con piezas; al menos dos sabores.
  for (const malo of [
    [{ nombre: 'BBQ', cantidad: 4 }, { nombre: 'Buffalo', cantidad: 5 }],
    [{ nombre: 'BBQ', cantidad: 5 }, { nombre: 'BBQ', cantidad: 5 }],
    [{ nombre: 'BBQ', cantidad: 10 }, { nombre: 'Buffalo', cantidad: 0 }],
    [{ nombre: 'BBQ', cantidad: 10 }],
    [{ nombre: '', cantidad: 4 }, { nombre: 'Buffalo', cantidad: 6 }],
    'BBQ',
  ]) assert.equal(itemsValidos([{ ...item, reparto: malo }]), false);
});

test('MIXTAS en cualquier categoría: cada pieza a su precio, con lo extra en todas y los complementos de todos los sabores', async () => {
  const filas = [];
  const conexion = { async execute(sql, v) { filas.push({ cantidad: v[2], opciones: JSON.parse(v[7]), subtotal: v[8] }); return [{ insertId: filas.length }]; } };
  // Lonches: 2 Mixto ($70) + 3 Jamón ($50), con papas ($30) y EXTRA chile ($1) en cada pieza.
  const reparto = [{ nombre: 'Mixto', cantidad: 2 }, { nombre: 'Jamón', cantidad: 3 }];
  const item = { idProducto: 70, cantidad: 5, mezcla: ['Mixto', 'Jamón'], reparto, conPapas: true, sin: [4], complementosExtra: [5] };
  assert.equal(itemsValidos([item]), true);
  const complementos = new Map([[70, [{ id: 4, nombre: 'Cebolla' }]], [50, [{ id: 4, nombre: 'Cebolla' }, { id: 5, nombre: 'Chile' }]]]);
  const sabores = new Map([[item, [{ id: 70, precio: 70 }, { id: 50, precio: 50 }]]]);
  const papas = { idProducto: 77, nombre: 'Papas a la Francesa', tamano: 'Orden completa', precio: 30 };
  await guardarDetallePedido(conexion, 1, [item], new Map([[70, { precio: '70.00' }]]), complementos, new Date(), papas, sabores);
  assert.equal(filas[0].subtotal, '445.00'); // 2 × 70 + 3 × 50 + 5 × (30 + 1)
  assert.deepEqual(filas[0].opciones.reparto, [{ nombre: 'Mixto', cantidad: 2, precio: 70 }, { nombre: 'Jamón', cantidad: 3, precio: 50 }]);
  assert.deepEqual(filas[0].opciones.sin, [{ id: 4, nombre: 'Cebolla' }]);
  assert.deepEqual(filas[0].opciones.complementosExtra, [{ id: 5, nombre: 'Chile' }], 'El EXTRA de otro sabor de la mezcla también cuenta');
});

test('complementos EXTRA: cada uno cobra $1 por pieza y queda guardado con su nombre', async () => {
  const filas = [];
  const conexion = { async execute(sql, v) { filas.push({ opciones: JSON.parse(v[7]), subtotal: v[8] }); return [{ insertId: filas.length }]; } };
  const complementos = new Map([[28, [{ id: 1, nombre: 'Crema' }, { id: 2, nombre: 'Queso' }, { id: 3, nombre: 'Salsa' }]]]);
  const item = { idProducto: 28, cantidad: 3, sin: [3], complementosExtra: [1, 2] };
  assert.equal(itemsValidos([item]), true);
  await guardarDetallePedido(conexion, 1, [item, { idProducto: 28, cantidad: 2 }], new Map([[28, { precio: '15.00' }]]), complementos, new Date());
  assert.equal(filas[0].subtotal, '51.00'); // 3 × (15 + 2 × 1)
  assert.deepEqual(filas[0].opciones.complementosExtra, [{ id: 1, nombre: 'Crema' }, { id: 2, nombre: 'Queso' }]);
  assert.deepEqual(filas[0].opciones.sin, [{ id: 3, nombre: 'Salsa' }]);
  assert.equal(filas[1].subtotal, '30.00');
  assert.equal(filas[1].opciones.complementosExtra, undefined);
  // Un complemento no puede ir quitado y EXTRA a la vez; IDs válidos y sin repetir.
  for (const malo of [[3], [1, 1], ['1'], [0], 'Crema']) assert.equal(itemsValidos([{ ...item, complementosExtra: malo }]), false);
});

test('comentario del platillo: se guarda limpio en el renglón y se rechaza vacío o muy largo', async () => {
  const filas = [];
  const conexion = { async execute(sql, v) { filas.push({ opciones: JSON.parse(v[7]) }); return [{ insertId: filas.length }]; } };
  const item = { idProducto: 1, cantidad: 1, nota: '  bien   dorada, partida a la mitad ' };
  assert.equal(itemsValidos([item]), true);
  await guardarDetallePedido(conexion, 1, [item, { idProducto: 1, cantidad: 1 }], new Map([[1, { precio: '15.00' }]]), new Map(), new Date());
  assert.equal(filas[0].opciones.nota, 'bien dorada, partida a la mitad');
  assert.equal(filas[1].opciones.nota, undefined);
  for (const mala of ['', '   ', 'x'.repeat(201), 5]) assert.equal(itemsValidos([{ ...item, nota: mala }]), false);
});

test('comanda: sin logo ni fecha, el número de orden arriba y chico, la mesa y PARA LLEVAR en grande', () => {
  const ticket = {
    orden_cocina: '#00012-2', mesa: 'Mesa 9', para_llevar: true, tablet: 'Tablet 01', enviada_en: '2026-10-24T02:00:00Z',
    productos: [{ nombre: 'Tacos · Pollo', cantidad: 2, descripcion: ['CON TODO'] }],
  };
  const lineas = lineasTicketCocina(ticket);
  assert.ok(!lineas.some((l) => l.imagen), 'Sin logo');
  assert.ok(!lineas.some((l) => /CON TODO/i.test(l.texto ?? '')), 'Con todo no agrega texto al papel');
  assert.equal(lineas[0].texto, 'Orden cocina #00012-2 · Tablet 01');
  assert.ok(!lineas[0].grande && !lineas[0].escala, 'El número de orden va arriba, en letra normal');
  assert.deepEqual(lineas[1], { texto: 'Mesa 9', grande: true, escala: 1.6 });
  assert.deepEqual(lineas[2], { texto: 'PARA LLEVAR', grande: true, escala: 1.3 });
  assert.deepEqual(lineas[3], { separador: true }, 'Sin fecha: después va la raya');
  assert.ok(!lineas.some((l) => /\d{2}\/\d{2}\/\d{4}/.test(l.texto ?? '')), 'Sin fecha en ninguna línea');
  // Comer aquí: no se escribe nada (ni PARA LLEVAR ni COMER AQUÍ); bebidas: el número en negritas.
  const aqui = lineasTicketCocina({ ...ticket, para_llevar: false });
  assert.deepEqual(aqui.slice(0, 3).map((l) => l.texto ?? '—'), ['Orden cocina #00012-2 · Tablet 01', 'Mesa 9', '—']);
  assert.ok(!aqui.some((l) => /PARA LLEVAR|COMER AQU/i.test(l.texto ?? '')));
  assert.equal(lineasTicketCocina({ ...ticket, para_llevar: false, area: 'bebidas' })[0].negrita, true);
});
