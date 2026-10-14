<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Turno de caja: se abre cuando un administrador o cajero inicia sesión en la caja.
        // Solo puede haber un turno abierto a la vez (una sola caja central).
        Schema::create('turnos', function (Blueprint $table): void {
            $table->id();
            $table->string('usuario_id', 64); // quien lo abrió (admin/cajero)
            $table->foreign('usuario_id')->references('id')->on('usuarios')->cascadeOnUpdate()->restrictOnDelete();
            $table->timestamp('abierto_en');
            $table->timestamp('cerrado_en')->nullable();
            // Vale 1 mientras el turno está abierto y NULL al cerrarlo: el índice único impide dos turnos abiertos.
            $table->unsignedTinyInteger('abierto')->nullable()->storedAs('CASE WHEN cerrado_en IS NULL THEN 1 END')->unique();
            $table->timestamp('creado_en')->nullable();
            $table->timestamp('actualizado_en')->nullable();
        });

        // Sesión de una tablet dentro del turno de caja: se abre cuando la tablet inicia sesión con su cuenta.
        Schema::create('sesiones_tablet', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('turno_id')->constrained('turnos')->cascadeOnUpdate()->restrictOnDelete();
            $table->string('tablet_id', 64);
            // RESTRICT también al actualizar: MySQL no permite CASCADE en la columna base de una columna generada.
            $table->foreign('tablet_id')->references('id')->on('tablets')->restrictOnUpdate()->restrictOnDelete();
            $table->string('usuario_id', 64); // cuenta de la tablet
            $table->foreign('usuario_id')->references('id')->on('usuarios')->cascadeOnUpdate()->restrictOnDelete();
            $table->timestamp('iniciada_en');
            $table->timestamp('cerrada_en')->nullable();
            // Una tablet no puede tener dos sesiones abiertas a la vez.
            $table->string('tablet_abierta', 64)->nullable()->storedAs('CASE WHEN cerrada_en IS NULL THEN tablet_id END')->unique();
            $table->timestamp('creado_en')->nullable();
            $table->timestamp('actualizado_en')->nullable();
            $table->index(['turno_id', 'tablet_id']);
        });

        // Cada mesa queda ligada al turno (y a la sesión de tablet) en que se registró;
        // la tablet solo muestra las mesas del turno abierto.
        Schema::table('mesas', function (Blueprint $table): void {
            $table->foreignId('turno_id')->nullable()->constrained('turnos')->cascadeOnUpdate()->restrictOnDelete();
            $table->foreignId('sesion_tablet_id')->nullable()->constrained('sesiones_tablet')->cascadeOnUpdate()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('mesas', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('sesion_tablet_id');
            $table->dropConstrainedForeignId('turno_id');
        });
        Schema::dropIfExists('sesiones_tablet');
        Schema::dropIfExists('turnos');
    }
};
