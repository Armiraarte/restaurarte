<?php

namespace Tests\Feature;

use App\Models\Orden;
use App\Models\OrdenExtra;
use App\Models\Producto;
use App\Models\Categoria;
use App\Models\OrdenDetalle;
use App\Models\Complemento;
use Database\Seeders\QuesoComplementoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use Tests\TestCase;

class OrdenExtraTest extends TestCase
{
    use RefreshDatabase;

    public function test_guarda_cobro_libre_sin_producto_y_suma_su_importe(): void
    {
        $categoria = Categoria::create(['nombre' => 'Tacos']);
        $producto = Producto::create(['categoria_id' => $categoria->id, 'nombre' => 'Pollo', 'precio' => '18.00']);
        $orden = Orden::create(['nombre' => '7']);
        OrdenDetalle::create(['idOrden' => $orden->idOrden, 'idProducto' => $producto->id, 'cantidad' => 1, 'mix_grupo' => 3]);
        $extra = OrdenExtra::create(['idOrden' => $orden->idOrden, 'descripcion' => ' Cargo  adicional ', 'importe' => '10.25'])->fresh();
        OrdenExtra::create(['idOrden' => $orden->idOrden, 'descripcion' => 'Empaque', 'importe' => '0.10']);
        $gratis = OrdenExtra::create(['idOrden' => $orden->idOrden, 'descripcion' => 'Extra queso', 'importe' => '0', 'mix_grupo' => 3])->fresh();
        DB::statement('UPDATE orden SET total = (SELECT COALESCE(SUM(subtotal),0) FROM orden_has_detalle WHERE idOrden=?) + (SELECT COALESCE(SUM(importe),0) FROM orden_extra WHERE idOrden=?) WHERE idOrden=?', [$orden->idOrden,$orden->idOrden,$orden->idOrden]);
        $this->assertSame('28.35', $orden->fresh()->total);
        $this->assertSame('Cargo adicional', $extra->descripcion);
        $this->assertSame('10.25', $extra->importe);
        $this->assertCount(3, $orden->fresh()->extras);
        $this->assertSame('0.00', $gratis->importe);
        $this->assertSame(3, $gratis->mix_grupo);
        $this->assertSame(1, Producto::count());
        $orden->delete();
        $this->assertSame(0, OrdenExtra::count());
    }

    public function test_rechaza_cargos_invalidos_y_ordenes_en_cobro(): void
    {
        $orden = Orden::create(['nombre' => '8']);
        foreach (['-1', '1.001'] as $importe) {
            try {
                OrdenExtra::create(['idOrden' => $orden->idOrden, 'descripcion' => 'Extra', 'importe' => $importe]);
                $this->fail('Debe rechazar el importe inválido.');
            } catch (InvalidArgumentException) {
                $this->addToAssertionCount(1);
            }
        }
        $orden->update(['estatus' => Orden::PAGANDO]);
        $this->expectException(InvalidArgumentException::class);
        OrdenExtra::create(['idOrden' => $orden->idOrden, 'descripcion' => 'Extra', 'importe' => '10.00']);
    }

    public function test_no_admite_un_mix_que_no_pertenece_a_la_orden(): void
    {
        $categoria = Categoria::create(['nombre' => 'Tacos']);
        $producto = Producto::create(['categoria_id' => $categoria->id, 'nombre' => 'Pollo', 'precio' => '18.00']);
        $otra = Orden::create(['nombre' => '1']);
        OrdenDetalle::create(['idOrden' => $otra->idOrden, 'idProducto' => $producto->id, 'cantidad' => 1, 'mix_grupo' => 3]);
        $orden = Orden::create(['nombre' => '2']);
        $this->expectException(InvalidArgumentException::class);
        OrdenExtra::create(['idOrden' => $orden->idOrden, 'descripcion' => 'Extra', 'importe' => '0', 'mix_grupo' => 3]);
    }

    public function test_queso_es_complemento_en_las_cinco_categorias_sin_duplicados(): void
    {
        $productos = [];
        foreach (['Tacos','Sopes','Quesadillas','Hamburguesas','Lonches'] as $nombre) {
            $categoria = Categoria::create(['nombre' => $nombre]);
            $productos[] = Producto::create(['categoria_id' => $categoria->id, 'nombre' => 'Pollo', 'precio' => '25.00']);
        }
        $this->seed(QuesoComplementoSeeder::class);
        $this->seed(QuesoComplementoSeeder::class);
        foreach ($productos as $producto) {
            $this->assertSame(['Queso'], $producto->fresh()->complementos->pluck('nombre')->all());
            $this->assertSame('25.00', $producto->fresh()->precio);
        }
        $this->assertSame(1, Complemento::where('nombre', 'Queso')->count());
    }
}
