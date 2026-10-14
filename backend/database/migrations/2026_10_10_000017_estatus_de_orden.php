<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * orden.estatus: 0 = ABIERTA, 1 = PAGANDO, 2 = PAGADO.
 * Hasta ahora toda orden se creaba con 1 ("registrada") y aún no hay cobros, así que las que tienen 1 pasan a 0 (abierta).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('orden')->where('estatus', 1)->update(['estatus' => 0]);
        DB::table('orden')->where('estatus', '>', 2)->update(['estatus' => 0]);

        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement("ALTER TABLE orden MODIFY COLUMN estatus TINYINT UNSIGNED NOT NULL DEFAULT '0'");
            DB::statement('ALTER TABLE orden ADD CONSTRAINT orden_estatus_valido CHECK (estatus BETWEEN 0 AND 2)');
        } else {
            Schema::table('orden', fn ($table) => $table->unsignedTinyInteger('estatus')->default(0)->change());
        }
    }

    public function down(): void
    {
        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement('ALTER TABLE orden DROP CHECK orden_estatus_valido');
            DB::statement("ALTER TABLE orden MODIFY COLUMN estatus TINYINT UNSIGNED NOT NULL DEFAULT '1'");
        } else {
            Schema::table('orden', fn ($table) => $table->unsignedTinyInteger('estatus')->default(1)->change());
        }

        DB::table('orden')->where('estatus', 0)->update(['estatus' => 1]);
    }
};
