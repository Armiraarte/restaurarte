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
            $drop = DB::getDriverName() === 'mariadb' ? 'DROP CONSTRAINT' : 'DROP CHECK';
            DB::statement("ALTER TABLE orden_extra ADD COLUMN mix_grupo INT UNSIGNED NULL,
                {$drop} orden_extra_importe_positivo,
                ADD CONSTRAINT orden_extra_importe_no_negativo CHECK (importe >= 0)");

            return;
        }
        Schema::table('orden_extra', function (Blueprint $table): void {
            $table->unsignedInteger('mix_grupo')->nullable();
        });
    }

    public function down(): void
    {
        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            if (DB::table('orden_extra')->where('importe', 0)->exists()) {
                throw new RuntimeException('Hay extras gratuitos: no se puede volver a exigir un importe positivo.');
            }
            $drop = DB::getDriverName() === 'mariadb' ? 'DROP CONSTRAINT' : 'DROP CHECK';
            DB::statement("ALTER TABLE orden_extra DROP COLUMN mix_grupo,
                {$drop} orden_extra_importe_no_negativo,
                ADD CONSTRAINT orden_extra_importe_positivo CHECK (importe > 0)");

            return;
        }
        Schema::table('orden_extra', function (Blueprint $table): void {
            $table->dropColumn('mix_grupo');
        });
    }
};
