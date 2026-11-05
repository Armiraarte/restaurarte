<?php

namespace Tests\Feature;

use App\Models\Producto;
use Database\Seeders\AlitasNaturalesSeeder;
use Database\Seeders\CategoriaSeeder;
use Database\Seeders\ProductoPrecioSeeder;
use Database\Seeders\ProductoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AlitasNaturalesSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_agrega_alitas_naturales_al_precio_de_los_demas_sabores_sin_duplicar(): void
    {
        $this->seed([CategoriaSeeder::class, ProductoSeeder::class, ProductoPrecioSeeder::class]);
        $alitas = fn () => Producto::whereHas('categoria', fn ($q) => $q->where('nombre', 'Alitas'));
        $bbq = $alitas()->where('nombre', 'BBQ')->firstOrFail();

        $this->seed(AlitasNaturalesSeeder::class);
        $naturales = $alitas()->where('nombre', 'Naturales')->firstOrFail();
        $this->assertSame($bbq->precio, $naturales->precio, 'Mismo precio por pieza que los demás sabores');
        $this->assertNull($naturales->tamano);
        $this->assertSame(1, $naturales->estatus);
        $this->assertCount(0, $naturales->complementos);
        $this->assertEqualsCanonicalizing(['Mango Habanero', 'Buffalo', 'BBQ', 'Naturales'], $alitas()->pluck('nombre')->all());

        // Repetir la carga no duplica ni regresa un precio ajustado después.
        $naturales->update(['precio' => '14.00']);
        $this->seed(AlitasNaturalesSeeder::class);
        $this->assertSame(1, $alitas()->where('nombre', 'Naturales')->count());
        $this->assertSame('14.00', $naturales->fresh()->precio);
    }
}
