import assert from 'node:assert/strict';
import test from 'node:test';
import { extrasValidos, guardarExtrasPedido, recalcularTotalOrden } from '../src/extrasPedido.ts';
import { lineasTicketCobro } from '../src/ticketCobro.ts';
import { lineasTicketCocina, validarTicketCocina } from '../src/ticketCocina.ts';

test('valida cobros libres y rechaza importes negativos, fracciones de centavo y descripciones vacías', () => {
  assert.equal(extrasValidos([{ descripcion: 'Servicio adicional', importe: 12.5 }, { descripcion: 'Otro', importe: 0.01 }]), true);
  for (const e of [null, { descripcion: '', importe: 10 }, { descripcion: ' ', importe: 10 }, { descripcion: 'Extra', importe: 0 }, { descripcion: 'Extra', importe: -10 }, { descripcion: 'Extra', importe: 1.001 }, { descripcion: 'Extra', importe: '10' }, { descripcion: 'Extra', importe: Infinity }]) {
    assert.equal(extrasValidos([e]), false);
  }
});

test('guarda extras sin crear productos y recalcula total con productos más cargos', async () => {
  const sql = [];
  const conexion = { async execute(consulta, valores) { sql.push({ consulta, valores }); return [{ insertId: sql.length }]; } };
  const fecha = new Date('2026-10-18T20:00:00Z');
  const guardados = await guardarExtrasPedido(conexion, 7, [{ descripcion: '  Cargo   adicional ', importe: 10.25 }, { descripcion: 'Empaque', importe: 0.1 }], fecha);
  await recalcularTotalOrden(conexion, 7, fecha);
  assert.ok(sql.slice(0,2).every(s => s.consulta.startsWith('INSERT INTO orden_extra')));
  assert.deepEqual(sql.slice(0,2).map(s => s.valores.slice(0,3)), [[7,'Cargo adicional','10.25'],[7,'Empaque','0.10']]);
  assert.equal(guardados[0].importe, 10.25);
  assert.match(sql[2].consulta, /SUM\(subtotal\).*orden_has_detalle/s);
  assert.match(sql[2].consulta, /SUM\(importe\).*orden_extra/s);
  assert.deepEqual(sql[2].valores, [7,7,fecha,7]);
});

test('extras aparecen en el cobro después de productos y antes del total; también sin productos', () => {
  const extras = [{ descripcion: 'Cargo adicional', importe: 12.5 }];
  const datos = { idOrden:7, etiqueta:'Mesa 7', paraLlevar:false, abiertaPor:'Caja', cobro:'Caja', fecha:new Date(), productos:[{ cantidad:1,nombre:'Producto',importe:20 }], extras,total:32.5,recibido:null,cambio:null };
  const cobro = lineasTicketCobro(datos);
  assert.ok(cobro.findIndex(l => l.texto === '1  Producto') < cobro.findIndex(l => l.texto === 'EXTRAS'));
  const extra = cobro.findIndex(l => l.texto === 'Cargo adicional');
  assert.equal(cobro[extra].derecha, '$12.50');
  assert.ok(extra < cobro.findIndex(l => l.texto === 'TOTAL'));
  assert.ok(lineasTicketCobro({...datos,productos:[],total:12.5}).some(l => l.texto === 'Cargo adicional'));
});

test('la comanda de cocina imprime los cobros extra al final, con o sin productos', () => {
  const extras = [{ descripcion: 'Cargo adicional', importe: 12.5 }];
  const ticket = {orden_cocina:'#7-1',mesa:'Mesa 7',enviada_en:new Date().toISOString(),productos:[{nombre:'Tacos · Frijol',cantidad:2,descripcion:['CON TODO']}],extras};
  assert.equal(validarTicketCocina(ticket), null);
  const lineas = lineasTicketCocina(ticket);
  const producto = lineas.findIndex(l => l.texto === '2 Tacos · Frijol');
  const titulo = lineas.findIndex(l => l.texto === 'EXTRAS');
  assert.ok(producto >= 0 && titulo > producto, 'EXTRAS va después de los productos');
  assert.ok(lineas.some(l => l.texto === 'Cargo adicional' && l.derecha === '$12.50'));
  // Un envío con solo extras también sale en cocina.
  const soloExtras = { ...ticket, productos: [] };
  assert.equal(validarTicketCocina(soloExtras), null);
  assert.ok(lineasTicketCocina(soloExtras).some(l => l.texto === 'Cargo adicional'));
  assert.ok(validarTicketCocina({ ...soloExtras, extras: [] }), 'Sin productos ni extras no hay comanda');
  assert.ok(validarTicketCocina({ ...ticket, extras: [{ descripcion: 'Extra', importe: -1 }] }));
});

test('un extra agregado dentro de un MIX sale justo debajo de ese MIX; los demás, al final', () => {
  const producto = (nombre, mix) => ({ nombre, mix_grupo: mix, cantidad: 1, descripcion: [] });
  const ticket = {
    orden_cocina: '#7-1', mesa: 'Mesa 7', enviada_en: new Date().toISOString(),
    productos: [producto('Tostadas · Pierna', 3), producto('Tacos · Pollo', null)],
    extras: [{ descripcion: 'Queso extra', importe: 10, mix_grupo: 3 }, { descripcion: 'Desechables', importe: 5 }, { descripcion: 'De un MIX sin productos', importe: 2, mix_grupo: 9 }],
  };
  assert.equal(validarTicketCocina(ticket), null);
  const textos = lineasTicketCocina(ticket).map((l) => l.texto).filter(Boolean);
  const mix = textos.indexOf('MIX');
  assert.deepEqual(textos.slice(mix, mix + 3), ['MIX', '1 Tostadas · Pierna', '+ Queso extra']);
  const final = textos.indexOf('EXTRAS');
  assert.ok(final > textos.indexOf('1 Tacos · Pollo'));
  assert.deepEqual(textos.slice(final + 1), ['Desechables', 'De un MIX sin productos']);
  assert.ok(validarTicketCocina({ ...ticket, extras: [{ descripcion: 'X', importe: 1, mix_grupo: 0 }] }));
});
