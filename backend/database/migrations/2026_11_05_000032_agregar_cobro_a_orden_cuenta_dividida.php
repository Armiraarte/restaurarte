<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Cobro de cada cuenta dividida: en Cajas cada Cuenta 1…N se cobra por separado. Cuando se pagan todas,
 * la orden pasa a PAGADO. Nulas = por cobrar (las divisiones anteriores quedan igual).
 *   recibido    → con cuánto pagó esa persona (efectivo); el cambio es recibido − importe
 *   cobrada_por → quién la cobró en caja
 *   pagada_en   → cuándo
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orden_cuenta_dividida', function (Blueprint $table): void {
            $table->decimal('recibido', 12, 2)->nullable();
            $table->string('cobrada_por', 60)->nullable();
            $table->timestamp('pagada_en')->nullable();
        });
        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement('ALTER TABLE orden_cuenta_dividida
                ADD CONSTRAINT orden_cuenta_dividida_recibido CHECK (recibido IS NULL OR recibido >= importe)');
        }
    }

    public function down(): void
    {
        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement('ALTER TABLE orden_cuenta_dividida DROP CONSTRAINT orden_cuenta_dividida_recibido');
        }
        Schema::table('orden_cuenta_dividida', function (Blueprint $table): void {
            $table->dropColumn(['recibido', 'cobrada_por', 'pagada_en']);
        });
    }
};
