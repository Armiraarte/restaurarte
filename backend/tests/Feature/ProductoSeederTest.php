<?php

namespace Tests\Feature;

use App\Models\Categoria;
use App\Models\Complemento;
use App\Models\Producto;
use Database\Seeders\CategoriaSeeder;
use Database\Seeders\ComplementoSeeder;
use Database\Seeders\ProductoSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductoSeederTest extends TestCase
{
    use RefreshDatabase;

    private function cargar(): void
    {
        $this->seed([CategoriaSeeder::class, ComplementoSeeder::class, ProductoSeeder::class]);
    }

    public function test_carga_los_productos_en_su_categoria_con_tamano_solo_donde_aplica(): void
    {
        $this->cargar();

        $this->assertSame(69, Producto::count());
        $dorados = Categoria::where('nombre', 'Tacos Dorados')->firstOrFail();
        $this->assertSame(['Papa', 'Frijol', 'Jamón', 'Salchicha'], $dorados->productos()->orderBy('id')->pluck('nombre')->all());
        $this->assertNull(Producto::where('nombre', 'Frijol')->firstOrFail()->tamano);

        $lima = Producto::where('nombre', 'Agua de Lima')->orderBy('id')->pluck('tamano')->all();
        $this->assertSame(['Chica', 'Mediana', 'Grande'], $lima);
        $this->assertSame(9, Producto::whereNotNull('tamano')->count());
    }

    public function test_carga_los_complementos_sin_repetir(): void
    {
        $this->cargar();

        $this->assertSame(ComplementoSeeder::COMPLEMENTOS, Complemento::orderBy('id')->pluck('nombre')->all());
        $this->assertSame(12, Complemento::count());
    }

    public function test_repetir_no_duplica(): void
    {
        $this->cargar();
        $this->cargar();

        $this->assertSame(69, Producto::count());
        $this->assertSame(12, Complemento::count());
    }

    public function test_mismo_nombre_y_categoria_solo_con_tamano_distinto(): void
    {
        $this->cargar();
        $ensaladas = Categoria::where('nombre', 'Ensaladas')->firstOrFail();

        // "Milanesa" Chica y Grande conviven; repetir el mismo sin tamaño dos veces no.
        Producto::create(['categoria_id' => $ensaladas->id, 'nombre' => 'Milanesa']);
        $this->expectException(QueryException::class);
        Producto::create(['categoria_id' => $ensaladas->id, 'nombre' => 'Milanesa', 'tamano' => '  ']);
    }
}
