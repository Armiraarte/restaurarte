<?php

namespace Database\Seeders;

use App\Models\Orden;
use App\Models\TipoVenta;
use Illuminate\Database\Seeder;

class OrdenSeeder extends Seeder
{
    public function run(): void
    {
        // Orden de la mesa 1, sin cuenta abierta.
        // Repetir la carga conserva el total, tipo de orden y estatus existentes.
        Orden::firstOrCreate(['codigo' => '1'], [
            'nombre' => '1',
            'tipo_orden' => TipoVenta::COMER_AQUI,
            'total' => '0.00',
            'estatus' => 0, // abierta
        ]);
    }
}
