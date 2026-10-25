<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orden', function (Blueprint $table): void {
            $table->string('origen', 10)->nullable();
        });
        DB::table('orden')->orderBy('idOrden')->chunkById(200, function ($ordenes): void {
            foreach ($ordenes as $orden) {
                $origen = ctype_digit((string) $orden->nombre) ? 'mesa' : 'nombre';
                if ($origen === 'nombre' && DB::table('orden_has_detalle')->where('idOrden', $orden->idOrden)
                    ->where('opciones->comanda->tipoPedido', 'llamada')->exists()) {
                    $origen = 'llamada';
                }
                DB::table('orden')->where('idOrden', $orden->idOrden)->update(['origen' => $origen]);
            }
        }, 'idOrden');
    }

    public function down(): void
    {
        Schema::table('orden', fn (Blueprint $table) => $table->dropColumn('origen'));
    }
};
