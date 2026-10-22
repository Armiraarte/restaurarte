# Base de datos: Laravel, MySQL y phpMyAdmin

Laravel está instalado en `backend/` para construir la base por etapas. Las
migraciones definen las tablas, los modelos Eloquent representan sus registros
y los seeders cargan datos iniciales mediante clases PHP.

La conexión se configura en `backend/.env`. El servidor del proyecto está en
`2.25.84.101:3306`, según la dirección indicada en `db/config.local.php`.
Las credenciales de ese archivo pertenecen a otro proyecto; Laravel usa el
usuario `sistemas_armirarte` y la base `restaurante_diablillos`.

## Entorno local

Este proyecto usa PHP 8.4 o superior y Composer. En Windows están preparados
en `.tools/`, separados del PHP que utiliza Apache en XAMPP. Los wrappers
`artisan.ps1` y `composer.ps1` seleccionan ese PHP automáticamente.

Para preparar otra computadora Windows, desde `backend/`:

```powershell
.\scripts\setup-php.ps1
.\composer.ps1 install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
.\artisan.ps1 key:generate
```

Configura los valores reales en `backend/.env`:

```dotenv
DB_CONNECTION=mysql
DB_HOST=2.25.84.101
DB_PORT=3306
DB_DATABASE=restaurante_diablillos
DB_USERNAME=sistemas_armirarte
DB_PASSWORD=
```

Agrega la contraseña privada a `DB_PASSWORD` entre comillas dobles para conservar
caracteres como `#`. `backend/.env`, `db/config.local.php` y el SQL privado de
acceso están excluidos de Git. En sistemas con PHP 8.4+ configurado directamente,
puedes usar los comandos habituales `php artisan` y `composer`.

## 1. Crear la base vacía

Con MySQL disponible en el servidor, ejecuta:

```powershell
.\artisan.ps1 db:create
```

`App\Console\Commands\CreateDatabase` crea la base configurada con UTF-8
(`utf8mb4`). Si ya existe, la conserva. No ejecuta migraciones ni seeders.
También admite `--connection=mysql` para elegir una conexión definida en
`config/database.php`.

