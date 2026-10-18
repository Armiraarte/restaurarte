<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Subgrupo dentro de la categoría para acomodar el menú: en Bebidas, Refrescos / Aguas / Jugos
        // (ProductoGrupoSeeder). Sin grupo, el producto se muestra junto con los demás de su categoría.
        Schema::table('producto', function (Blueprint $table): void {
            $table->string('grupo', 40)->nullable()->after('tamano');
        });
    }

    public function down(): void
    {
        Schema::table('producto', function (Blueprint $table): void {
            $table->dropColumn('grupo');
        });
    }
};
