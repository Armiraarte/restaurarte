<?php

namespace Tests\Feature;

use App\Models\Orden;
use App\Models\TipoVenta;
use Database\Seeders\OrdenSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use Tests\TestCase;

class OrdenTest extends TestCase
{
    use RefreshDatabase;

    public function test_crea_una_mesa_con_id_autoincrementable_y_codigo_normalizado(): void
    {
        $mesa = Orden::create(['codigo' => ' Mesa 05 '])->fresh();
        $siguiente = Orden::create(['codigo' => 'Terraza'])->fresh();

        $this->assertIsInt($mesa->idOrden);
        $this->assertSame($mesa->idOrden + 1, $siguiente->idOrden);
        $this->assertSame('5', $mesa->codigo);
        $this->assertSame('5', $mesa->nombre);
        $this->assertSame(TipoVenta::COMER_AQUI, $mesa->tipo_orden);
        $this->assertSame('0.00', $mesa->total);
        $this->assertSame(Orden::ABIERTA, $mesa->estatus);
        $this->assertSame('comer_aqui', $mesa->tipoOrden->codigo);
    }

    public function test_actualiza_total_tipo_de_venta_y_estatus(): void
    {
        $mesa = Orden::create(['nombre' => 'Terraza']);

        $mesa->update(['total' => '148.50', 'tipo_orden' => TipoVenta::PARA_LLEVAR, 'estatus' => 2]);

        $mesa = $mesa->fresh();
        $this->assertSame('Terraza', $mesa->codigo);
        $this->assertSame('Terraza', $mesa->nombre);
        $this->assertSame('148.50', $mesa->total);
        $this->assertSame(TipoVenta::PARA_LLEVAR, $mesa->tipo_orden);
        $this->assertSame(2, $mesa->estatus);
    }

    public function test_permite_repetir_el_nombre_en_otra_orden_con_otro_codigo(): void
    {
        // Mesa 5 cobrada y, después, otra Mesa 5: son dos órdenes distintas.
        $primera = Orden::create(['codigo' => 'T1-001', 'nombre' => '5', 'estatus' => Orden::PAGADO]);
        $segunda = Orden::create(['codigo' => 'T1-002', 'nombre' => 'Mesa 5']);

        $this->assertNotSame($primera->idOrden, $segunda->idOrden);
        $this->assertSame('5', $segunda->fresh()->nombre);
    }

    public function test_no_permite_codigos_repetidos_aunque_el_nombre_sea_diferente(): void
    {
        Orden::create(['codigo' => '5', 'nombre' => 'Terraza']);

        $this->expectException(QueryException::class);
        Orden::create(['codigo' => 'Mesa 05', 'nombre' => 'Patio']);
    }

    public function test_repetir_el_seeder_conserva_id_total_tipo_y_estatus(): void
    {
        $this->seed(OrdenSeeder::class);
        $mesa = Orden::where('codigo', '1')->firstOrFail();
        $id = $mesa->idOrden;
        $mesa->update(['total' => '120.50', 'tipo_orden' => 2, 'estatus' => 2]);

        $this->seed(OrdenSeeder::class);

        $this->assertSame(1, Orden::count());
        $mesa = $mesa->fresh();
        $this->assertSame($id, $mesa->idOrden);
        $this->assertSame('120.50', $mesa->total);
        $this->assertSame(2, $mesa->tipo_orden);
        $this->assertSame(2, $mesa->estatus);
    }

    public function test_rechaza_codigos_vacios(): void
    {
        $this->expectException(InvalidArgumentException::class);
        Orden::create(['codigo' => '  ']);
    }

    public function test_rechaza_totales_negativos_o_con_mas_de_dos_decimales(): void
    {
        $this->expectException(InvalidArgumentException::class);
        Orden::create(['nombre' => '7', 'total' => '-1']);
    }

    public function test_rechaza_tipos_de_venta_inexistentes(): void
    {
        $this->expectException(InvalidArgumentException::class);
        Orden::create(['nombre' => '8', 'tipo_orden' => 99]);
    }
}
