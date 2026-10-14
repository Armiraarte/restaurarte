<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categorias', function (Blueprint $table): void {
            $table->id();
            $table->string('nombre', 100)->unique();
            // Código numérico; su significado se definirá después, igual que en mesas.
            $table->unsignedTinyInteger('estatus')->default(1);
            $table->timestamp('creado_en')->useCurrent();
            $table->timestamp('actualizado_en')->useCurrent()->useCurrentOnUpdate();
        });

        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement('ALTER TABLE categorias
                ADD CONSTRAINT categorias_nombre_no_vacio CHECK (CHAR_LENGTH(TRIM(nombre)) > 0)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('categorias');
    }
};
