<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Cuentas divididas (botón Dividir en la pantalla de la orden): una fila por persona, Cuenta 1…N de la orden.
 * La orden y su total no cambian; esto solo registra cómo se repartió y lo que lleva el ticket de cada quien.
 * contenido (JSON, solo «por productos»): { productos: [{ cantidad, nombre, importe }], extras: [{ descripcion, importe }] }.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orden_cuenta_dividida', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('idOrden');
            $table->foreign('idOrden')->references('idOrden')->on('orden')->cascadeOnDelete();
            $table->unsignedTinyInteger('numero');
            $table->unsignedTinyInteger('personas');
            $table->string('modo', 10);
            $table->decimal('importe', 12, 2);
            $table->decimal('total_orden', 12, 2);
            $table->json('contenido')->nullable();
            $table->string('creado_por', 60);
            $table->timestamp('creado_en')->useCurrent();
            $table->unique(['idOrden', 'numero']);
        });
        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement("ALTER TABLE orden_cuenta_dividida
                ADD CONSTRAINT orden_cuenta_dividida_modo CHECK (modo IN ('iguales', 'productos')),
                ADD CONSTRAINT orden_cuenta_dividida_numero CHECK (numero BETWEEN 1 AND personas),
                ADD CONSTRAINT orden_cuenta_dividida_importe CHECK (importe >= 0)");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('orden_cuenta_dividida');
    }
};
