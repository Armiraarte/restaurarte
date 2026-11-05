<?php

namespace Tests\Feature;

use App\Models\Complemento;
use App\Models\Producto;
use Database\Seeders\CategoriaSeeder;
use Database\Seeders\ComplementoSeeder;
use Database\Seeders\HamburguesaAderezoSeeder;
use Database\Seeders\HamburguesasPolloPiernaSeeder;
use Database\Seeders\ProductoComplementoSeeder;
use Database\Seeders\ProductoPrecioSeeder;
use Database\Seeders\ProductoSeeder;
use Database\Seeders\QuesoComplementoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HamburguesaAderezoSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_agrega_aderezo_a_todas_las_hamburguesas_sin_duplicar_ni_cambiar_precios(): void
    {
        $this->seed([CategoriaSeeder::class, ComplementoSeeder::class, ProductoSeeder::class, ProductoComplementoSeeder::class,
            ProductoPrecioSeeder::class, QuesoComplementoSeeder::class, HamburguesasPolloPiernaSeeder::class]);
        $hamburguesas = fn () => Producto::whereHas('categoria', fn ($q) => $q->where('nombre', 'Hamburguesas'))->with('complementos')->get();
        $aderezo = Complemento::where('nombre', 'Aderezo')->firstOrFail();
        // Como está la base hoy: las hamburguesas sin aderezo.
        foreach ($hamburguesas() as $p) {
            $p->complementos()->detach($aderezo->id);
        }
        $antes = $hamburguesas()->mapWithKeys(fn (Producto $p) => [$p->id => [$p->precio, $p->complementos->count()]]);
        $lonches = Producto::whereHas('categoria', fn ($q) => $q->where('nombre', 'Lonches'))->withCount('complementos')->get()->pluck('complementos_count', 'id');

        $this->seed(HamburguesaAderezoSeeder::class);
        $this->seed(HamburguesaAderezoSeeder::class);

        $this->assertNotEmpty($antes);
        foreach ($hamburguesas() as $p) {
            $this->assertSame(1, $p->complementos->where('nombre', 'Aderezo')->count(), "{$p->nombre} lleva Aderezo una vez");
            $this->assertSame($antes[$p->id][0], $p->precio, 'El precio no cambia');
            $this->assertCount($antes[$p->id][1] + 1, $p->complementos, 'Conserva sus demás complementos');
        }
        $this->assertEquals($lonches, Producto::whereHas('categoria', fn ($q) => $q->where('nombre', 'Lonches'))->withCount('complementos')->get()->pluck('complementos_count', 'id'));
        $this->assertSame(1, Complemento::where('nombre', 'Aderezo')->count());
    }
}
