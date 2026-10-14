<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Detalle de cada orden: qué productos se pidieron y cuántos. El precio vive en producto.precio;
        // el subtotal guarda cantidad × precio al momento de pedir (no cambia si después cambia el precio).
        Schema::create('orden_has_detalle', function (Blueprint $table): void {
            $table->id('idDetalle_Orden'); // autoincrementable
            // Al borrar una orden se borra su detalle.
            $table->unsignedBigInteger('idOrden');
            $table->foreign('idOrden')->references('idOrden')->on('orden')->cascadeOnUpdate()->cascadeOnDelete();
            // Un producto que ya se vendió no se puede borrar (se conserva el historial).
            $table->unsignedBigInteger('idProducto');
            $table->foreign('idProducto')->references('id')->on('producto')->cascadeOnUpdate()->restrictOnDelete();
            $table->unsignedInteger('cantidad');
            $table->decimal('subtotal', 12, 2);
            $table->timestamp('creado_en')->useCurrent();
            $table->timestamp('actualizado_en')->useCurrent()->useCurrentOnUpdate();
            $table->index(['idOrden', 'idProducto']);
        });

        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement('ALTER TABLE orden_has_detalle
                ADD CONSTRAINT orden_has_detalle_cantidad_positiva CHECK (cantidad > 0),
                ADD CONSTRAINT orden_has_detalle_subtotal_no_negativo CHECK (subtotal >= 0)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('orden_has_detalle');
    }
};
