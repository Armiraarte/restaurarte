<?php

namespace Database\Seeders;

use App\Models\Categoria;
use App\Models\Producto;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * Asigna producto.precio con los precios del menú actual (frontend/src/services/dataService.ts).
 * Cada categoría tiene un precio para todos sus productos; las excepciones van por nombre o tamaño.
 */
class ProductoPrecioSeeder extends Seeder
{
    /** Categoría => precio de todos sus productos, o [nombre o "nombre|tamaño" => precio]. */
    public const PRECIOS = [
        'Tacos Dorados' => '10.00',
        'Tacos' => '18.00',
        'Quesadillas' => '15.00',
        'Sopes' => '15.00',
        'Enchiladas' => '15.00',
        'Tostadas' => '15.00',
        'Burritas' => '20.00', // una pieza
        'Lonches' => '50.00', // sin papas
        'Hamburguesas' => '50.00', // sola
        'Ensaladas' => [
            'Milanesa|Chica' => '40.00', 'Milanesa|Grande' => '70.00',
            'Pollo a la plancha|Chica' => '40.00', 'Pollo a la plancha|Grande' => '70.00',
            'Sin carne|Chica' => '40.00', 'Sin carne|Grande' => '70.00',
            'Pierna|Chica' => '40.00', 'Pierna|Grande' => '70.00',
        ],
        'Papas a la Francesa' => ['Papas a la Francesa|Media orden' => '15.00', 'Papas a la Francesa|Orden completa' => '30.00'],
        'Alitas' => '13.00', // por pieza
        'Salchichas' => '10.00',
        'Bebidas' => [
            '7UP' => '20.00',
            'Agua de Lima|Chica' => '15.00',
            'Agua de Lima|Mediana' => '20.00',
            'Agua de Lima|Grande' => '40.00',
            'Agua Mineral' => '30.00',
            'Agua Natural' => '20.00',
            'Coca 1/2' => '25.00',
            'Coca Light' => '30.00',
            'Coca Zero' => '30.00',
            'Coca-Cola' => '30.00',
            'Coquita 235' => '20.00',
            'Jumex Durazno' => '30.00',
            'Jumex Manzana' => '30.00',
            'Limita' => '60.00',
            'Cerveza' => '30.00',
            'Manzanita' => '20.00',
            'Mirinda' => '20.00',
            'Pepsi' => '20.00',
            'Sangría' => '20.00',
        ],
    ];

    public function run(): void
    {
        foreach (self::PRECIOS as $nombreCategoria => $precios) {
            $categoria = Categoria::where('nombre', $nombreCategoria)->first()
                ?? throw new RuntimeException("Falta la categoría {$nombreCategoria}: ejecuta antes CategoriaSeeder.");

            foreach ($categoria->productos as $producto) {
                $clave = $producto->tamano === null ? $producto->nombre : "{$producto->nombre}|{$producto->tamano}";
                $precio = is_array($precios) ? ($precios[$clave] ?? null) : $precios;
                if ($precio === null) {
                    throw new RuntimeException("Falta el precio de {$nombreCategoria}: {$clave}.");
                }
                // Solo se asigna a productos sin precio (0.00): repetir la carga no cambia un precio ya registrado.
                if ((float) $producto->precio === 0.0) {
                    $producto->update(['precio' => $precio]);
                }
            }
        }

        $sinPrecio = Producto::where('precio', 0)->count();
        if ($sinPrecio > 0) {
            throw new RuntimeException("{$sinPrecio} productos quedaron sin precio.");
        }
    }
}
