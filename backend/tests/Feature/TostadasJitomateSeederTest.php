<?php

namespace Tests\Feature;

use App\Models\Producto;
use Database\Seeders\CategoriaSeeder;
use Database\Seeders\ComplementoSeeder;
use Database\Seeders\ProductoComplementoSeeder;
use Database\Seeders\ProductoSeeder;
use Database\Seeders\TostadasJitomateSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TostadasJitomateSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_agrega_jitomate_a_todas_las_tostadas_sin_quitar_ni_duplicar_complementos(): void
    {
        $this->seed([CategoriaSeeder::class, ComplementoSeeder::class, ProductoSeeder::class, ProductoComplementoSeeder::class]);
        $tostadas = fn () => Producto::whereHas('categoria', fn ($q) => $q->where('nombre', 'Tostadas'))->with('complementos')->get();

        $this->seed(TostadasJitomateSeeder::class);
        $this->seed(TostadasJitomateSeeder::class);

        $this->assertCount(6, $tostadas());
        foreach ($tostadas() as $tostada) {
            $this->assertEqualsCanonicalizing(
                ['Repollo', 'Lechuga', 'Salsa', 'Crema', 'Queso', 'Jitomate'],
                $tostada->complementos->pluck('nombre')->all(),
                "Tostada de {$tostada->nombre}",
            );
        }
        // Las demás categorías no cambian.
        $enchilada = Producto::whereHas('categoria', fn ($q) => $q->where('nombre', 'Enchiladas'))->with('complementos')->firstOrFail();
        $this->assertNotContains('Jitomate', $enchilada->complementos->pluck('nombre')->all());
    }
}
