<?php

namespace Database\Seeders;

use App\Models\Complemento;
use App\Models\Producto;
use Illuminate\Database\Seeder;

/** Ajuste puntual, repetible, sin cambiar precios ni los demás complementos. */
class QuesoMenuSeeder extends Seeder
{
    public function run(): void
    {
        $queso = Complemento::firstOrCreate(['nombre' => 'Queso'], ['estatus' => 1]);
        Producto::whereHas('categoria', fn ($q) => $q->where('nombre', 'Tacos'))
            ->each(fn (Producto $p) => $p->complementos()->detach($queso->id));
        Producto::whereHas('categoria', fn ($q) => $q->where('nombre', 'Sopes'))
            ->each(fn (Producto $p) => $p->complementos()->syncWithoutDetaching([$queso->id]));
    }
}
