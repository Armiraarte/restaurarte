<?php

namespace Database\Seeders;

use App\Models\Categoria;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * Asigna producto.grupo: subgrupos de una categoría para acomodar el menú de la tablet
 * (pestañas en Bebidas). El orden de los grupos es el de las pestañas.
 */
class ProductoGrupoSeeder extends Seeder
{
    /** Categoría => [grupo => nombres de sus productos (todos sus tamaños)]. */
    public const GRUPOS = [
        'Bebidas' => [
            'Refrescos' => [
                'Coca-Cola', 'Coca 1/2', 'Coca Light', 'Coca Zero', 'Pepsi', '7UP', 'Mirinda', 'Manzanita', 'Sangría',
            ],
            'Aguas' => ['Agua de Lima', 'Agua Natural', 'Agua Mineral'],
            'Jugos' => ['Jumex Durazno', 'Jumex Manzana'],
            'Alcohol' => ['Limón / Cereza', 'Cerveza'],
        ],
    ];

    public function run(): void
    {
        foreach (self::GRUPOS as $nombreCategoria => $grupos) {
            $categoria = Categoria::where('nombre', $nombreCategoria)->first()
                ?? throw new RuntimeException("Falta la categoría {$nombreCategoria}: ejecuta antes CategoriaSeeder.");

            foreach ($grupos as $grupo => $nombres) {
                // Repetir la carga deja el mismo grupo; un producto que ya no existe simplemente no se toca.
                $categoria->productos()->whereIn('nombre', $nombres)->update(['grupo' => $grupo]);
            }
        }
    }
}
