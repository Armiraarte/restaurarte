<?php

namespace Tests\Feature;

use App\Models\Producto;
use Database\Seeders\BurritaPolloSeeder;
use Database\Seeders\CategoriaSeeder;
use Database\Seeders\ComplementoSeeder;
use Database\Seeders\ProductoComplementoSeeder;
use Database\Seeders\ProductoPrecioSeeder;
use Database\Seeders\ProductoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BurritaPolloSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_agrega_burrita_de_pollo_con_precio_y_complementos_de_las_demas_sin_duplicar(): void
    {
        $this->seed([CategoriaSeeder::class, ComplementoSeeder::class, ProductoSeeder::class, ProductoComplementoSeeder::class, ProductoPrecioSeeder::class]);
        $burritas = fn () => Producto::whereHas('categoria', fn ($q) => $q->where('nombre', 'Burritas'));
        $pierna = $burritas()->where('nombre', 'Pierna')->firstOrFail();
        $anteriores = Producto::orderBy('id')->get(['id', 'nombre', 'precio', 'estatus'])->toArray();

        $this->seed(BurritaPolloSeeder::class);
        $pollo = $burritas()->where('nombre', 'Pollo')->firstOrFail();
        $this->assertSame('20.00', $pollo->precio);
        $this->assertSame($pierna->precio, $pollo->precio);
        $this->assertSame(1, $pollo->estatus);
        $this->assertNull($pollo->tamano);
        $this->assertEqualsCanonicalizing(['Lechuga', 'Jitomate', 'Cebolla', 'Chile', 'Aderezo'], $pollo->complementos->pluck('nombre')->all());

        // Volver a cargarlo conserva un precio ajustado y las relaciones no se duplican.
        $pollo->update(['precio' => '22.00']);
        $this->seed(BurritaPolloSeeder::class);
        $this->assertSame(1, $burritas()->where('nombre', 'Pollo')->count());
        $this->assertSame('22.00', $pollo->fresh()->precio);
        $this->assertCount(5, $pollo->fresh()->complementos);
        $this->assertSame($anteriores, Producto::where('id', '!=', $pollo->id)->orderBy('id')->get(['id', 'nombre', 'precio', 'estatus'])->toArray());
    }
}
