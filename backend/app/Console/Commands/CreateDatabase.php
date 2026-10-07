<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Throwable;

class CreateDatabase extends Command
{
    protected $signature = 'db:create {--connection= : Conexion MySQL definida en config/database.php}';

    protected $description = 'Crea la base MySQL del proyecto sin crear tablas ni reemplazar datos';

    public function handle(): int
    {
        $administracion = null;

        try {
            $conexion = $this->option('connection') ?: config('database.default');
            $config = DB::connection($conexion)->getConfig();

            if (! in_array($config['driver'], ['mysql', 'mariadb'], true)) {
                $this->error('db:create requiere una conexion MySQL o MariaDB. Revisa DB_CONNECTION.');

                return self::FAILURE;
            }

            $nombre = $config['database'] ?? '';
            if (! is_string($nombre) || ! preg_match('/^[a-zA-Z0-9_][a-zA-Z0-9_-]{0,63}$/D', $nombre)) {
                $this->error('DB_DATABASE debe contener de 1 a 64 letras, numeros, guiones o guiones bajos.');

                return self::FAILURE;
            }

            if (in_array(strtolower($nombre), ['mysql', 'information_schema', 'performance_schema', 'sys'], true)) {
                $this->error('Configura una base propia del proyecto, por ejemplo DB_DATABASE=restaurarte.');

                return self::FAILURE;
            }

            // La conexion de administracion omite la base que aun no existe.
            $config = array_replace($config, $config['write'] ?? []);
            unset($config['url'], $config['read'], $config['write']);
            $config['database'] = null;
            $config['name'] = '_crear_base';
            $administracion = DB::build($config);

            $existe = $administracion->selectOne(
                'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?',
                [$nombre],
            );

            if ($existe) {
                $this->info("La base [{$nombre}] ya existe.");

                return self::SUCCESS;
            }

            try {
                $administracion->getSchemaBuilder()->createDatabase($nombre);
            } catch (QueryException $exception) {
                // Otra ejecucion puede crear la base entre la consulta y el CREATE.
                if (($exception->errorInfo[1] ?? null) !== 1007) {
                    throw $exception;
                }
            }

            $this->info("Base [{$nombre}] creada. Las tablas se agregan con artisan migrate.");

            return self::SUCCESS;
        } catch (Throwable $exception) {
            $this->error('No se pudo crear la base. Revisa la conexion MySQL y los permisos CREATE.');
            $this->error($exception->getMessage());

            return self::FAILURE;
        } finally {
            if ($administracion) {
                DB::purge('_crear_base');
            }
        }
    }
}
