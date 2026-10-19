<?php

namespace Database\Seeders;

use App\Models\Categoria;
use App\Models\Producto;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/** Cambia el nombre de la bebida existente y agrega Coquita sin recrear ventas. */
class AjusteBebidasSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function (): void {
            $bebidas = Categoria::where('nombre', 'Bebidas')->firstOrFail();
            $limita = $bebidas->productos()->whereNull('tamano')
                ->whereIn('nombre', ['Limón / Cereza', 'Lima / Cereza'])->first()
                ?? Producto::firstOrNew(['categoria_id' => $bebidas->id, 'nombre' => 'Limita', 'tamano' => null]);
            if (! $limita->exists) {
                $limita->precio = '60.00';
            }
            $limita->fill(['nombre' => 'Limita', 'grupo' => 'Alcohol', 'estatus' => 1])->save();

            Producto::updateOrCreate(
                ['categoria_id' => $bebidas->id, 'nombre' => 'Coquita 235', 'tamano' => null],
                ['grupo' => 'Refrescos', 'precio' => '20.00', 'estatus' => 1],
            );
        });
    }
}
