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

    public function test_la_quesadilla_lleva_queso_sin_registrarlo_y_se_registra_sin_queso(): void
    {
        $quesadilla = Producto::whereHas('categoria', fn ($q) => $q->where('nombre', 'Quesadillas'))
            ->where('nombre', 'Papa')->firstOrFail();

        $conQueso = OrdenDetalle::create(['idOrden' => $this->orden->idOrden, 'idProducto' => $quesadilla->id, 'cantidad' => 1])->fresh();
        $sinQueso = OrdenDetalle::create([
            'idOrden' => $this->orden->idOrden, 'idProducto' => $quesadilla->id, 'cantidad' => 2, 'sin_queso' => true,
        ])->fresh();

        $this->assertFalse($conQueso->sin_queso);
        $this->assertTrue($sinQueso->sin_queso);
        $this->assertSame('30.00', $sinQueso->subtotal); // sin queso cuesta igual
    }

    public function test_la_hamburguesa_con_doble_y_triple_carne_suma_20_por_carne_extra(): void
    {
        $hamburguesa = Producto::whereHas('categoria', fn ($q) => $q->where('nombre', 'Hamburguesas'))
            ->where('nombre', 'Res')->firstOrFail(); // $50.00

        $doble = OrdenDetalle::create(['idOrden' => $this->orden->idOrden, 'idProducto' => $hamburguesa->id, 'cantidad' => 2, 'carne_extra' => 1])->fresh();
        $triple = OrdenDetalle::create(['idOrden' => $this->orden->idOrden, 'idProducto' => $hamburguesa->id, 'cantidad' => 1, 'carne_extra' => 2])->fresh();
        $normal = OrdenDetalle::create(['idOrden' => $this->orden->idOrden, 'idProducto' => $hamburguesa->id, 'cantidad' => 1])->fresh();

        $this->assertSame('140.00', $doble->subtotal); // 2 × (50 + 20)
        $this->assertSame('90.00', $triple->subtotal); // 50 + 2 × 20
        $this->assertSame(0, $normal->carne_extra);
        $this->assertSame('50.00', $normal->subtotal);
    }

    public function test_solo_las_hamburguesas_llevan_carne_extra_y_hasta_triple(): void
    {
        $hamburguesa = Producto::whereHas('categoria', fn ($q) => $q->where('nombre', 'Hamburguesas'))->firstOrFail();

        foreach ([[$this->frijol->id, 1], [$hamburguesa->id, 3]] as [$idProducto, $carneExtra]) {
            try {
                OrdenDetalle::create(['idOrden' => $this->orden->idOrden, 'idProducto' => $idProducto, 'cantidad' => 1, 'carne_extra' => $carneExtra]);
                $this->fail("Debió rechazar carne_extra={$carneExtra} en el producto {$idProducto}.");
            } catch (InvalidArgumentException) {
                $this->addToAssertionCount(1);
            }
        }
    }

    public function test_solo_las_quesadillas_se_piden_sin_queso(): void
    {
        $this->expectException(InvalidArgumentException::class);
        OrdenDetalle::create(['idOrden' => $this->orden->idOrden, 'idProducto' => $this->frijol->id, 'cantidad' => 1, 'sin_queso' => true]);
    }

    public function test_rechaza_cantidad_cero(): void
    {
        $this->expectException(InvalidArgumentException::class);
        OrdenDetalle::create(['idOrden' => $this->orden->idOrden, 'idProducto' => $this->frijol->id, 'cantidad' => 0]);
    }

    public function test_mix_guarda_cada_producto_y_sus_opciones_sin_modificar_el_precio(): void
    {
        $taco = Producto::whereHas('categoria', fn ($q) => $q->where('nombre', 'Tacos'))->firstOrFail();
        $opciones = ['sin' => [['id' => 5, 'nombre' => 'Cebolla']], 'mezcla' => []];
        $uno = OrdenDetalle::create([
            'idOrden' => $this->orden->idOrden, 'idProducto' => $taco->id, 'cantidad' => 2,
            'con_queso' => true, 'mix_grupo' => 1, 'opciones' => $opciones,
        ])->fresh();
        $dos = OrdenDetalle::create([
            'idOrden' => $this->orden->idOrden, 'idProducto' => $this->frijol->id, 'cantidad' => 3, 'mix_grupo' => 1,
        ])->fresh();
        $this->assertCount(2, $this->orden->fresh()->detalles);
        $this->assertSame(1, $uno->mix_grupo);
        $this->assertSame($uno->mix_grupo, $dos->mix_grupo);
        $this->assertTrue($uno->con_queso);
        $this->assertEquals(2 * (float) $taco->precio, (float) $uno->subtotal);
        $this->assertSame('30.00', $dos->subtotal);
        $this->assertSame($opciones, $uno->opciones);
    }

    public function test_rechaza_con_queso_fuera_de_tacos(): void
    {
        $this->expectException(InvalidArgumentException::class);
        OrdenDetalle::create(['idOrden' => $this->orden->idOrden, 'idProducto' => $this->frijol->id, 'cantidad' => 1, 'con_queso' => true]);
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
