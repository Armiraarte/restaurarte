<?php

namespace Database\Seeders;

use App\Models\Categoria;
use Illuminate\Database\Seeder;

class CategoriaSeeder extends Seeder
{
    /** Categorías del menú de la aplicación (CATEGORIAS_PRODUCTO en frontend/src/services/dataService.ts), en su orden. */
    public const CATEGORIAS = [
        'Tacos Dorados',
        'Tacos',
        'Quesadillas',
        'Sopes',
        'Enchiladas',
        'Tostadas',
        'Burritas',
        'Lonches',
        'Hamburguesas',
        'Ensaladas',
        'Papas a la Francesa',
        'Alitas',
        'Salchichas',
        'Bebidas',
    ];

    public function run(): void
    {
        // Se insertan en el orden del menú (los IDs siguen ese orden en una tabla vacía).
        // Repetir la carga no duplica ni cambia el estatus de las existentes.
        foreach (self::CATEGORIAS as $nombre) {
            Categoria::firstOrCreate(['nombre' => $nombre], ['estatus' => 1]);
        }
    }
}
