<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('productos', function (Blueprint $table): void {
            // Solo para productos que se venden por tamaño (Ensalada Chica/Grande, Agua de Lima…). NULL = sin tamaño.
            $table->string('tamano', 50)->nullable()->after('nombre');
            // Clave para el índice único: tamano NULL cuenta como '' (MySQL permite varios NULL en un índice único).
            $table->string('tamano_clave', 50)->virtualAs("COALESCE(tamano, '')");
        });

        Schema::table('productos', function (Blueprint $table): void {
            // Ahora el mismo nombre puede repetirse en una categoría si cambia el tamaño.
            // El índice nuevo se crea antes de quitar el anterior (MySQL lo necesita para la llave foránea).
            $table->unique(['categoria_id', 'nombre', 'tamano_clave'], 'productos_categoria_nombre_tamano_unique');
        });

        Schema::table('productos', function (Blueprint $table): void {
            $table->dropUnique(['categoria_id', 'nombre']);
        });
    }

    public function down(): void
    {
        Schema::table('productos', function (Blueprint $table): void {
            $table->unique(['categoria_id', 'nombre']);
        });

        Schema::table('productos', function (Blueprint $table): void {
            $table->dropUnique('productos_categoria_nombre_tamano_unique');
        });

        Schema::table('productos', function (Blueprint $table): void {
            $table->dropColumn(['tamano_clave', 'tamano']);
        });
    }
};
