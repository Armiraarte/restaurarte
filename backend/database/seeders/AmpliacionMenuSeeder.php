<?php

namespace Database\Seeders;

use App\Models\Categoria;
use App\Models\Complemento;
use App\Models\Producto;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/** Cambios puntuales del menú, repetibles sin modificar ventas ni precios ajenos al ajuste. */
class AmpliacionMenuSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function (): void {
            $this->call(TerminoSeeder::class);
            $complementos = collect(['Salsa verde', 'Mango', 'BFF', 'BBQ', 'Jitomate', 'Queso', 'Pepino'])
                ->mapWithKeys(fn (string $nombre) => [$nombre => Complemento::firstOrCreate(['nombre' => $nombre], ['estatus' => 1])->id]);

            $carnes = Categoria::firstOrCreate(['nombre' => 'Carnes'], ['estatus' => 1]);
            foreach (['Milanesa' => '40.00', 'Pollo a la plancha' => '40.00', 'Carne de res' => '20.00'] as $nombre => $precio) {
                $producto = Producto::updateOrCreate(
                    ['categoria_id' => $carnes->id, 'nombre' => $nombre, 'tamano' => null],
                    ['precio' => $precio, 'estatus' => 1],
                );
                $producto->complementos()->syncWithoutDetaching($complementos->except('Salsa verde')->values()->all());
            }

            $sopes = Categoria::where('nombre', 'Sopes')->firstOrFail();
            $precioSope = $sopes->productos()->where('precio', '>', 0)->orderBy('id')->value('precio') ?? '15.00';
            $sopeQueso = Producto::updateOrCreate(
                ['categoria_id' => $sopes->id, 'nombre' => 'Queso', 'tamano' => null],
                ['precio' => $precioSope, 'estatus' => 1],
            );
            $idsSope = Complemento::whereIn('nombre', ['Repollo', 'Lechuga', 'Salsa', 'Crema', 'Queso'])->pluck('id')->all();
            $sopeQueso->complementos()->syncWithoutDetaching($idsSope);

            Producto::whereHas('categoria', fn ($q) => $q->where('nombre', 'Lonches'))
                ->each(fn (Producto $p) => $p->complementos()->syncWithoutDetaching([$complementos['Salsa verde']]));

            $bebidas = Categoria::where('nombre', 'Bebidas')->firstOrFail();
            foreach (['Limita' => '60.00', 'Cerveza' => '30.00'] as $nombre => $precio) {
                // Se actualiza el producto original para conservar sus referencias en ventas anteriores.
                Producto::updateOrCreate(
                    ['categoria_id' => $bebidas->id, 'nombre' => $nombre, 'tamano' => null],
                    ['grupo' => 'Alcohol', 'precio' => $precio, 'estatus' => 1],
                );
            }
        });
    }
}
