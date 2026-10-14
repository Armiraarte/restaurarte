<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Relación producto ↔ complemento: qué complementos lleva cada producto.
        Schema::create('producto_has_complemento', function (Blueprint $table): void {
            $table->id();
            // Al borrar un producto se borran sus relaciones; un complemento en uso no se puede borrar.
            $table->foreignId('producto_id')->constrained('productos')->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreignId('complemento_id')->constrained('complementos')->cascadeOnUpdate()->restrictOnDelete();
            $table->timestamp('creado_en')->useCurrent();
            $table->timestamp('actualizado_en')->useCurrent()->useCurrentOnUpdate();
            // Un complemento se relaciona una sola vez con cada producto.
            $table->unique(['producto_id', 'complemento_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('producto_has_complemento');
    }
};
