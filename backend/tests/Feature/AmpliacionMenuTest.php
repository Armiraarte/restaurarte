<?php

namespace Tests\Feature;

use App\Models\Categoria;
use App\Models\Orden;
use App\Models\OrdenDetalle;
use App\Models\Producto;
use App\Models\Termino;
use Database\Seeders\AmpliacionMenuSeeder;
use Database\Seeders\CategoriaSeeder;
use Database\Seeders\ComplementoSeeder;
use Database\Seeders\ProductoComplementoSeeder;
use Database\Seeders\ProductoGrupoSeeder;
use Database\Seeders\ProductoPrecioSeeder;
use Database\Seeders\ProductoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use Tests\TestCase;

class AmpliacionMenuTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([CategoriaSeeder::class, ComplementoSeeder::class, ProductoSeeder::class, ProductoComplementoSeeder::class, ProductoPrecioSeeder::class, ProductoGrupoSeeder::class]);
    }

    private function producto(string $categoria, ?string $nombre = null): Producto
    {
        return Producto::whereHas('categoria', fn ($q) => $q->where('nombre', $categoria))
            ->when($nombre !== null, fn ($q) => $q->where('nombre', $nombre))->firstOrFail();
    }

    public function test_agrega_catalogos_completos_sin_duplicar_ni_cambiar_ventas_anteriores(): void
    {
        $limon = $this->producto('Bebidas', 'Limón / Cereza');
        $limon->update(['precio' => '30.00']); // precio del catálogo anterior
        $orden = Orden::create(['nombre' => '7']);
        $venta = OrdenDetalle::create(['idOrden' => $orden->idOrden, 'idProducto' => $limon->id, 'cantidad' => 2]);
        $this->producto('Tacos', 'Pollo')->update(['precio' => '22.00']);
        $this->seed(AmpliacionMenuSeeder::class);
        $this->seed(AmpliacionMenuSeeder::class);
        $this->seed(ProductoPrecioSeeder::class);
        $this->assertSame(['Blando', 'Medio', 'Dorado'], Termino::orderBy('id')->pluck('nombre')->all());
        $this->assertSame(1, Categoria::where('nombre', 'Carnes')->count());
        foreach (['Milanesa' => '40.00', 'Pollo a la plancha' => '40.00', 'Carne de res' => '20.00'] as $nombre => $precio) {
            $producto = $this->producto('Carnes', $nombre);
            $this->assertSame($precio, $producto->precio);
            $this->assertEqualsCanonicalizing(['Mango', 'BFF', 'BBQ', 'Jitomate', 'Queso', 'Pepino'], $producto->complementos->pluck('nombre')->all());
        }
        $sope = $this->producto('Sopes', 'Queso');
        $this->assertSame('15.00', $sope->precio);
        $this->assertSame(1, Producto::where('categoria_id', $sope->categoria_id)->where('nombre', 'Queso')->count());
        $this->assertTrue($this->producto('Lonches')->complementos->contains('nombre', 'Salsa verde'));
        $this->assertSame($limon->id, $this->producto('Bebidas', 'Limón / Cereza')->id);
        $this->assertSame('60.00', $limon->fresh()->precio);
        $this->assertSame('Alcohol', $limon->fresh()->grupo);
        $this->assertSame('30.00', $this->producto('Bebidas', 'Cerveza')->precio);
        $this->assertSame('Alcohol', $this->producto('Bebidas', 'Cerveza')->grupo);
        $this->assertSame('60.00', $venta->fresh()->subtotal, 'El cambio de precio no reescribe ventas anteriores');
        $this->assertSame('22.00', $this->producto('Tacos', 'Pollo')->precio);
    }

    public function test_guarda_terminos_solo_en_tacos_y_dorados_con_sus_restricciones(): void
    {
        $this->seed(AmpliacionMenuSeeder::class);
        $orden = Orden::create(['nombre' => '8']);
        foreach ([['Tacos', 'Dorado'], ['Tacos Dorados', 'Medio']] as [$categoria, $nombre]) {
            $detalle = OrdenDetalle::create([
                'idOrden' => $orden->idOrden, 'idProducto' => $this->producto($categoria)->id, 'cantidad' => 1,
                'termino_id' => Termino::where('nombre', $nombre)->value('id'),
            ])->fresh();
            $this->assertSame($nombre, $detalle->termino->nombre);
        }
        foreach ([['Tacos Dorados', 'Dorado'], ['Carnes', 'Medio'], ['Bebidas', 'Blando'], ['Sopes', 'Medio']] as [$categoria, $nombre]) {
            try {
                OrdenDetalle::create([
                    'idOrden' => $orden->idOrden, 'idProducto' => $this->producto($categoria)->id, 'cantidad' => 1,
                    'termino_id' => Termino::where('nombre', $nombre)->value('id'),
                ]);
                $this->fail("No debe permitir {$nombre} en {$categoria}");
            } catch (InvalidArgumentException) {
                $this->addToAssertionCount(1);
            }
        }
    }

    public function test_acepta_hamburguesa_sin_queso_y_sope_con_queso(): void
    {
        $this->seed(AmpliacionMenuSeeder::class);
        $orden = Orden::create(['nombre' => '9']);
        $hamburguesa = OrdenDetalle::create(['idOrden' => $orden->idOrden, 'idProducto' => $this->producto('Hamburguesas')->id, 'cantidad' => 1, 'sin_queso' => true])->fresh();
        $sope = OrdenDetalle::create(['idOrden' => $orden->idOrden, 'idProducto' => $this->producto('Sopes', 'Pollo')->id, 'cantidad' => 1, 'con_queso' => true])->fresh();
        $this->assertTrue($hamburguesa->sin_queso);
        $this->assertTrue($sope->con_queso);
    }

    public function test_lonches_guarda_con_queso_o_sin_queso_y_rechaza_ambas_juntas(): void
    {
        $orden = Orden::create(['nombre' => '10']);
        $lonche = $this->producto('Lonches');
        foreach (['con_queso', 'sin_queso'] as $opcion) {
            $detalle = OrdenDetalle::create([
                'idOrden' => $orden->idOrden, 'idProducto' => $lonche->id, 'cantidad' => 1, $opcion => true,
            ])->fresh();
            $this->assertTrue($detalle->$opcion);
            $this->assertSame($lonche->precio, $detalle->subtotal);
        }
        $this->expectException(InvalidArgumentException::class);
        OrdenDetalle::create([
            'idOrden' => $orden->idOrden, 'idProducto' => $lonche->id, 'cantidad' => 1,
            'sin_queso' => true, 'con_queso' => true,
        ]);
    }

    public function test_papas_suma_orden_completa_por_pieza_y_conserva_el_precio_historico(): void
    {
        $orden = Orden::create(['nombre' => '11']);
        $hamburguesa = OrdenDetalle::create([
            'idOrden' => $orden->idOrden, 'idProducto' => $this->producto('Hamburguesas')->id,
            'cantidad' => 2, 'carne_extra' => 1, 'opciones' => ['papas' => true],
        ])->fresh();
        $lonche = OrdenDetalle::create([
            'idOrden' => $orden->idOrden, 'idProducto' => $this->producto('Lonches')->id,
            'cantidad' => 1, 'opciones' => ['papas' => true],
        ])->fresh();
        $this->assertSame('200.00', $hamburguesa->subtotal);
        $this->assertSame('80.00', $lonche->subtotal);
        $papas = $this->producto('Papas a la Francesa')->categoria->productos()->where('tamano', 'Orden completa')->firstOrFail();
        $this->assertSame($papas->id, $lonche->opciones['papas']['idProducto']);
        $papas->update(['precio' => '45.00']);
        $this->assertSame(30, $lonche->fresh()->opciones['papas']['precio']);
        $this->assertSame('80.00', $lonche->fresh()->subtotal);
        $lonche->opciones = [];
        $lonche->save();
        $this->assertSame('50.00', $lonche->fresh()->subtotal);
    }

    public function test_las_cinco_categorias_guardan_sin_queso_o_queso_agregado(): void
    {
        $orden = Orden::create(['nombre' => '12']);
        foreach (['Tacos', 'Sopes', 'Quesadillas', 'Hamburguesas', 'Lonches'] as $categoria) {
            $detalle = OrdenDetalle::create([
                'idOrden' => $orden->idOrden, 'idProducto' => $this->producto($categoria)->id, 'cantidad' => 1, 'sin_queso' => true,
            ])->fresh();
            $this->assertTrue($detalle->sin_queso);
            $conQueso = OrdenDetalle::create([
                'idOrden' => $orden->idOrden, 'idProducto' => $this->producto($categoria)->id, 'cantidad' => 1, 'con_queso' => true,
            ])->fresh();
            $this->assertTrue($conQueso->con_queso);
            $this->assertFalse($conQueso->sin_queso);
        }
    }
}
