<?php

namespace Tests\Feature;

use App\Models\Categoria;
use App\Models\Producto;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use Tests\TestCase;

class ProductoTest extends TestCase
{
    use RefreshDatabase;

    private Categoria $tacos;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tacos = Categoria::create(['nombre' => 'Tacos']);
    }

    public function test_crea_un_producto_vinculado_a_su_categoria(): void
    {
        $producto = Producto::create(['categoria_id' => $this->tacos->id, 'nombre' => '  Taco  ', 'imagen' => 'productos/taco.jpg'])->fresh();
        $siguiente = Producto::create(['categoria_id' => $this->tacos->id, 'nombre' => 'Taco de pastor'])->fresh();

        $this->assertIsInt($producto->id);
        $this->assertSame($producto->id + 1, $siguiente->id);
        $this->assertSame('Taco', $producto->nombre);
        $this->assertSame(1, $producto->estatus);
        $this->assertSame('productos/taco.jpg', $producto->imagen);
        $this->assertNull($siguiente->imagen);
        $this->assertNotNull($producto->creado_en);
        $this->assertTrue($producto->categoria->is($this->tacos));
        $this->assertCount(2, $this->tacos->productos);
    }

    public function test_no_repite_nombre_dentro_de_la_misma_categoria(): void
    {
        Producto::create(['categoria_id' => $this->tacos->id, 'nombre' => 'Taco']);
        Producto::create(['categoria_id' => Categoria::create(['nombre' => 'Tacos Dorados'])->id, 'nombre' => 'Taco']);

        $this->expectException(QueryException::class);
        Producto::create(['categoria_id' => $this->tacos->id, 'nombre' => 'Taco']);
    }

    public function test_rechaza_categorias_inexistentes_y_nombres_vacios(): void
    {
        $this->expectException(InvalidArgumentException::class);
        Producto::create(['categoria_id' => 999, 'nombre' => 'Taco']);
    }

    public function test_no_se_puede_borrar_una_categoria_con_productos(): void
    {
        Producto::create(['categoria_id' => $this->tacos->id, 'nombre' => 'Taco']);

        $this->expectException(QueryException::class);
        $this->tacos->delete();
    }
}
