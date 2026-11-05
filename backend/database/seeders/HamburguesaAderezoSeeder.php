<?php

namespace Database\Seeders;

use App\Models\Complemento;
use App\Models\Producto;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Agrega Aderezo a los complementos de todas las hamburguesas (incluido de base; en la tablet se puede quitar).
 * No cambia precios ni los demás complementos. Repetible sin duplicar.
 */
class HamburguesaAderezoSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function (): void {
            $aderezo = Complemento::firstOrCreate(['nombre' => 'Aderezo'], ['estatus' => 1]);
            Producto::whereHas('categoria', fn ($q) => $q->where('nombre', 'Hamburguesas'))
                ->each(fn (Producto $p) => $p->complementos()->syncWithoutDetaching([$aderezo->id]));
        });
    }
}
