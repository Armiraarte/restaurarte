<?php

namespace Database\Seeders;

use App\Models\Categoria;
use App\Models\Producto;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/** Agrega Pollo a los rellenos de Burritas con el precio y los complementos de las demás, sin duplicar ni cambiar precios. */
class BurritaPolloSeeder extends Seeder
{
    public const RELLENO = 'Pollo';

    public function run(): void
    {
        DB::transaction(function (): void {
            $burritas = Categoria::where('nombre', 'Burritas')->firstOrFail();
            $referencia = $burritas->productos()
                ->where('nombre', '<>', self::RELLENO)
                ->whereNull('tamano')
                ->where('estatus', 1)
                ->orderBy('id')
                ->firstOrFail();

            $pollo = Producto::firstOrCreate(
                ['categoria_id' => $burritas->id, 'nombre' => self::RELLENO, 'tamano' => null],
                ['precio' => $referencia->precio, 'estatus' => 1],
            );
            $pollo->complementos()->syncWithoutDetaching($referencia->complementos()->pluck('complementos.id')->all());
        });
    }
}
