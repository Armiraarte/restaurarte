<?php

namespace Tests\Feature;

use App\Models\Producto;
use Database\Seeders\CategoriaSeeder;
use Database\Seeders\ComplementoSeeder;
use Database\Seeders\EnchiladaPiernaSeeder;
use Database\Seeders\ProductoComplementoSeeder;
use Database\Seeders\ProductoPrecioSeeder;
use Database\Seeders\ProductoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EnchiladaPiernaSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_agrega_enchilada_de_pierna_con_precio_y_complementos_de_la_casa_sin_duplicar(): void
    {
        $this->seed([CategoriaSeeder::class, ComplementoSeeder::class, ProductoSeeder::class, ProductoComplementoSeeder::class, ProductoPrecioSeeder::class]);
        $enchiladas = fn () => Producto::whereHas('categoria', fn ($q) => $q->where('nombre', 'Enchiladas'));
        $papa = $enchiladas()->where('nombre', 'Papa')->firstOrFail();
        $anteriores = Producto::orderBy('id')->get(['id', 'nombre', 'precio', 'estatus'])->toArray();

        $this->seed(EnchiladaPiernaSeeder::class);
        $pierna = $enchiladas()->where('nombre', 'Pierna')->firstOrFail();
        $this->assertSame('15.00', $pierna->precio);
        $this->assertSame($papa->precio, $pierna->precio);
        $this->assertSame(1, $pierna->estatus);
        $this->assertNull($pierna->tamano);
        $this->assertEqualsCanonicalizing($papa->complementos->pluck('nombre')->all(), $pierna->complementos->pluck('nombre')->all());
        $this->assertContains('Queso', $pierna->complementos->pluck('nombre')->all());

        // Repetir el alta conserva ajustes de precio y no duplica productos ni complementos.
        $pierna->update(['precio' => '18.00']);
        $this->seed(EnchiladaPiernaSeeder::class);
        $this->assertSame(1, $enchiladas()->where('nombre', 'Pierna')->count());
        $this->assertSame('18.00', $pierna->fresh()->precio);
        $this->assertCount($papa->complementos->count(), $pierna->fresh()->complementos);
        $this->assertSame($anteriores, Producto::where('id', '!=', $pierna->id)->orderBy('id')->get(['id', 'nombre', 'precio', 'estatus'])->toArray());
    }
}
