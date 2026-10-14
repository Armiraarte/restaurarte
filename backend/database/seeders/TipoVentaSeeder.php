<?php

namespace Database\Seeders;

use App\Models\TipoVenta;
use Illuminate\Database\Seeder;

class TipoVentaSeeder extends Seeder
{
    public function run(): void
    {
        TipoVenta::firstOrCreate(['id' => TipoVenta::COMER_AQUI], [
            'codigo' => 'comer_aqui',
            'nombre' => 'Comer aquí',
        ]);

        TipoVenta::firstOrCreate(['id' => TipoVenta::PARA_LLEVAR], [
            'codigo' => 'para_llevar',
            'nombre' => 'Para llevar',
        ]);
    }
}
