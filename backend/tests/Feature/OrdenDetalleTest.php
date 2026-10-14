<?php

namespace Tests\Feature;

use App\Models\Orden;
use App\Models\OrdenDetalle;
use App\Models\Producto;
use Database\Seeders\CategoriaSeeder;
use Database\Seeders\ComplementoSeeder;
use Database\Seeders\ProductoPrecioSeeder;
use Database\Seeders\ProductoSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use Tests\TestCase;

class OrdenDetalleTest extends TestCase
{
    use RefreshDatabase;

    private Orden $orden;

    private Producto $frijol;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([CategoriaSeeder::class, ComplementoSeeder::class, ProductoSeeder::class, ProductoPrecioSeeder::class]);
        $this->orden = Orden::create(['codigo' => '5']);
        $this->frijol = Producto::where('nombre', 'Frijol')->firstOrFail(); // Tacos Dorados, $10.00
    }

    public function test_registra_producto_y_cantidad_con_subtotal_calculado(): void
    {
        $detalle = OrdenDetalle::create(['idOrden' => $this->orden->idOrden, 'idProducto' => $this->frijol->id, 'cantidad' => 3])->fresh();

        $this->assertIsInt($detalle->idDetalle_Orden);
        $this->assertSame(3, $detalle->cantidad);
        $this->assertSame('30.00', $detalle->subtotal);
        $this->assertTrue($detalle->orden->is($this->orden));
        $this->assertTrue($detalle->producto->is($this->frijol));
        $this->assertCount(1, $this->orden->detalles);
    }

    public function test_el_subtotal_no_cambia_si_despues_cambia_el_precio(): void
    {
        $detalle = OrdenDetalle::create(['idOrden' => $this->orden->idOrden, 'idProducto' => $this->frijol->id, 'cantidad' => 2]);
        $this->frijol->update(['precio' => '12.00']);

        $this->assertSame('20.00', $detalle->fresh()->subtotal);
    }

    public function test_rechaza_cantidad_cero(): void
    {
        $this->expectException(InvalidArgumentException::class);
        OrdenDetalle::create(['idOrden' => $this->orden->idOrden, 'idProducto' => $this->frijol->id, 'cantidad' => 0]);
    }

    public function test_borrar_la_orden_borra_su_detalle_y_no_se_borra_un_producto_vendido(): void
    {
        OrdenDetalle::create(['idOrden' => $this->orden->idOrden, 'idProducto' => $this->frijol->id, 'cantidad' => 1]);

        try {
            $this->frijol->delete();
            $this->fail('Un producto vendido no se debe poder borrar.');
        } catch (QueryException) {
            $this->assertNotNull($this->frijol->fresh());
        }

        $this->orden->delete();
        $this->assertSame(0, OrdenDetalle::count());
    }
}
