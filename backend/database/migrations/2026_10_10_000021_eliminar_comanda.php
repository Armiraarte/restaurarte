<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * La tabla `comanda` ya no se usa: lo que va a cocina sale en el ticket de cocina impreso y lo pedido queda
 * en orden_has_detalle. En MySQL ya se había borrado a mano; aquí se registra para que las migraciones coincidan.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('comanda');
    }

    public function down(): void
    {
        // Misma estructura que 2026_10_10_000016_create_comanda_table.
        Schema::create('comanda', function (Blueprint $table): void {
            $table->id('idComanda');
            $table->unsignedBigInteger('idOrden');
            $table->foreign('idOrden')->references('idOrden')->on('orden')->cascadeOnUpdate()->cascadeOnDelete();
            $table->unsignedBigInteger('idProducto');
            $table->foreign('idProducto')->references('id')->on('producto')->cascadeOnUpdate()->restrictOnDelete();
            $table->string('nombre', 150);
            $table->unsignedInteger('cantidad');
            $table->unsignedTinyInteger('estatus')->default(1);
            $table->timestamp('creado_en')->useCurrent();
            $table->timestamp('actualizado_en')->useCurrent()->useCurrentOnUpdate();
            $table->index(['estatus', 'idOrden']);
        });
    }
};
