<?php

namespace Tests\Feature;

use App\Models\Producto;
use Database\Seeders\CategoriaSeeder;
use Database\Seeders\ComplementoSeeder;
use Database\Seeders\LoncheMixtoSeeder;
use Database\Seeders\ProductoComplementoSeeder;
use Database\Seeders\ProductoPrecioSeeder;
use Database\Seeders\ProductoSeeder;
use Database\Seeders\QuesoComplementoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LoncheMixtoSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_agrega_lonche_mixto_a_70_con_los_complementos_de_los_demas_lonches_sin_duplicar(): void
    {
        $this->seed([CategoriaSeeder::class, ComplementoSeeder::class, ProductoSeeder::class, ProductoComplementoSeeder::class, ProductoPrecioSeeder::class, QuesoComplementoSeeder::class]);
        $lonches = fn () => Producto::whereHas('categoria', fn ($q) => $q->where('nombre', 'Lonches'));

        $this->seed(LoncheMixtoSeeder::class);
        $mixto = $lonches()->where('nombre', 'Mixto')->firstOrFail();
        $this->assertSame('70.00', $mixto->precio);
        $this->assertNull($mixto->tamano);
        $pierna = $lonches()->where('nombre', 'Pierna')->firstOrFail();
        $this->assertEqualsCanonicalizing($pierna->complementos->pluck('nombre')->all(), $mixto->complementos->pluck('nombre')->all());
        $this->assertContains('Queso', $mixto->complementos->pluck('nombre')->all());
        $this->assertSame('50.00', $pierna->fresh()->precio, 'Los demás lonches no cambian');

        // Repetir la carga no duplica ni regresa un precio ajustado después.
        $mixto->update(['precio' => '75.00']);
        $this->seed(LoncheMixtoSeeder::class);
        $this->assertSame(1, $lonches()->where('nombre', 'Mixto')->count());
        $this->assertSame('75.00', $mixto->fresh()->precio);
        $this->assertCount($pierna->complementos->count(), $mixto->fresh()->complementos);
    }
}
