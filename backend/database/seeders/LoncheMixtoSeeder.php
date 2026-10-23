<?php

namespace Database\Seeders;

use App\Models\Categoria;
use App\Models\Complemento;
use App\Models\Producto;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/** Agrega el Lonche Mixto ($70) con los mismos complementos que los demás lonches; repetible sin duplicar. */
class LoncheMixtoSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function (): void {
            $lonches = Categoria::where('nombre', 'Lonches')->firstOrFail();
            // firstOrCreate: si después se ajusta su precio, repetir la carga no lo regresa.
            $mixto = Producto::firstOrCreate(
                ['categoria_id' => $lonches->id, 'nombre' => 'Mixto', 'tamano' => null],
                ['precio' => '70.00', 'estatus' => 1],
            );
            // Los complementos que ya tienen los demás lonches (Catsup, Aderezo, Lechuga, Queso, Salsa verde…).
            $ids = DB::table('producto_has_complemento')
                ->join('producto', 'producto.id', '=', 'producto_has_complemento.producto_id')
                ->where('producto.categoria_id', $lonches->id)
                ->where('producto.id', '!=', $mixto->id)
                ->distinct()
                ->pluck('producto_has_complemento.complemento_id')
                ->all();
            if (! $ids) {
                $ids = Complemento::whereIn('nombre', ['Catsup', 'Aderezo', 'Lechuga', 'Jitomate', 'Cebolla', 'Chile', 'Cilantro', 'Queso', 'Salsa verde'])
                    ->pluck('id')->all();
            }
            $mixto->complementos()->syncWithoutDetaching($ids);
        });
    }
}
