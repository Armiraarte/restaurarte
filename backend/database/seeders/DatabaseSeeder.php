<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        DB::transaction(function (): void {
            $this->call([
                UsuarioSeeder::class,
                TipoVentaSeeder::class,
                OrdenSeeder::class,
                CategoriaSeeder::class,
                ComplementoSeeder::class,
                ProductoSeeder::class,
                ProductoComplementoSeeder::class,
                QuesoMenuSeeder::class,
                ProductoPrecioSeeder::class,
                ProductoGrupoSeeder::class,
            ]);
        });
    }
}
