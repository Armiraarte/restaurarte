<?php

namespace Database\Seeders;

use App\Models\Categoria;
use App\Models\Producto;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Agrega Naturales a los sabores de Alitas, al precio por pieza de los demás sabores (sin complementos, como ellos).
 * Repetible sin duplicar ni regresar un precio ajustado después.
 */
class AlitasNaturalesSeeder extends Seeder
{
    public const SABOR = 'Naturales';

    public function run(): void
    {
        DB::transaction(function (): void {
            $alitas = Categoria::where('nombre', 'Alitas')->firstOrFail();
            $precio = $alitas->productos()->where('nombre', '<>', self::SABOR)->where('precio', '>', 0)->orderBy('id')->value('precio') ?? '13.00';
            Producto::firstOrCreate(
                ['categoria_id' => $alitas->id, 'nombre' => self::SABOR, 'tamano' => null],
                ['precio' => $precio, 'estatus' => 1],
            );
        });
    }
}
