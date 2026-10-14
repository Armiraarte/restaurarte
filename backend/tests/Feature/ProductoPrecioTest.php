<?php

namespace Tests\Feature;

use App\Models\Categoria;
use App\Models\Producto;
use Database\Seeders\CategoriaSeeder;
use Database\Seeders\ComplementoSeeder;
use Database\Seeders\ProductoPrecioSeeder;
use Database\Seeders\ProductoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use Tests\TestCase;

class ProductoPrecioTest extends TestCase
{
    use RefreshDatabase;

    private function cargar(): void
    {
        $this->seed([CategoriaSeeder::class, ComplementoSeeder::class, ProductoSeeder::class, ProductoPrecioSeeder::class]);
    }

    private function precio(string $categoria, string $nombre, ?string $tamano = null): string
    {
        return Producto::where('categoria_id', Categoria::where('nombre', $categoria)->value('id'))
            ->where('nombre', $nombre)->where('tamano', $tamano)->firstOrFail()->precio;
    }

    public function test_cada_producto_tiene_su_precio_del_menu(): void
    {
        $this->cargar();

        $this->assertSame(0, Producto::where('precio', 0)->count());
        $this->assertSame('10.00', $this->precio('Tacos Dorados', 'Frijol'));
        $this->assertSame('18.00', $this->precio('Tacos', 'Barbacoa'));
        $this->assertSame('15.00', $this->precio('Papas a la Francesa', 'Papas a la Francesa', 'Media orden'));
        $this->assertSame('30.00', $this->precio('Papas a la Francesa', 'Papas a la Francesa', 'Orden completa'));
        $this->assertSame('70.00', $this->precio('Ensaladas', 'Pollo a la plancha', 'Grande'));
        $this->assertSame('40.00', $this->precio('Bebidas', 'Agua de Lima', 'Grande'));
        $this->assertSame('25.00', $this->precio('Bebidas', 'Coca 1/2'));
    }

    public function test_repetir_no_cambia_un_precio_registrado(): void
    {
        $this->cargar();
        $frijol = Producto::where('nombre', 'Frijol')->firstOrFail();
        $frijol->update(['precio' => '12.50']);

        $this->seed(ProductoPrecioSeeder::class);

        $this->assertSame('12.50', $frijol->fresh()->precio);
    }

    public function test_no_acepta_precios_negativos(): void
    {
        $this->cargar();

        $this->expectException(InvalidArgumentException::class);
        Producto::where('nombre', 'Frijol')->firstOrFail()->update(['precio' => '-1']);
    }
}
