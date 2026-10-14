<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('productos', function (Blueprint $table): void {
            $table->id(); // idProducto, autoincrementable
            // idCategoria: no se puede borrar una categoría que tenga productos.
            $table->foreignId('categoria_id')->constrained('categorias')->cascadeOnUpdate()->restrictOnDelete();
            $table->string('nombre', 100);
            // Código numérico; su significado se definirá después, igual que en categorías y mesas.
            $table->unsignedTinyInteger('estatus')->default(1);
            $table->string('imagen', 255)->nullable(); // ruta o URL de la imagen; opcional
            $table->timestamp('creado_en')->useCurrent();
            $table->timestamp('actualizado_en')->useCurrent()->useCurrentOnUpdate();
            // Un mismo nombre no se repite dentro de una categoría.
            $table->unique(['categoria_id', 'nombre']);
        });

        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement('ALTER TABLE productos
                ADD CONSTRAINT productos_nombre_no_vacio CHECK (CHAR_LENGTH(TRIM(nombre)) > 0)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('productos');
    }
};
