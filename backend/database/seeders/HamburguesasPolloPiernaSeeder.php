<?php

namespace Database\Seeders;

use App\Models\Categoria;
use App\Models\Complemento;
use App\Models\Producto;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Agrega las hamburguesas de Pollo y de Pierna con el precio y los complementos de las demás hamburguesas
 * (Pollo a la plancha, Res, Milanesa). Repetible sin duplicar ni regresar un precio ajustado después.
 */
class HamburguesasPolloPiernaSeeder extends Seeder
{
    public const NUEVAS = ['Pollo', 'Pierna'];

    public function run(): void
    {
        DB::transaction(function (): void {
            $hamburguesas = Categoria::where('nombre', 'Hamburguesas')->firstOrFail();
            $hermanas = $hamburguesas->productos()->whereNotIn('nombre', self::NUEVAS);
            $precio = (clone $hermanas)->where('precio', '>', 0)->orderBy('id')->value('precio') ?? '50.00';
            $ids = DB::table('producto_has_complemento')
                ->whereIn('producto_id', (clone $hermanas)->pluck('id'))
                ->distinct()
                ->pluck('complemento_id')
                ->all();
            if (! $ids) {
                $ids = Complemento::whereIn('nombre', ['Catsup', 'Cebolla', 'Chile', 'Jitomate', 'Lechuga', 'Queso'])->pluck('id')->all();
            }
            foreach (self::NUEVAS as $nombre) {
                $producto = Producto::firstOrCreate(
                    ['categoria_id' => $hamburguesas->id, 'nombre' => $nombre, 'tamano' => null],
                    ['precio' => $precio, 'estatus' => 1],
                );
                $producto->complementos()->syncWithoutDetaching($ids);
            }
        });
    }
}
