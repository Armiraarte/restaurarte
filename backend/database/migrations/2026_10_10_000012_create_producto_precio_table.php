<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Precio de cada producto. Un precio por producto; al borrar el producto se borra su precio.
        Schema::create('producto_precio', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('producto_id')->unique()->constrained('productos')->cascadeOnUpdate()->cascadeOnDelete();
            $table->decimal('precio', 12, 2);
            $table->timestamp('creado_en')->useCurrent();
            $table->timestamp('actualizado_en')->useCurrent()->useCurrentOnUpdate();
        });

        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement('ALTER TABLE producto_precio
                ADD CONSTRAINT producto_precio_no_negativo CHECK (precio >= 0)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('producto_precio');
    }
};
