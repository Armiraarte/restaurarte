<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orden_extra', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('idOrden');
            $table->foreign('idOrden')->references('idOrden')->on('orden')->cascadeOnDelete();
            $table->string('descripcion', 180);
            $table->decimal('importe', 12, 2);
            $table->timestamp('creado_en')->useCurrent();
            $table->timestamp('actualizado_en')->useCurrent()->useCurrentOnUpdate();
            $table->index(['idOrden', 'creado_en']);
        });
        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement('ALTER TABLE orden_extra ADD CONSTRAINT orden_extra_importe_positivo CHECK (importe > 0)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('orden_extra');
    }
};
