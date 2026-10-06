# Base de datos del restaurante

Esquema inicial para PostgreSQL. Todavía no está conectado a la API ni sustituye
los datos que la aplicación guarda en el navegador.

En una base vacía, ejecutar:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/database/001_initial.sql
```

El archivo se ejecuta una sola vez y dentro de una transacción. No borra tablas
ni incluye usuarios, contraseñas, ventas o productos de demostración.

Los identificadores de texto permiten conservar los IDs actuales al migrar.
Los importes usan decimales exactos y las fechas incluyen zona horaria. Los
productos conservan su configuración de opciones en JSON; las partidas y los
tickets conservan copias históricas de los datos vendidos.

Los totales de cuentas y los acumulados de turnos se calcularán a partir de las
partidas y pagos. La secuencia de pedidos por cuenta se obtiene ordenando los
pedidos por su número; los siguientes son adiciones. El estado de conexión de
una tablet se calculará a partir de su última conexión.

La API deberá validar las opciones y precios del menú, controlar las transiciones
de estado y cobrar dentro de una transacción que bloquee la cuenta y el turno.
El registro del pago y el cambio de estado a pagada deben ser atómicos. El cierre
del turno debe usar el mismo bloqueo para evitar cobros simultáneos al cierre.

Siguientes pasos: configurar PostgreSQL y sus migraciones, persistir usuarios,
conectar el catálogo y después migrar cuentas, comandas, pagos y turnos. Importar
datos del navegador requiere un proceso explícito; no deben reemplazarse con
datos de demostración.
