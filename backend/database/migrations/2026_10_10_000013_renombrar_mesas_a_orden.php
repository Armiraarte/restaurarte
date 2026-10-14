<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * La tabla `mesas` pasa a llamarse `orden`, con sus columnas renombradas y en este orden:
 *   idOrden, codigo, nombre, total, tipo_orden, estatus, idTurno, idSesion_tablet, creado_en, actualizado_en
 *
 *   id               → idOrden
 *   tipo_venta_id    → tipo_orden       (sigue apuntando a tipos_venta: 1 = comer aquí, 2 = para llevar)
 *   turno_id         → idTurno          (turnos.id)
 *   sesion_tablet_id → idSesion_tablet  (sesiones_tablet.id)
 *
 * Los datos, llaves foráneas, índices únicos y restricciones se conservan (sus nombres internos
 * siguen empezando con "mesas_").
 */
return new class extends Migration
{
    private const RENOMBRES = [
        'id' => 'idOrden',
        'tipo_venta_id' => 'tipo_orden',
        'turno_id' => 'idTurno',
        'sesion_tablet_id' => 'idSesion_tablet',
    ];

    public function up(): void
    {
        if ($this->esMysql()) {
            DB::statement('RENAME TABLE mesas TO orden');
            DB::statement('ALTER TABLE orden
                RENAME COLUMN id TO idOrden,
                RENAME COLUMN tipo_venta_id TO tipo_orden,
                RENAME COLUMN turno_id TO idTurno,
                RENAME COLUMN sesion_tablet_id TO idSesion_tablet');
            // Mismas definiciones que ya tenían las columnas; solo cambia su posición.
            DB::statement("ALTER TABLE orden
                MODIFY COLUMN codigo VARCHAR(100) COLLATE utf8mb4_unicode_ci NOT NULL AFTER idOrden,
                MODIFY COLUMN nombre VARCHAR(100) COLLATE utf8mb4_unicode_ci NOT NULL AFTER codigo,
                MODIFY COLUMN total DECIMAL(12,2) NOT NULL DEFAULT '0.00' AFTER nombre,
                MODIFY COLUMN tipo_orden BIGINT UNSIGNED NOT NULL DEFAULT '1' AFTER total,
                MODIFY COLUMN estatus TINYINT UNSIGNED NOT NULL DEFAULT '1' AFTER tipo_orden,
                MODIFY COLUMN idTurno BIGINT UNSIGNED NULL DEFAULT NULL AFTER estatus,
                MODIFY COLUMN idSesion_tablet BIGINT UNSIGNED NULL DEFAULT NULL AFTER idTurno,
                MODIFY COLUMN creado_en TIMESTAMP NULL DEFAULT NULL AFTER idSesion_tablet,
                MODIFY COLUMN actualizado_en TIMESTAMP NULL DEFAULT NULL AFTER creado_en");

            return;
        }

        // SQLite (pruebas): renombra; el orden físico de las columnas no importa. Solo renombra las que
        // existan, porque las pruebas de migraciones anteriores reconstruyen la tabla sin las de turnos.
        Schema::rename('mesas', 'orden');
        $this->renombrarColumnas('orden', self::RENOMBRES);
    }

    public function down(): void
    {
        if ($this->esMysql()) {
            DB::statement('ALTER TABLE orden
                RENAME COLUMN idOrden TO id,
                RENAME COLUMN tipo_orden TO tipo_venta_id,
                RENAME COLUMN idTurno TO turno_id,
                RENAME COLUMN idSesion_tablet TO sesion_tablet_id');
            DB::statement('RENAME TABLE orden TO mesas');

            return;
        }

        $this->renombrarColumnas('orden', array_flip(self::RENOMBRES));
        Schema::rename('orden', 'mesas');
    }

    /** SQLite: renombra cada columna existente según el mapa [actual => nuevo]. */
    private function renombrarColumnas(string $tabla, array $renombres): void
    {
        $existentes = array_filter($renombres, fn (string $actual) => Schema::hasColumn($tabla, $actual), ARRAY_FILTER_USE_KEY);
        Schema::table($tabla, function (Blueprint $table) use ($existentes): void {
            foreach ($existentes as $actual => $nuevo) {
                $table->renameColumn($actual, $nuevo);
            }
        });
    }

    private function esMysql(): bool
    {
        return in_array(DB::getDriverName(), ['mysql', 'mariadb'], true);
    }
};
