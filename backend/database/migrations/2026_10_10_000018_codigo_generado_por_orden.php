<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Cada orden tiene su propio código generado y el número de mesa / nombre del cliente queda en `nombre`.
 *
 *   orden.codigo → "T{idTurno}-{consecutivo}" (T1-001, T1-002…), único: identifica la orden
 *   orden.nombre → "1" (Mesa 1) o "Juan"; se puede repetir: una vez cobrada la Mesa 1, la siguiente
 *                  Mesa 1 es una orden nueva y no se mezclan productos ni estatus.
 *
 * Solo puede haber una orden activa (ABIERTA o PAGANDO) con el mismo nombre en el turno; eso lo cuida la API.
 */
return new class extends Migration
{
    public function up(): void
    {
        // El índice único de `nombre` se llama distinto según la base (mesas_nombre_unique en MySQL).
        $unicoNombre = collect(Schema::getIndexes('orden'))
            ->first(fn (array $indice): bool => $indice['unique'] && ! $indice['primary'] && $indice['columns'] === ['nombre']);

        Schema::table('orden', function (Blueprint $table) use ($unicoNombre): void {
            if ($unicoNombre) {
                $table->dropUnique($unicoNombre['name']);
            }
            $table->index(['idTurno', 'nombre', 'estatus'], 'orden_turno_nombre_estatus_index');
        });

        // Las órdenes que ya existían reciben su código generado, en orden de creación dentro de cada turno.
        $consecutivos = [];
        foreach (DB::table('orden')->orderBy('idOrden')->get(['idOrden', 'idTurno']) as $orden) {
            $turno = $orden->idTurno ?? 0;
            $consecutivos[$turno] = ($consecutivos[$turno] ?? 0) + 1;
            DB::table('orden')->where('idOrden', $orden->idOrden)->update([
                'codigo' => sprintf('T%d-%03d', $turno, $consecutivos[$turno]),
            ]);
        }
    }

    public function down(): void
    {
        DB::table('orden')->update(['codigo' => DB::raw('nombre')]);

        Schema::table('orden', function (Blueprint $table): void {
            $table->dropIndex('orden_turno_nombre_estatus_index');
            $table->unique('nombre', 'mesas_nombre_unique');
        });
    }
};
