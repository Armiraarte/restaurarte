<?php

namespace Tests\Feature;

use App\Models\Categoria;
use App\Models\OrdenDetalle;
use App\Models\Orden;
use App\Models\Producto;
use Database\Seeders\CategoriaSeeder;
use Database\Seeders\ComplementoSeeder;
use Database\Seeders\ProductoPrecioSeeder;
use Database\Seeders\ProductoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HamburguesaPolloMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_renombra_la_hamburguesa_de_pollo_y_conserva_sus_ventas(): void
    {
        $this->seed([CategoriaSeeder::class, ComplementoSeeder::class, ProductoSeeder::class, ProductoPrecioSeeder::class]);
        $hamburguesas = Categoria::where('nombre', 'Hamburguesas')->firstOrFail();
        // Como estaba en la base antes del cambio: «Pollo», con una venta.
        $pollo = $hamburguesas->productos()->where('nombre', 'Pollo a la plancha')->firstOrFail();
        $pollo->update(['nombre' => 'Pollo']);
        $orden = Orden::create(['codigo' => '7']);
        OrdenDetalle::create(['idOrden' => $orden->idOrden, 'idProducto' => $pollo->id, 'cantidad' => 1]);

        $migracion = require database_path('migrations/2026_10_18_000023_renombrar_hamburguesa_pollo_a_la_plancha.php');
        $migracion->up();

        $this->assertSame('Pollo a la plancha', $pollo->fresh()->nombre);
        $this->assertSame(3, $hamburguesas->productos()->count()); // no se creó otro producto
        $this->assertSame($pollo->id, OrdenDetalle::firstOrFail()->idProducto);

        $migracion->up(); // repetirla no cambia nada
        $this->assertSame(1, Producto::where('categoria_id', $hamburguesas->id)->where('nombre', 'Pollo a la plancha')->count());
    }
}
