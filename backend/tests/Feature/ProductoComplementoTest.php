<?php

namespace Tests\Feature;

use App\Models\Categoria;
use App\Models\Complemento;
use App\Models\Producto;
use Database\Seeders\CategoriaSeeder;
use Database\Seeders\ComplementoSeeder;
use Database\Seeders\ProductoComplementoSeeder;
use Database\Seeders\ProductoSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductoComplementoTest extends TestCase
{
    use RefreshDatabase;

    private function cargar(): void
    {
        $this->seed([CategoriaSeeder::class, ComplementoSeeder::class, ProductoSeeder::class, ProductoComplementoSeeder::class]);
    }

    private function producto(string $categoria, string $nombre): Producto
    {
        return Producto::where('nombre', $nombre)
            ->where('categoria_id', Categoria::where('nombre', $categoria)->value('id'))
            ->firstOrFail();
    }

    public function test_cada_producto_lleva_los_complementos_de_su_categoria(): void
    {
        $this->cargar();

        $this->assertSame(213, \DB::table('producto_has_complemento')->count());
        $this->assertEqualsCanonicalizing(['Repollo', 'Lechuga', 'Salsa', 'Crema'], $this->producto('Tacos Dorados', 'Frijol')->complementos->pluck('nombre')->all());
        $this->assertEqualsCanonicalizing(['Jitomate', 'Pepino', 'Chile', 'Cebolla'], $this->producto('Ensaladas', 'Milanesa')->complementos->pluck('nombre')->all());
        $this->assertCount(0, $this->producto('Bebidas', 'Pepsi')->complementos);
        $this->assertSame(38, Complemento::where('nombre', 'Lechuga')->firstOrFail()->productos()->count());
    }

    public function test_repetir_no_duplica_relaciones(): void
    {
        $this->cargar();
        $this->seed(ProductoComplementoSeeder::class);

        $this->assertSame(213, \DB::table('producto_has_complemento')->count());
    }

    public function test_no_se_repite_la_misma_relacion(): void
    {
        $this->cargar();
        $frijol = $this->producto('Tacos Dorados', 'Frijol');

        $this->expectException(QueryException::class);
        \DB::table('producto_has_complemento')->insert(['producto_id' => $frijol->id, 'complemento_id' => Complemento::where('nombre', 'Salsa')->value('id')]);
    }

    public function test_borrar_un_producto_borra_sus_relaciones_y_no_se_borra_un_complemento_en_uso(): void
    {
        $this->cargar();
        $frijol = $this->producto('Tacos Dorados', 'Frijol');
        $frijol->delete();
        $this->assertSame(0, \DB::table('producto_has_complemento')->where('producto_id', $frijol->id)->count());

        $this->expectException(QueryException::class);
        Complemento::where('nombre', 'Salsa')->firstOrFail()->delete();
    }
}
