<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orden_has_detalle', function (Blueprint $table): void {
            $table->boolean('con_queso')->default(false);
            // Numeración por orden: varios renglones conservan su producto y comparten un plato.
            $table->unsignedInteger('mix_grupo')->nullable();
            // Copia de los complementos quitados y rellenos elegidos al hacer el pedido.
            $table->json('opciones')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('orden_has_detalle', function (Blueprint $table): void {
            $table->dropColumn(['con_queso', 'mix_grupo', 'opciones']);
        });
    }
};
