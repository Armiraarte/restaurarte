<?php

namespace Tests\Feature;

use App\Models\Categoria;
use Database\Seeders\CategoriaSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CategoriaSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_carga_las_categorias_del_menu_en_orden(): void
    {
        $this->seed(CategoriaSeeder::class);

        $this->assertSame(CategoriaSeeder::CATEGORIAS, Categoria::orderBy('id')->pluck('nombre')->all());
        $this->assertSame([1], Categoria::distinct()->pluck('estatus')->all());
        $this->assertNotNull(Categoria::first()->creado_en);
    }

    public function test_repetir_no_duplica_ni_cambia_el_estatus(): void
    {
        $this->seed(CategoriaSeeder::class);
        Categoria::where('nombre', 'Bebidas')->update(['estatus' => 0]);

        $this->seed(CategoriaSeeder::class);

        $this->assertSame(14, Categoria::count());
        $this->assertSame(0, Categoria::where('nombre', 'Bebidas')->firstOrFail()->estatus);
    }
}
