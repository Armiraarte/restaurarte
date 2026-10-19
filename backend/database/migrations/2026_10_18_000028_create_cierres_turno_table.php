<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Registro del cierre de cada turno:
        //   tipo 'corte'      → la caja hizo el corte de turno (usuario_id: quién lo hizo).
        //   tipo 'automatico' → el turno seguía abierto al pasar la medianoche y la API lo cerró sola
        //                       la siguiente vez que alguien entró (cerrado_en = esa medianoche).
        // Guarda lo vendido al momento del cierre y cuántas órdenes quedaron sin cobrar.
        Schema::create('cierres_turno', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('turno_id')->unique(); // un solo cierre por turno
            $table->foreign('turno_id')->references('idTurno')->on('turnos')->cascadeOnUpdate()->cascadeOnDelete();
            $table->string('tipo', 20);
            $table->string('usuario_id', 64)->nullable(); // usuarios.id de quien hizo el corte; NULL en el automático
            $table->timestamp('cerrado_en')->useCurrent();
            $table->unsignedInteger('ordenes_cobradas')->default(0);
            $table->decimal('total_vendido', 12, 2)->default(0);
            $table->unsignedInteger('ordenes_pendientes')->default(0);
            $table->timestamp('creado_en')->useCurrent();
            $table->timestamp('actualizado_en')->useCurrent()->useCurrentOnUpdate();
        });

        // Turnos que ya estaban cerrados: su registro con lo que se vendió (no se sabe quién hizo el corte).
        DB::statement(
            "INSERT INTO cierres_turno (turno_id, tipo, usuario_id, cerrado_en, ordenes_cobradas, total_vendido, ordenes_pendientes, creado_en, actualizado_en)
             SELECT t.idTurno, 'corte', NULL, t.fecha_fin,
                    COUNT(CASE WHEN o.estatus = 2 THEN 1 END),
                    COALESCE(SUM(CASE WHEN o.estatus = 2 THEN o.total END), 0),
                    COUNT(CASE WHEN o.estatus = 1 OR (o.estatus = 0 AND o.total > 0) THEN 1 END),
                    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
               FROM turnos t
               LEFT JOIN orden o ON o.idTurno = t.idTurno
              WHERE t.estatus = 0 AND t.fecha_fin IS NOT NULL
              GROUP BY t.idTurno, t.fecha_fin"
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('cierres_turno');
    }
};
