<?php

namespace Database\Seeders;

use App\Models\Complemento;
use App\Models\Producto;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/** Agrega el complemento Jitomate a todas las tostadas; repetible sin duplicar ni quitar los demás. */
class TostadasJitomateSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function (): void {
            $jitomate = Complemento::firstOrCreate(['nombre' => 'Jitomate'], ['estatus' => 1]);
            Producto::whereHas('categoria', fn ($q) => $q->where('nombre', 'Tostadas'))
                ->each(fn (Producto $p) => $p->complementos()->syncWithoutDetaching([$jitomate->id]));
        });
    }
}
