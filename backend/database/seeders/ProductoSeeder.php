<?php

namespace Database\Seeders;

use App\Models\Categoria;
use App\Models\Producto;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * Productos del menú, cada uno en su categoría. Un producto es la opción principal de la categoría
 * (relleno, carne, tipo, sabor…) y, en bebidas, cada bebida. Los que se venden por tamaño llevan
 * una fila por tamaño; los demás, tamano = NULL.
 */
class ProductoSeeder extends Seeder
{
    /** Categoría => productos. Un producto es "Nombre" o ["Nombre", "Tamaño"]. */
    public const PRODUCTOS = [
        'Tacos Dorados' => ['Papa', 'Frijol', 'Jamón', 'Salchicha'],
        'Tacos' => ['Barbacoa', 'Chicharrón', 'Pollo'],
        'Quesadillas' => ['Papa', 'Frijol', 'Picadillo', 'Pollo', 'Queso', 'Jamón', 'Chicharrón', 'Jalapeño'],
        'Sopes' => ['Papa', 'Frijol', 'Picadillo', 'Pollo', 'Chicharrón'],
        'Enchiladas' => ['Papa', 'Frijol', 'Picadillo', 'Pollo', 'Queso/Cebolla'],
        'Tostadas' => ['Frijol', 'Jamón', 'Pierna', 'Pollo', 'Mixta', 'Cuerito'],
        'Burritas' => ['Pierna', 'Chicharrón', 'Milanesa'],
        'Lonches' => ['Pierna', 'Milanesa', 'Jamón', 'Barbacoa', 'Pollo'],
        'Hamburguesas' => ['Pollo a la plancha', 'Res', 'Milanesa'],
        'Ensaladas' => [
            ['Milanesa', 'Chica'], ['Milanesa', 'Grande'], ['Pollo a la plancha', 'Chica'], ['Pollo a la plancha', 'Grande'],
            ['Sin carne', 'Chica'], ['Sin carne', 'Grande'], ['Pierna', 'Chica'], ['Pierna', 'Grande'],
        ],
        'Papas a la Francesa' => [['Papas a la Francesa', 'Media orden'], ['Papas a la Francesa', 'Orden completa']],
        'Alitas' => ['Mango Habanero', 'Buffalo', 'BBQ'],
        'Salchichas' => ['Entera', 'Picada'],
        'Bebidas' => [
            '7UP', ['Agua de Lima', 'Chica'], ['Agua de Lima', 'Mediana'], ['Agua de Lima', 'Grande'], 'Agua Mineral', 'Agua Natural',
            'Coca 1/2', 'Coca Light', 'Coca Zero', 'Coca-Cola', 'Jumex Durazno', 'Jumex Manzana', 'Limón / Cereza',
            'Manzanita', 'Mirinda', 'Pepsi', 'Sangría',
        ],
    ];

    public function run(): void
    {
        foreach (self::PRODUCTOS as $nombreCategoria => $productos) {
            $categoria = Categoria::where('nombre', $nombreCategoria)->first()
                ?? throw new RuntimeException("Falta la categoría {$nombreCategoria}: ejecuta antes CategoriaSeeder.");

            foreach ($productos as $producto) {
                [$nombre, $tamano] = is_array($producto) ? $producto : [$producto, null];
                // Repetir la carga no duplica ni cambia el estatus o la imagen de los existentes.
                Producto::firstOrCreate(
                    ['categoria_id' => $categoria->id, 'nombre' => $nombre, 'tamano' => $tamano],
                    ['estatus' => 1],
                );
            }
        }
    }
}
