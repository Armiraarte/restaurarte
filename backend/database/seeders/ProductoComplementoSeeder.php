<?php

namespace Database\Seeders;

use App\Models\Categoria;
use App\Models\Complemento;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * Llena producto_has_complemento: cada producto de una categoría lleva los complementos que esa
 * categoría usa en el menú actual (grupos de complementos / ingredientes de dataService.ts).
 * Las categorías que no aparecen aquí (Papas, Alitas, Bebidas) no llevan complementos.
 */
class ProductoComplementoSeeder extends Seeder
{
    /** Categoría => complementos de sus productos. */
    public const COMPLEMENTOS_POR_CATEGORIA = [
        'Tacos Dorados' => ['Repollo', 'Lechuga', 'Salsa', 'Crema'],
        'Tacos' => ['Queso', 'Cilantro', 'Cebolla', 'Salsa'],
        'Quesadillas' => ['Repollo', 'Lechuga', 'Salsa', 'Crema'],
        'Sopes' => ['Repollo', 'Lechuga', 'Salsa', 'Crema', 'Queso'],
        'Enchiladas' => ['Repollo', 'Lechuga', 'Salsa', 'Crema', 'Queso'],
        'Tostadas' => ['Repollo', 'Lechuga', 'Salsa', 'Crema', 'Queso'],
        'Burritas' => ['Lechuga', 'Jitomate', 'Cebolla', 'Chile', 'Aderezo'],
        'Lonches' => ['Catsup', 'Aderezo', 'Lechuga', 'Jitomate', 'Cebolla', 'Chile', 'Cilantro'],
        'Hamburguesas' => ['Lechuga', 'Jitomate', 'Cebolla', 'Chile', 'Catsup'],
        'Ensaladas' => ['Jitomate', 'Pepino', 'Chile', 'Cebolla'],
        'Salchichas' => ['Repollo', 'Salsa', 'Crema'],
    ];

    public function run(): void
    {
        $complementos = Complemento::pluck('id', 'nombre');

        foreach (self::COMPLEMENTOS_POR_CATEGORIA as $nombreCategoria => $nombres) {
            $categoria = Categoria::where('nombre', $nombreCategoria)->first()
                ?? throw new RuntimeException("Falta la categoría {$nombreCategoria}: ejecuta antes CategoriaSeeder.");

            $ids = array_map(
                fn (string $nombre) => $complementos[$nombre]
                    ?? throw new RuntimeException("Falta el complemento {$nombre}: ejecuta antes ComplementoSeeder."),
                $nombres,
            );

            // syncWithoutDetaching: agrega las relaciones que falten sin duplicar ni quitar las existentes.
            foreach ($categoria->productos as $producto) {
                $producto->complementos()->syncWithoutDetaching($ids);
            }
        }
    }
}
