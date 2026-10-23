<?php

namespace Tests\Feature;

use App\Models\Producto;
use Database\Seeders\CafeSeeder;
use Database\Seeders\CategoriaSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CafeSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_agrega_cafe_a_25_en_aguas_sin_duplicar(): void
    {
        $this->seed(CategoriaSeeder::class);
        $cafe = fn () => Producto::whereHas('categoria', fn ($q) => $q->where('nombre', 'Bebidas'))->where('nombre', 'Café');

        $this->seed(CafeSeeder::class);
        $producto = $cafe()->firstOrFail();
        $this->assertSame('25.00', $producto->precio);
        $this->assertSame('Aguas', $producto->grupo);
        $this->assertNull($producto->tamano);

        // Repetir la carga no duplica ni regresa un precio ajustado después, y lo deja en Aguas.
        $producto->update(['precio' => '28.00', 'grupo' => 'Otro']);
        $this->seed(CafeSeeder::class);
        $this->assertSame(1, $cafe()->count());
        $this->assertSame('28.00', $producto->fresh()->precio);
        $this->assertSame('Aguas', $producto->fresh()->grupo);
    }
}
