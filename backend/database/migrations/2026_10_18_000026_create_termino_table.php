<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('termino', function (Blueprint $table): void {
            $table->id();
            $table->string('nombre', 30)->unique();
            $table->unsignedTinyInteger('estatus')->default(1);
            $table->timestamp('creado_en')->useCurrent();
            $table->timestamp('actualizado_en')->useCurrent()->useCurrentOnUpdate();
        });
        Schema::table('orden_has_detalle', function (Blueprint $table): void {
            $table->foreignId('termino_id')->nullable()->constrained('termino')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('orden_has_detalle', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('termino_id');
        });
        Schema::dropIfExists('termino');
    }
};
