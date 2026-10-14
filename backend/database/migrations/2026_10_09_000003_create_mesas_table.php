<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mesas', function (Blueprint $table): void {
            $table->string('id', 64)->primary();
            // Número ("5") o nombre ("Terraza"); el modelo normaliza "Mesa 05" a "5".
            $table->string('nombre', 100)->unique();
            $table->boolean('para_llevar')->default(false);
            $table->boolean('activa')->default(true);
            // Importe actual de la mesa.
            $table->decimal('total', 12, 2)->default(0);
            $table->timestamp('creado_en')->nullable();
            $table->timestamp('actualizado_en')->nullable();
        });

        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement('ALTER TABLE mesas
                ADD CONSTRAINT mesas_nombre_no_vacio CHECK (CHAR_LENGTH(TRIM(nombre)) > 0),
                ADD CONSTRAINT mesas_total_no_negativo CHECK (total >= 0),
                ADD CONSTRAINT mesas_para_llevar_valido CHECK (para_llevar IN (0, 1))');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('mesas');
    }
};
