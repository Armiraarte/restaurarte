// Proceso de impresión permanente (servidor-impresion.ps1): uno por impresora (cocina y caja), así los dos tickets
// de un pedido salen al mismo tiempo. Arranca una vez (carga System.Drawing y compila escpos.cs) y luego cada
// ticket solo se dibuja y se envía. Los trabajos de una misma impresora van en fila. Si el proceso se cae o no
// responde a tiempo, se reinicia solo en el siguiente ticket.
import { spawn } from 'node:child_process';
import readline from 'node:readline';

const ARRANQUE_MS = 60_000;

/** JSON solo con ASCII (los acentos van como \uXXXX): así no importa la codificación de la consola de Windows. */
const jsonAscii = (datos) => JSON.stringify(datos).replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

export class TrabajadorImpresion {
  #nombre;
  #script;
  #proceso = null;
  #listo = null;
  #pendientes = new Map();
  #siguiente = 1;
  #fila = Promise.resolve();

  constructor(nombre, script) {
    this.#nombre = nombre;
    this.#script = script;
  }

  /** Arranca el proceso si no está corriendo; se resuelve cuando ya puede imprimir. */
  preparar() {
    if (this.#listo) return this.#listo;
    const proceso = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', this.#script],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    this.#proceso = proceso;
    let errores = '';
    proceso.stderr.on('data', (d) => {
      errores = (errores + d.toString('utf8')).slice(-2000);
    });
    const lector = readline.createInterface({ input: proceso.stdout });

    this.#listo = new Promise((resolve, reject) => {
      const tiempo = setTimeout(() => {
        reject(new Error(`El proceso de impresión de ${this.#nombre} no arrancó a tiempo.`));
        proceso.kill();
      }, ARRANQUE_MS);

      lector.on('line', (linea) => {
        let msg;
        try {
          msg = JSON.parse(linea);
        } catch {
          return; // otra salida de PowerShell: se ignora
        }
        if (msg.listo) {
          clearTimeout(tiempo);
          resolve();
          return;
        }
        const pendiente = this.#pendientes.get(msg.id);
        if (!pendiente) return;
        this.#pendientes.delete(msg.id);
        clearTimeout(pendiente.tiempo);
        if (msg.ok) pendiente.resolve();
        else pendiente.reject(Object.assign(new Error(msg.error || 'No se pudo imprimir.'), { status: 500 }));
      });

      const terminar = (motivo) => {
        clearTimeout(tiempo);
        const err = new Error(`El proceso de impresión de ${this.#nombre} se cerró (${motivo}). ${errores.trim().slice(-300)}`.trim());
        reject(err);
        for (const p of this.#pendientes.values()) {
          clearTimeout(p.tiempo);
          p.reject(err);
        }
        this.#pendientes.clear();
        if (this.#proceso === proceso) {
          this.#proceso = null;
          this.#listo = null;
        }
      };
      proceso.on('exit', (codigo) => terminar(`código ${codigo}`));
      proceso.on('error', (err) => terminar(err.message));
    });
    this.#listo.catch(() => {}); // quien lo use recibe el error; aquí solo se evita el aviso de promesa sin atender
    return this.#listo;
  }

  /**
   * Imprime un trabajo ({ modo, ticket, salidaRaw? }). Uno a la vez por impresora.
   * Si el proceso no arranca, se rechaza con `sinProceso` para que el agente use el método anterior.
   */
  imprimir(trabajo, tiempoMs = 30_000) {
    const tarea = this.#fila.then(async () => {
      try {
        await this.preparar();
      } catch (err) {
        throw Object.assign(err, { sinProceso: true });
      }
      const id = this.#siguiente++;
      return new Promise((resolve, reject) => {
        const tiempo = setTimeout(() => {
          this.#pendientes.delete(id);
          reject(Object.assign(new Error('La impresora no respondió a tiempo.'), { status: 504 }));
          this.#proceso?.kill(); // se vuelve a arrancar limpio en el siguiente ticket
        }, tiempoMs);
        this.#pendientes.set(id, { resolve, reject, tiempo });
        this.#proceso.stdin.write(`${jsonAscii({ id, ...trabajo })}\n`);
      });
    });
    this.#fila = tarea.catch(() => {});
    return tarea;
  }

  cerrar() {
    this.#proceso?.stdin.end();
  }
}
