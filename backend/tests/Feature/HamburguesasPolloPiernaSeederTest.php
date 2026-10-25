<?php

namespace Tests\Feature;

use App\Models\Producto;
use Database\Seeders\CategoriaSeeder;
use Database\Seeders\ComplementoSeeder;
use Database\Seeders\HamburguesasPolloPiernaSeeder;
use Database\Seeders\ProductoComplementoSeeder;
use Database\Seeders\ProductoPrecioSeeder;
use Database\Seeders\ProductoSeeder;
use Database\Seeders\QuesoComplementoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HamburguesasPolloPiernaSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_agrega_hamburguesas_de_pollo_y_pierna_como_las_demas_sin_duplicar(): void
    {
        $this->seed([CategoriaSeeder::class, ComplementoSeeder::class, ProductoSeeder::class, ProductoComplementoSeeder::class, ProductoPrecioSeeder::class, QuesoComplementoSeeder::class]);
        $hamburguesas = fn () => Producto::whereHas('categoria', fn ($q) => $q->where('nombre', 'Hamburguesas'));
        $hermana = $hamburguesas()->whereNotIn('nombre', ['Pollo', 'Pierna'])->orderBy('id')->firstOrFail();

        $this->seed(HamburguesasPolloPiernaSeeder::class);
        foreach (['Pollo', 'Pierna'] as $nombre) {
            $producto = $hamburguesas()->where('nombre', $nombre)->firstOrFail();
            $this->assertSame($hermana->precio, $producto->precio, "Precio de la hamburguesa de $nombre");
            $this->assertNull($producto->tamano);
            $this->assertEqualsCanonicalizing($hermana->complementos->pluck('nombre')->all(), $producto->complementos->pluck('nombre')->all());
        }

        // Repetir la carga no duplica ni regresa un precio ajustado después.
        $pierna = $hamburguesas()->where('nombre', 'Pierna')->firstOrFail();
        $pierna->update(['precio' => '55.00']);
        $this->seed(HamburguesasPolloPiernaSeeder::class);
        $this->assertSame(1, $hamburguesas()->where('nombre', 'Pollo')->count());
        $this->assertSame(1, $hamburguesas()->where('nombre', 'Pierna')->count());
        $this->assertSame('55.00', $pierna->fresh()->precio);
    }
}
