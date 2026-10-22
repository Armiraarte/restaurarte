<?php

namespace Tests\Feature;

use App\Models\Producto;
use Database\Seeders\CategoriaSeeder;
use Database\Seeders\ComplementoSeeder;
use Database\Seeders\EnchiladaQuesoSeeder;
use Database\Seeders\ProductoComplementoSeeder;
use Database\Seeders\ProductoPrecioSeeder;
use Database\Seeders\ProductoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EnchiladaQuesoSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_agrega_enchiladas_de_queso_con_precio_y_complementos_de_las_demas_sin_duplicar(): void
    {
        $this->seed([CategoriaSeeder::class, ComplementoSeeder::class, ProductoSeeder::class, ProductoComplementoSeeder::class, ProductoPrecioSeeder::class]);
        $enchiladas = fn () => Producto::whereHas('categoria', fn ($q) => $q->where('nombre', 'Enchiladas'));

        $this->seed(EnchiladaQuesoSeeder::class);
        $queso = $enchiladas()->where('nombre', 'Queso')->firstOrFail();
        $this->assertSame('15.00', $queso->precio);
        $this->assertNull($queso->tamano);
        $this->assertEqualsCanonicalizing(['Repollo', 'Lechuga', 'Salsa', 'Crema', 'Queso'], $queso->complementos->pluck('nombre')->all());
        $this->assertSame(1, $enchiladas()->where('nombre', 'Queso/Cebolla')->count(), 'Queso/Cebolla se conserva');

        // Repetir la carga no duplica ni regresa un precio ajustado después.
        $queso->update(['precio' => '18.00']);
        $this->seed(EnchiladaQuesoSeeder::class);
        $this->assertSame(1, $enchiladas()->where('nombre', 'Queso')->count());
        $this->assertSame('18.00', $queso->fresh()->precio);
        $this->assertCount(5, $queso->fresh()->complementos);
    }
}
