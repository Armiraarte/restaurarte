<?php

namespace Database\Seeders;

use App\Models\Categoria;
use App\Models\Producto;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/** Agrega Pierna con el precio y los complementos de un sope de la casa, sin duplicar ni cambiar precios existentes. */
class SopePiernaSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function (): void {
            $sopes = Categoria::where('nombre', 'Sopes')->firstOrFail();
            $referencia = $sopes->productos()
                ->whereNotIn('nombre', ['Pierna', 'Queso'])
                ->whereNull('tamano')
                ->where('estatus', 1)
                ->orderBy('id')
                ->firstOrFail();

            $pierna = Producto::firstOrCreate(
                ['categoria_id' => $sopes->id, 'nombre' => 'Pierna', 'tamano' => null],
                ['precio' => $referencia->precio, 'estatus' => 1],
            );
            $pierna->complementos()->syncWithoutDetaching($referencia->complementos()->pluck('complementos.id')->all());
        });
    }
}
