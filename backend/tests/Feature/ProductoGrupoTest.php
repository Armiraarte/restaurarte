<?php

namespace Tests\Feature;

use App\Models\Categoria;
use App\Models\Producto;
use Database\Seeders\CategoriaSeeder;
use Database\Seeders\ComplementoSeeder;
use Database\Seeders\ProductoGrupoSeeder;
use Database\Seeders\ProductoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductoGrupoTest extends TestCase
{
    use RefreshDatabase;

    public function test_todas_las_bebidas_quedan_en_refrescos_aguas_o_jugos(): void
    {
        $this->seed([CategoriaSeeder::class, ComplementoSeeder::class, ProductoSeeder::class, ProductoGrupoSeeder::class]);
        $bebidas = Categoria::where('nombre', 'Bebidas')->firstOrFail()->productos();

        $this->assertSame(0, (clone $bebidas)->whereNull('grupo')->count());
        $porGrupo = (clone $bebidas)->get()->groupBy('grupo')->map->count()->all();
        $this->assertSame(['Refrescos' => 10, 'Aguas' => 5, 'Jugos' => 2], $porGrupo); // Agua de Lima: 3 tamaños
        $this->assertSame('Aguas', (clone $bebidas)->where('nombre', 'Agua de Lima')->where('tamano', 'Grande')->value('grupo'));

        // Fuera de Bebidas no hay grupos.
        $this->assertSame(0, Producto::where('categoria_id', '<>', Categoria::where('nombre', 'Bebidas')->value('id'))->whereNotNull('grupo')->count());

        // Repetir la carga no cambia nada.
        $this->seed(ProductoGrupoSeeder::class);
        $this->assertSame($porGrupo, (clone $bebidas)->get()->groupBy('grupo')->map->count()->all());
    }
}
