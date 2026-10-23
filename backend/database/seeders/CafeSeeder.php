<?php

namespace Database\Seeders;

use App\Models\Categoria;
use App\Models\Producto;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/** Agrega Café ($25) en Bebidas, dentro de Aguas; repetible sin duplicar ni regresar un precio ajustado. */
class CafeSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function (): void {
            $bebidas = Categoria::where('nombre', 'Bebidas')->firstOrFail();
            $cafe = Producto::firstOrCreate(
                ['categoria_id' => $bebidas->id, 'nombre' => 'Café', 'tamano' => null],
                ['grupo' => 'Aguas', 'precio' => '25.00', 'estatus' => 1],
            );
            if ($cafe->grupo !== 'Aguas') {
                $cafe->update(['grupo' => 'Aguas']);
            }
        });
    }
}
