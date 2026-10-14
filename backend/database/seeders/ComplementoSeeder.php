<?php

namespace Database\Seeders;

use App\Models\Complemento;
use Illuminate\Database\Seeder;

class ComplementoSeeder extends Seeder
{
    public const COMPLEMENTOS = ['Crema', 'Salsa', 'Lechuga', 'Aderezo', 'Cebolla', 'Jitomate', 'Chile', 'Repollo', 'Queso', 'Catsup', 'Pepino'];

    public function run(): void
    {
        // Repetir la carga no duplica ni cambia el estatus de los existentes.
        foreach (self::COMPLEMENTOS as $nombre) {
            Complemento::firstOrCreate(['nombre' => $nombre], ['estatus' => 1]);
        }
    }
}
