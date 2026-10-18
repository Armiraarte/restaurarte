import { readFileSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const esDestino = (destino) => destino === 'cocina' || destino === 'caja';
const TERMICA = /axiohm|apos|tsp|star|epson tm|tm-t|pos|ticket|thermal|termica|xprinter|80mm|58mm/i;
const error = (mensaje, status = 400) => Object.assign(new Error(mensaje), { status });

/** La asignación pertenece a la PC que tiene las colas de impresión de Windows. */
export class AsignacionesImpresoras {
  #archivo;
  #preferida;
  #asignaciones = {};
  #guardado = Promise.resolve();

  constructor(archivo, preferida = '') {
    this.#archivo = archivo;
    this.#preferida = preferida;
    try {
      const guardadas = JSON.parse(readFileSync(archivo, 'utf8'));
      for (const destino of ['cocina', 'caja']) {
        if (guardadas[destino] !== undefined) {
          if (guardadas[destino] !== null && (typeof guardadas[destino] !== 'string' || !guardadas[destino].trim())) {
            throw new Error(`La asignación de ${destino} no es válida.`);
          }
          this.#asignaciones[destino] = guardadas[destino];
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  estado(impresoras) {
    const predeterminada = this.#preferida || impresoras.find((i) => TERMICA.test(`${i.nombre} ${i.driver}`))?.nombre || null;
    const asignaciones = {
      cocina: this.#asignaciones.cocina ?? null,
      caja: Object.hasOwn(this.#asignaciones, 'caja')
        ? this.#asignaciones.caja
        : predeterminada === this.#asignaciones.cocina ? null : predeterminada,
    };
    // Las configuraciones anteriores podían guardar la misma impresora en ambos destinos.
    if (asignaciones.cocina === asignaciones.caja) asignaciones.cocina = null;
    const destinos = Object.fromEntries(Object.entries(asignaciones).map(([destino, nombre]) => [
      destino, impresoras.find((i) => i.nombre === nombre) ?? null,
    ]));
    return { impresoras, asignaciones, destinos, ticket: destinos.caja };
  }

  async asignar(destino, nombre, impresoras) {
    if (!esDestino(destino)) throw error('El destino debe ser cocina o caja.');
    if (typeof nombre !== 'string' || !nombre.trim()) throw error('Selecciona una impresora.');
    if (!impresoras.some((i) => i.nombre === nombre)) throw error('La impresora seleccionada no está instalada en Windows.', 404);
    const guardar = this.#guardado.then(async () => {
      const siguientes = { ...this.estado(impresoras).asignaciones, [destino]: nombre };
      const otroDestino = destino === 'cocina' ? 'caja' : 'cocina';
      if (siguientes[otroDestino] === nombre) siguientes[otroDestino] = null;
      await mkdir(path.dirname(this.#archivo), { recursive: true });
      await writeFile(`${this.#archivo}.tmp`, `${JSON.stringify(siguientes, null, 2)}\n`, 'utf8');
      await rename(`${this.#archivo}.tmp`, this.#archivo);
      this.#asignaciones = siguientes;
    });
    this.#guardado = guardar.catch(() => {});
    await guardar;
    return this.estado(impresoras);
  }

  elegir(destino, impresoras) {
    if (!esDestino(destino)) throw error('El destino debe ser cocina o caja.');
    const estado = this.estado(impresoras);
    const impresora = estado.destinos[destino];
    if (!impresora) {
      throw error(estado.asignaciones[destino]
        ? `La impresora asignada a ${destino}, "${estado.asignaciones[destino]}", no está instalada en Windows.`
        : `Asigna una impresora a ${destino} antes de imprimir.`, 404);
    }
    if (!impresora.conectada) throw error(`La impresora de ${destino}, "${impresora.nombre}", está desconectada.`, 409);
    return impresora;
  }
}
