<?php

namespace Database\Seeders;

use App\Models\Termino;
use Illuminate\Database\Seeder;

class TerminoSeeder extends Seeder
{
    public function run(): void
    {
        foreach (['Blando', 'Medio', 'Dorado'] as $nombre) {
            Termino::firstOrCreate(['nombre' => $nombre], ['estatus' => 1]);
        }
    }
}
