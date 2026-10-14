<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            Schema::table('mesas', function (Blueprint $table): void {
                $table->string('codigo', 100)->nullable()->after('id');
            });
            DB::table('mesas')->update(['codigo' => DB::raw('nombre')]);

            // La clave temporal permite asignar los nuevos IDs sin borrar las filas.
            DB::statement('ALTER TABLE mesas
                ADD COLUMN id_autonumerico BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                ADD UNIQUE INDEX mesas_id_autonumerico_unique (id_autonumerico)');
            DB::statement('ALTER TABLE mesas
                DROP PRIMARY KEY,
                DROP COLUMN id,
                CHANGE COLUMN id_autonumerico id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT FIRST,
                MODIFY COLUMN codigo VARCHAR(100) NOT NULL,
                ADD PRIMARY KEY (id),
                DROP INDEX mesas_id_autonumerico_unique,
                ADD UNIQUE INDEX mesas_codigo_unique (codigo),
                ADD CONSTRAINT mesas_codigo_no_vacio CHECK (CHAR_LENGTH(TRIM(codigo)) > 0)');

            return;
        }

        // SQLite requiere reconstruir la tabla para cambiar la clave primaria.
        $this->reconstruirSqlite(true);
    }

    public function down(): void
    {
        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            // Los IDs originales de texto se sustituyeron; al revertir se generan mesa-<id>.
            DB::statement('ALTER TABLE mesas
                ADD COLUMN id_texto VARCHAR(64) NULL,
                MODIFY COLUMN id BIGINT UNSIGNED NOT NULL');
            DB::table('mesas')->update(['id_texto' => DB::raw("CONCAT('mesa-', id)")]);
            DB::statement('ALTER TABLE mesas
                DROP CONSTRAINT mesas_codigo_no_vacio,
                DROP INDEX mesas_codigo_unique,
                DROP PRIMARY KEY,
                DROP COLUMN id,
                DROP COLUMN codigo,
                CHANGE COLUMN id_texto id VARCHAR(64) NOT NULL FIRST,
                ADD PRIMARY KEY (id)');

            return;
        }

        $this->reconstruirSqlite(false);
    }

    private function reconstruirSqlite(bool $autoincrementable): void
    {
        Schema::create('mesas_conversion', function (Blueprint $table) use ($autoincrementable): void {
            if ($autoincrementable) {
                $table->id();
                $table->string('codigo', 100)->unique();
            } else {
                $table->string('id', 64)->primary();
            }
            $table->string('nombre', 100)->unique($autoincrementable ? 'mesas_numericas_nombre_unique' : 'mesas_texto_nombre_unique');
            $table->decimal('total', 12, 2)->default(0);
            $table->timestamp('creado_en')->nullable();
            $table->timestamp('actualizado_en')->nullable();
            $table->foreignId('tipo_venta_id')->default(1)->constrained('tipos_venta')
                ->restrictOnUpdate()->restrictOnDelete();
            $table->unsignedTinyInteger('estatus')->default(1);
        });

        $campos = ['nombre', 'total', 'creado_en', 'actualizado_en', 'tipo_venta_id', 'estatus'];
        $clave = $autoincrementable ? 'codigo' : 'id';
        $expresion = $autoincrementable ? 'nombre' : "'mesa-' || id";
        DB::table('mesas_conversion')->insertUsing(
            [$clave, ...$campos],
            DB::table('mesas')->selectRaw($expresion)->addSelect($campos)->orderBy('id'),
        );

        Schema::drop('mesas');
        Schema::rename('mesas_conversion', 'mesas');
    }
};
