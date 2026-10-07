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
| `numero` / `nombre` | `01` (único) / `TABLET 01` (se completa si va vacío). |
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

## 3. Cargar datos con seeders

`DatabaseSeeder` reúne las cargas y ejecuta `UsuarioSeeder` dentro de una
transacción. El administrador se obtiene de `ADMIN_USUARIO`, `ADMIN_NOMBRE` y
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

La API que atiende al frontend sigue en `src/` (Node). La persistencia de usuarios
en JSON y los datos del POS en el navegador se conectarán a MySQL en una etapa
posterior. Los comandos de Laravel se ejecutan localmente; el Compose existente
levanta la API Node y el frontend.

`001_initial.sql` se conserva como referencia histórica del esquema PostgreSQL.
Laravel no lo ejecuta. Las tablas MySQL se construyen con las clases en
`migrations/` y sus datos con las clases en `seeders/`.

Referencias: [migraciones](https://laravel.com/docs/13.x/migrations),
[modelos Eloquent](https://laravel.com/docs/13.x/eloquent) y
[seeders](https://laravel.com/docs/13.x/seeding).
