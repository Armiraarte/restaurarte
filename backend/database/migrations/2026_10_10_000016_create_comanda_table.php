<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Lo que se manda a cocina: un renglón por producto pedido, con su nombre y cantidad.
        Schema::create('comanda', function (Blueprint $table): void {
            $table->id('idComanda'); // autoincrementable
            // Al borrar una orden se borran sus comandas.
            $table->unsignedBigInteger('idOrden');
            $table->foreign('idOrden')->references('idOrden')->on('orden')->cascadeOnUpdate()->cascadeOnDelete();
            $table->unsignedBigInteger('idProducto');
            $table->foreign('idProducto')->references('id')->on('producto')->cascadeOnUpdate()->restrictOnDelete();
            // Nombre como se manda a cocina ("Tacos Dorados · Frijol"); copia, no cambia si se edita el producto.
            $table->string('nombre', 150);
            $table->unsignedInteger('cantidad');
            // 1 = pendiente, 2 = preparando, 3 = lista, 4 = entregada.
            $table->unsignedTinyInteger('estatus')->default(1);
            $table->timestamp('creado_en')->useCurrent();
            $table->timestamp('actualizado_en')->useCurrent()->useCurrentOnUpdate();
            $table->index(['estatus', 'idOrden']);
        });

        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement('ALTER TABLE comanda
                ADD CONSTRAINT comanda_nombre_no_vacio CHECK (CHAR_LENGTH(TRIM(nombre)) > 0),
                ADD CONSTRAINT comanda_cantidad_positiva CHECK (cantidad > 0),
                ADD CONSTRAINT comanda_estatus_valido CHECK (estatus BETWEEN 1 AND 4)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('comanda');
    }
};
