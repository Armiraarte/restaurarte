<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Nueva estructura de `turnos` (se conservan los turnos que ya existen):
 *
 *   idTurno       ← id           autoincrementable
 *   idUsuario     ← usuario_id   quién lo inició (admin o cajero)
 *   fecha_inicio  ← abierto_en
 *   fecha_fin     ← cerrado_en   NULL mientras está abierto
 *   estatus       (nuevo)        1 = ABIERTO, 0 = CERRADO
 *   creado_en, actualizado_en
 *
 * Se quita la columna generada `abierto`, que con su índice único impedía dos turnos abiertos.
 * Ahora eso lo cuida la API al iniciar el turno (bloquea la fila del turno abierto en la transacción).
 * Las llaves foráneas de sesiones_tablet.turno_id y orden.idTurno pasan a apuntar a turnos.idTurno.
 */
return new class extends Migration
{
    private function esMysql(): bool
    {
        return in_array(DB::getDriverName(), ['mysql', 'mariadb'], true);
    }

    /** Llaves foráneas (tabla, columna, nombre) que apuntan a `turnos`. */
    private function foraneasHaciaTurnos(): array
    {
        return array_map(fn ($f) => (array) $f, DB::select(
            'SELECT TABLE_NAME AS tabla, COLUMN_NAME AS columna, CONSTRAINT_NAME AS nombre
               FROM information_schema.KEY_COLUMN_USAGE
              WHERE REFERENCED_TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = ?',
            ['turnos'],
        ));
    }

    public function up(): void
    {
        if ($this->esMysql()) {
            $foraneas = $this->foraneasHaciaTurnos();
            foreach ($foraneas as $f) {
                DB::statement("ALTER TABLE `{$f['tabla']}` DROP FOREIGN KEY `{$f['nombre']}`");
            }

            DB::statement('ALTER TABLE turnos DROP INDEX turnos_abierto_unique, DROP COLUMN abierto');
            DB::statement('ALTER TABLE turnos
                CHANGE COLUMN id idTurno BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                CHANGE COLUMN usuario_id idUsuario VARCHAR(64) NOT NULL AFTER idTurno,
                CHANGE COLUMN abierto_en fecha_inicio TIMESTAMP NOT NULL AFTER idUsuario,
                CHANGE COLUMN cerrado_en fecha_fin TIMESTAMP NULL DEFAULT NULL AFTER fecha_inicio,
                ADD COLUMN estatus TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER fecha_fin');
            DB::statement('UPDATE turnos SET estatus = CASE WHEN fecha_fin IS NULL THEN 1 ELSE 0 END');
            DB::statement('ALTER TABLE turnos
                ADD INDEX turnos_estatus_index (estatus),
                ADD CONSTRAINT turnos_estatus_valido CHECK (estatus IN (0, 1)),
                ADD CONSTRAINT turnos_fecha_fin_segun_estatus CHECK ((estatus = 1 AND fecha_fin IS NULL) OR (estatus = 0 AND fecha_fin IS NOT NULL))');

            foreach ($foraneas as $f) {
                DB::statement("ALTER TABLE `{$f['tabla']}` ADD CONSTRAINT `{$f['nombre']}`
                    FOREIGN KEY (`{$f['columna']}`) REFERENCES turnos (idTurno) ON UPDATE CASCADE ON DELETE RESTRICT");
            }

            return;
        }

        // SQLite (pruebas): renombrar columnas actualiza solo las referencias de las otras tablas.
        Schema::table('turnos', function (Blueprint $table): void {
            $table->dropUnique(['abierto']);
        });
        Schema::table('turnos', function (Blueprint $table): void {
            $table->dropColumn('abierto');
        });
        Schema::table('turnos', function (Blueprint $table): void {
            $table->renameColumn('id', 'idTurno');
            $table->renameColumn('usuario_id', 'idUsuario');
            $table->renameColumn('abierto_en', 'fecha_inicio');
            $table->renameColumn('cerrado_en', 'fecha_fin');
        });
        Schema::table('turnos', function (Blueprint $table): void {
            $table->unsignedTinyInteger('estatus')->default(1)->index();
        });
        DB::table('turnos')->update(['estatus' => DB::raw('CASE WHEN fecha_fin IS NULL THEN 1 ELSE 0 END')]);
    }

    public function down(): void
    {
        if ($this->esMysql()) {
            $foraneas = $this->foraneasHaciaTurnos();
            foreach ($foraneas as $f) {
                DB::statement("ALTER TABLE `{$f['tabla']}` DROP FOREIGN KEY `{$f['nombre']}`");
            }

            DB::statement('ALTER TABLE turnos
                DROP CHECK turnos_fecha_fin_segun_estatus,
                DROP CHECK turnos_estatus_valido,
                DROP INDEX turnos_estatus_index,
                DROP COLUMN estatus');
            DB::statement('ALTER TABLE turnos
                CHANGE COLUMN idTurno id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                CHANGE COLUMN idUsuario usuario_id VARCHAR(64) NOT NULL,
                CHANGE COLUMN fecha_inicio abierto_en TIMESTAMP NOT NULL,
                CHANGE COLUMN fecha_fin cerrado_en TIMESTAMP NULL DEFAULT NULL,
                ADD COLUMN abierto TINYINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN cerrado_en IS NULL THEN 1 END) STORED AFTER cerrado_en,
                ADD UNIQUE INDEX turnos_abierto_unique (abierto)');

            foreach ($foraneas as $f) {
                DB::statement("ALTER TABLE `{$f['tabla']}` ADD CONSTRAINT `{$f['nombre']}`
                    FOREIGN KEY (`{$f['columna']}`) REFERENCES turnos (id) ON UPDATE CASCADE ON DELETE RESTRICT");
            }

            return;
        }

        Schema::table('turnos', function (Blueprint $table): void {
            $table->dropIndex(['estatus']);
        });
        Schema::table('turnos', function (Blueprint $table): void {
            $table->dropColumn('estatus');
        });
        Schema::table('turnos', function (Blueprint $table): void {
            $table->renameColumn('idTurno', 'id');
            $table->renameColumn('idUsuario', 'usuario_id');
            $table->renameColumn('fecha_inicio', 'abierto_en');
            $table->renameColumn('fecha_fin', 'cerrado_en');
        });
        Schema::table('turnos', function (Blueprint $table): void {
            $table->unsignedTinyInteger('abierto')->nullable()->storedAs('CASE WHEN cerrado_en IS NULL THEN 1 END')->unique();
        });
    }
};