Para verla, abre [phpMyAdmin del servidor](http://2.25.84.101:8080/).

### Acceso desde esta computadora

MySQL distingue las cuentas por usuario y origen. Una cuenta
`sistemas_armirarte@localhost` permite conexiones originadas en el propio
servidor. Para usar Laravel desde esta computadora, debe existir una cuenta
autorizada para su IP pública y tener permisos sobre `restaurante_diablillos`.

La conexión desde `189.196.194.42` está habilitada y la cuenta tiene permisos
sobre `restaurante_diablillos`. Está preparado `server-access.local.sql`, con
la contraseña privada, para que un administrador pueda configurar ese acceso
en el servidor cuando sea necesario. Si cambia la IP pública de esta
computadora, el origen autorizado debe ajustarse en MySQL.

Referencia: [cuentas y hosts en MySQL](https://dev.mysql.com/doc/refman/8.0/en/account-names.html).

## 2. Crear las tablas con migraciones

La primera migración está en
`migrations/2026_10_07_000001_create_usuarios_table.php`; crea `usuarios` con los
campos que utiliza la aplicación: ID de texto, usuario único, nombre, rol,
hash de contraseña, tipo de acceso, estado activo y fechas. El modelo es
`App\Models\Usuario` y conserva los IDs actuales, como `u-admin`.

La segunda migración, `migrations/2026_10_07_000002_create_tablets_table.php`,
crea `tablets` vinculada a `usuarios`:

| Columna | Uso |
| --- | --- |
| `id` | Texto, mismo formato que la app: `tablet-01` (se genera del número). |
| `usuario_id` | Cuenta con la que inicia sesión la tablet → `usuarios.id`. Única: una cuenta por tablet. No se puede borrar un usuario con tablet vinculada (se desactiva con `activo = false`). |
| `creado_por` | Administrador que la dio de alta → `usuarios.id` (rol `admin`). |
| `numero` / `nombre` | `01` (único) / `Tablet 01`: siempre se forma con el número y es también el nombre de su usuario. |
| `ubicacion` | Salón, terraza, etc. |
| `mesero` | Mesero en sesión; texto hasta que exista la tabla de meseros. |
| `sesion_iniciada_en`, `ultima_conexion`, `ip` | Sesión y último latido (`/api/tablets/latido`). |
| `activa`, `creado_en`, `actualizado_en` | Estado y fechas. |

El modelo `App\Models\Tablet` solo acepta usuarios con rol `tablet` (y un `admin`
en `creado_por`) y expone `$tablet->usuario` y `$tablet->creadoPor`; en
`App\Models\Usuario`, `$usuario->tablet` y `$usuario->tabletsRegistradas`.

**Alta desde la aplicación.** La API de Node (`src/usuarios.ts`) usa esta misma
base: lee `DB_*` de `backend/.env`. Al crear una tablet en Configuración →
Usuarios inserta, en una sola transacción, la fila de `usuarios` y la de
`tablets` con `creado_por` = administrador en sesión. Cada latido de la tablet
actualiza `ultima_conexion`, `ip` y `mesero` (como máximo cada 30 s si nada cambia).
Las contraseñas se guardan con prefijo `$2y$` para que también las valide Laravel.

**Datos anteriores.** Los usuarios creados antes de conectar MySQL quedaron en
`data/usuarios.json`. Para pasarlos (con su tablet) a la base:

```powershell
.\artisan.ps1 pos:importar-usuarios-json
```

Se puede repetir: lo que ya existe no se duplica.

La tabla `usuarios` está creada en `restaurante_diablillos`. Para aplicar las
siguientes migraciones y consultar su estado:

```powershell
.\artisan.ps1 migrate
.\artisan.ps1 migrate:status
```

Para generar el modelo, la migración y el seeder de la siguiente tabla:

```powershell
.\artisan.ps1 make:model Producto --migration --seed
```

Completa los campos y relaciones antes de ejecutar la nueva migración. Para
cambiar una tabla ya creada, agrega una migración nueva.

### Mesas: número o nombre, servicio y total

La migración `2026_10_09_000003_create_mesas_table.php` crea `mesas`; la siguiente,
`2026_10_09_000004_catalogar_tipos_venta_y_estatus_de_mesas.php`, reemplaza los
indicadores anteriores por `tipo_venta_id` y `estatus`, conservando los registros.
`2026_10_09_000005_autoincrementar_id_y_agregar_codigo_a_mesas.php` convierte
el ID a autoincrementable y copia el número o nombre existente a `codigo`.
El modelo `App\Models\Mesa` permite crear y actualizar sus registros:

| Columna | Uso |
| --- | --- |
| `id` | `BIGINT UNSIGNED AUTO_INCREMENT`, clave primaria. Lo asigna la base; no se envía al crear. |
| `codigo` | Número (`5`) o nombre (`Terraza`), obligatorio y único. El modelo normaliza `Mesa 05` a `5`. |
| `nombre` | Nombre existente, conservado por compatibilidad. Al crear solo con código, toma ese mismo valor. |
| `tipo_venta_id` | Clave foránea a `tipos_venta.id`. Predeterminado: `1` (comer aquí). Editable. |
| `total` | Importe actual `DECIMAL(12,2)`, inicialmente `0.00`. Editable, sin valores negativos. |
| `estatus` | Código entero de `0` a `255`, inicialmente `1`. Su significado se definirá después; admite `0`, `1`, `2`, etc. |
| `creado_en`, `actualizado_en` | Fechas del registro. |

`tipos_venta` es un catálogo independiente con `id`, `codigo`, `nombre` y fechas.
Incluye `1 = Comer aquí` (`comer_aqui`) y `2 = Para llevar` (`para_llevar`). Se
pueden agregar otras categorías. `App\Models\TipoVenta` expone `$tipo->mesas`;
`Mesa` expone `$mesa->tipoVenta`. MySQL impide eliminar un tipo usado por mesas.

Ejemplo desde Laravel:

```php
$mesa = App\Models\Mesa::create(['codigo' => '5']); // ID asignado automáticamente
$mesa->update(['total' => '148.50', 'tipo_venta_id' => App\Models\TipoVenta::PARA_LLEVAR]);
$mesa->update(['tipo_venta_id' => App\Models\TipoVenta::COMER_AQUI]);
$mesa->update(['estatus' => 2]); // código pendiente de definir
```

El total representa el importe actual y cada actualización lo reemplaza. El
modelo admite hasta dos decimales, exige un tipo del catálogo y valida el estatus
como entero. MySQL también rechaza nombres vacíos, totales negativos y referencias
a tipos de venta inexistentes. Durante la conversión, `para_llevar = false/true`
pasa a `tipo_venta_id = 1/2` y `activa = false/true` pasa a `estatus = 0/1`.
Estos últimos valores conservan el estado previo; no definen los estados futuros.
No se agregó un catálogo de estatus mientras se decide qué significa cada código.
`MesaSeeder` registra la mesa encontrada en el navegador de la aplicación:
`codigo = 1`, nombre `1`, ID autoincrementable, sin cuenta abierta, total `0.00`, tipo de venta `1` y
estatus `1`. Repetirlo conserva el total, tipo de venta y estatus de una mesa
ya existente. `POST /api/mesas` recibe `codigo` y `tipo_venta_id`, y devuelve
`mesa.id` numérico y `mesa.codigo`. También admite el formato anterior
`nombre`/`paraLlevar`. Al agregar desde la tablet, primero registra en MySQL;
las cuentas y pedidos todavía se guardan en `localStorage`;
la actualización automática del total desde los pedidos requiere conectar ese
flujo a esta tabla.

La migración conserva total, tipo, estatus y fechas. No existen claves foráneas
que dependan de los IDs antiguos de mesas. Al revertir esta conversión, los IDs
de texto se reconstruyen como `mesa-<id numérico>`; no recuperan los UUID originales.

### Categorías

La migración `2026_10_10_000007_create_categorias_table.php` crea `categorias`.
El modelo `App\Models\Categoria` permite registrar y actualizar las categorías.

| Columna | Uso |
| --- | --- |
| `id` | `BIGINT UNSIGNED AUTO_INCREMENT`, clave primaria asignada por la base. |
| `nombre` | Texto de hasta 100 caracteres, obligatorio y único. |
| `estatus` | Entero de `0` a `255`, inicialmente `1`; el significado de cada código queda pendiente. |
| `creado_en` | Fecha de creación, automática. |
| `actualizado_en` | Fecha de última actualización, automática. |

```php
$categoria = App\Models\Categoria::create(['nombre' => 'Bebidas']);
$categoria->update(['estatus' => 2]);
```

La tabla se crea vacía. Las categorías del menú se pueden cargar después;
la futura tabla de productos usará `categoria_id` para relacionarse con `categorias.id`.

### Productos: análisis para registrarlos

El catálogo de `frontend/src/services/dataService.ts` contiene 28 productos en
14 categorías. El navegador también tiene 28 productos, sin productos adicionales
al menú base. La configuración incluye 31 grupos y 114 opciones, cinco grupos
con precios por presentación o tamaño y un producto con precios por paquete.

El precio base por sí solo no representa todas las ventas. Para conservar la
configuración actual, la estructura propuesta es:

| Tabla | Datos y relaciones |
| --- | --- |
| `categorias` | Tabla creada: ID autoincrementable, nombre único, estatus y fechas. El menú tiene 14 categorías para cargar. |
| `productos` | ID actual de texto, nombre único, `categoria_id`, precio base `DECIMAL(12,2)`, estatus numérico y fechas. Para paquetes: nombre singular y plural de la pieza. |
| `producto_grupos` | ID, `producto_id`, nombre, selección de una o varias opciones, orden y banderas de opcional, todas por defecto, descripción con/sin y reparto por cantidad. |
| `producto_opciones` | ID, `grupo_id`, nombre, orden y precio de venta opcional `DECIMAL(12,2)`. Nombre único dentro del grupo. |
| `producto_precios_paquete` | ID, `producto_id`, cantidad de piezas y precio del paquete. Cantidad única por producto. |

Los modificadores predeterminados (`defaultModifiers`) también deben conservarse
si se utilizan: pueden guardarse como una lista JSON de textos en `productos`.
Los IDs actuales (`p-taco`, `p-burrita`, `b-pepsi`, etc.) deben conservarse para
relacionar el catálogo con las partidas y evitar duplicar productos al importar.
La API podrá reconstruir `grupos`, `paquete` y `reparto` con el mismo formato que
consume el frontend.

Reglas de precio que deben mantenerse:

- Lonche y hamburguesa: las presentaciones cuestan `50.00` o `80.00`. El precio
  de la opción es el precio final del producto, no un cargo que se suma al base.
- Ensalada: chica `40.00`, grande `70.00`; papas: media orden `15.00`, completa
  `30.00`; agua de lima: chica `15.00`, mediana `20.00`, grande `40.00`.
- Burritas: una pieza `20.00`, dos `35.00`, tres `50.00`. Cada pieza conserva
  sus propias elecciones de relleno e ingredientes.
- Alitas: `13.00` por pieza, repartidas entre sabores. El total es la suma de
  piezas multiplicada por ese precio; elegir sabor no modifica el precio.
- Ingredientes de selección múltiple pueden iniciar todos seleccionados. Hay
  grupos opcionales y opciones que se describen como "Con" o "Sin".

En los pedidos se conservará una copia histórica del nombre, precio y opciones:
editar un producto después no debe cambiar lo que ya se pidió o cobró. La
estructura del catálogo no sustituye las futuras tablas de pedidos y partidas.

Pendientes identificados en `PENDIENTES_MENU`, antes de completar el registro:

- Confirmar el segundo sabor de alitas (actualmente "Buffalo").
- Confirmar cómo funciona la opción de queso en quesadillas.
- Confirmar si "Queso/Cebolla" en enchiladas es una o dos opciones.
- Confirmar la presentación de Coca-Cola de `30.00`.
- Identificar a qué bebida corresponde la anotación de `50.00`.

## 3. Cargar datos con seeders

`DatabaseSeeder` reúne las cargas y ejecuta `UsuarioSeeder`, `TipoVentaSeeder`
y `MesaSeeder` dentro de una transacción. El administrador se obtiene de
`ADMIN_USUARIO`, `ADMIN_NOMBRE` y
`ADMIN_PASSWORD` en `backend/.env`. El modelo convierte la contraseña o PIN
en un hash y lo excluye de su representación pública.

```powershell
.\artisan.ps1 db:seed
# O ejecutar una clase concreta:
.\artisan.ps1 db:seed --class=UsuarioSeeder
```

El administrador inicial ya está cargado en `usuarios` con los valores
configurados en `backend/.env`. Repetir `UsuarioSeeder` conserva al
administrador existente y su contraseña.
Las nuevas clases de carga se agregan a la lista de `DatabaseSeeder`. A diferencia
de una migración, Laravel ejecuta un seeder cada vez que lo solicitas: escribe
las cargas con `firstOrCreate`, `updateOrCreate` o `upsert`, según corresponda.

## Verificación

```powershell
.\artisan.ps1 test
```

Las pruebas de modelos y seeders usan SQLite en memoria. Para incluir la prueba
real de MySQL:

```powershell
$env:MYSQL_INTEGRATION_TESTS = '1'
.\artisan.ps1 test
```

Esta prueba crea y elimina únicamente una base con nombre aleatorio
`restaurarte_test_*`. Comprueba la creación vacía, la conservación de datos
existentes, la migración de usuarios y la repetición del seeder.
Usa una conexión de pruebas con permisos para crear y eliminar esas bases
temporales; la cuenta del servidor del proyecto tiene permisos sobre
`restaurante_diablillos`.

## Integración con la aplicación

La API que atiende al frontend está en `src/` (Node) y guarda usuarios, menú,
órdenes y sus detalles en MySQL. El navegador conserva los borradores pendientes
de enviar. Los comandos de Laravel administran el esquema y las cargas de datos.

### MIX y opciones de queso

«Activar MIX» abre un plato; los productos agregados hasta «Terminar MIX»
comparten su grupo. Se pueden abrir varios grupos en un pedido, además de
agregar productos sueltos. El borrador conserva el grupo activo al salir.

La migración `2026_10_18_000025_agregar_mix_y_opciones_a_orden_has_detalle.php`
añade `mix_grupo`, `con_queso` y `opciones`. Cada producto mantiene su propio
renglón, cantidad y subtotal. `opciones` guarda los complementos quitados
(ID y nombre) y la mezcla de rellenos. Los detalles anteriores quedan sin MIX.

La API asigna números MIX consecutivos por orden dentro de la transacción que
bloquea esa orden. Cada envío recibe grupos nuevos, aunque dos dispositivos
usen los mismos números en sus borradores. La respuesta incluye `guardados`
en el orden de los items enviados: el ticket usa sus IDs y grupos definitivos.
En cocina cada grupo se imprime como «MIX n · UN SOLO PLATO», con las opciones
de cada producto. El cobro conserva los importes individuales.

Tacos, Sopes, Quesadillas, Hamburguesas y Lonches ofrecen Queso dentro de
Complementos, sin botón independiente. Inicia apagado y se agrega al tocarlo;
la elección mantiene `sin_queso` / `con_queso` para el historial y los tickets.
El producto Queso de Sopes es independiente y no necesita ese complemento.
Los complementos se muestran en orden alfabético en español. Seleccionarlos
no añade cargos al precio; las elecciones anteriores se conservan en el detalle.
Para instalar MIX en una base anterior, después de respaldarla y antes de
publicar la API y el frontend, ejecutar desde `backend/`:

```powershell
.\artisan.ps1 migrate --force --path=database/migrations/2026_10_18_000025_agregar_mix_y_opciones_a_orden_has_detalle.php
.\artisan.ps1 db:seed --class=QuesoComplementoSeeder --force
```

El seeder puntual conserva precios y los demás complementos. Evitar ejecutar
la carga completa de datos para esta actualización en producción.

### Términos, Carnes y Alcohol

La migración `2026_10_18_000026_create_termino_table.php` crea el catálogo
`termino` y la referencia opcional `orden_has_detalle.termino_id`.
`TerminoSeeder` registra Blando, Medio y Dorado. Tacos admite los tres;
Tacos Dorados solo Blando y Medio. Las demás categorías no usan términos.
La API y el modelo validan esta restricción; el historial y cocina muestran
el término elegido. El botón MIX está en el panel izquierdo y su texto
permanece «MIX» tanto encendido como apagado.

`AmpliacionMenuSeeder` agrega Sope de Queso al precio de los demás Sopes;
Salsa verde a Lonches; Carnes con Milanesa ($40), Pollo a la plancha ($40)
y Carne de res ($20), y los complementos Mango, BFF, BBQ, Jitomate, Queso
y Pepino. En Bebidas, Limón / Cereza cambia al grupo Alcohol y cuesta $60;
Cerveza cuesta $30 y pertenece al mismo grupo. Se actualiza el producto
original de Limón / Cereza sin modificar los subtotales de ventas anteriores.

El nombre confirmado de esa bebida es **Limita**, dentro de Alcohol. **Coquita 235**
pertenece a Refrescos y cuesta $20. `AjusteBebidasSeeder` renombra el registro original
conservando su ID y precio, y registra Coquita sin duplicarla al repetir la carga.
En `DatabaseSeeder` se ejecuta antes de `ProductoSeeder` para actualizar también
las instalaciones que todavía tienen el nombre anterior. Para aplicar solo este ajuste:

```powershell
.\artisan.ps1 db:seed --class=AjusteBebidasSeeder --force
```

**Enchiladas de Queso**: `EnchiladaQuesoSeeder` agrega «Queso» en Enchiladas (además de
Queso/Cebolla) con el precio de las demás enchiladas ($15) y sus complementos: Repollo,
Lechuga, Salsa, Crema y Queso. Repetirlo no la duplica ni cambia un precio ajustado después.

```powershell
.\artisan.ps1 db:seed --class=EnchiladaQuesoSeeder --force
```

**Jitomate en Tostadas**: `TostadasJitomateSeeder` agrega el complemento Jitomate a todas las
tostadas, sin quitar Repollo, Lechuga, Salsa, Crema ni Queso. Repetirlo no lo duplica.

```powershell
.\artisan.ps1 db:seed --class=TostadasJitomateSeeder --force
```

### Orden completa de papas y distribución de opciones

Hamburguesas y Lonches ofrecen «CON PAPAS». El precio adicional se consulta
en el producto activo de Papas a la Francesa con tamaño «Orden completa»
(actualmente $30). El servidor suma ese precio por cada pieza marcada, junto
con las carnes extra, y guarda en `opciones.papas` el ID, nombre, tamaño y
precio de las papas en ese momento. No requiere una tabla ni columna nueva.
El ticket de cocina, el historial y el cobro indican solo «CON PAPAS».
Los renglones con y sin papas se mantienen separados en la cuenta.

En Hamburguesas, carne extra y papas comparten una fila con dos columnas
iguales; Queso aparece en Complementos. En Lonches, papas tiene su propio botón.
En Ensaladas, «Sin carne» queda al extremo derecho y seleccionar una proteína
elige automáticamente tamaño Chica, que puede cambiarse a Grande.

Para actualizar una instalación existente después del respaldo:

```powershell
.\artisan.ps1 migrate --force --path=database/migrations/2026_10_18_000026_create_termino_table.php
.\artisan.ps1 db:seed --class=AmpliacionMenuSeeder --force
.\artisan.ps1 db:seed --class=QuesoComplementoSeeder --force
```

### Extras como cobros libres

La migración `2026_10_18_000027_create_orden_extra_table.php` crea `orden_extra`
con `id`, `idOrden`, `descripcion`, `importe DECIMAL(12,2)` y fechas. La referencia
a `orden` elimina los cargos en cascada al eliminar su orden. No crea productos
de catálogo ni guarda cantidades: cada registro representa un cobro libre.

El botón «+» de Nuevo pedido abre «Agregar extra», donde se captura descripción
e importe, inicialmente vacío. El borrador conserva estos cargos al salir,
incluidos los pedidos por teléfono. `POST /api/ordenes/:idOrden/pedido` acepta
`extras: [{ descripcion, importe }]` junto con `items`, o sin productos. Exige
importes positivos con hasta dos decimales y una orden abierta. En la misma
transacción que bloquea y guarda los productos, registra los extras y recalcula
`orden.total` como suma de ambos conceptos. La respuesta incluye `extras` y
`extrasGuardados`; `GET /api/ordenes/:idOrden` devuelve los cargos guardados.

La cuenta y el historial muestran Extras después de los productos; el ticket
de cobro incluye descripción e importe al final del detalle. El ticket de cocina
no los imprime (no hay nada que preparar); un envío con solo extras no imprime
nada en cocina. El total de cobro ya los incluye y la reimpresión recupera los
registros de la base.
Para actualizar una instalación existente después del respaldo:

```powershell
.\artisan.ps1 migrate --force --path=database/migrations/2026_10_18_000027_create_orden_extra_table.php
.\artisan.ps1 db:seed --class=QuesoComplementoSeeder --force
```

`001_initial.sql` se conserva como referencia histórica del esquema PostgreSQL.
Laravel no lo ejecuta. Las tablas MySQL se construyen con las clases en
`migrations/` y sus datos con las clases en `seeders/`.

Referencias: [migraciones](https://laravel.com/docs/13.x/migrations),
[modelos Eloquent](https://laravel.com/docs/13.x/eloquent) y
[seeders](https://laravel.com/docs/13.x/seeding).
