<?php

namespace Database\Seeders;

use App\Models\Categoria;
use App\Models\Complemento;
use App\Models\Producto;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/** Agrega Enchiladas de Queso con el precio y los complementos de las demás enchiladas; repetible sin duplicar. */
class EnchiladaQuesoSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function (): void {
            $enchiladas = Categoria::where('nombre', 'Enchiladas')->firstOrFail();
            $precio = $enchiladas->productos()->where('nombre', '!=', 'Queso')->where('precio', '>', 0)->orderBy('id')->value('precio') ?? '15.00';
            // firstOrCreate: si después se ajusta su precio, repetir la carga no lo regresa.
            $queso = Producto::firstOrCreate(
                ['categoria_id' => $enchiladas->id, 'nombre' => 'Queso', 'tamano' => null],
                ['precio' => $precio, 'estatus' => 1],
            );
            $ids = Complemento::whereIn('nombre', ['Repollo', 'Lechuga', 'Salsa', 'Crema', 'Queso'])->pluck('id')->all();
            $queso->complementos()->syncWithoutDetaching($ids);
        });
    }
}
