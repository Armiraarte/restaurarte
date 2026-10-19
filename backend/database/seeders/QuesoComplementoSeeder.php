<?php

namespace Database\Seeders;

use App\Models\Complemento;
use App\Models\Producto;
use Illuminate\Database\Seeder;

/** Mueve la elección de queso al grupo de complementos sin cambiar precios. */
class QuesoComplementoSeeder extends Seeder
{
    public function run(): void
    {
        $queso = Complemento::firstOrCreate(['nombre' => 'Queso'], ['estatus' => 1]);
        Producto::whereHas('categoria', fn ($q) => $q->whereIn('nombre', ['Tacos', 'Sopes', 'Quesadillas', 'Hamburguesas', 'Lonches']))
            ->each(fn (Producto $p) => $p->complementos()->syncWithoutDetaching([$queso->id]));
    }
}
