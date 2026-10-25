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
                AjusteBebidasSeeder::class,
                ComplementoSeeder::class,
                ProductoSeeder::class,
                ProductoComplementoSeeder::class,
                QuesoMenuSeeder::class,
                ProductoPrecioSeeder::class,
                ProductoGrupoSeeder::class,
                AmpliacionMenuSeeder::class,
                QuesoComplementoSeeder::class,
                EnchiladaQuesoSeeder::class,
                TostadasJitomateSeeder::class,
                CafeSeeder::class,
                LoncheMixtoSeeder::class,
                HamburguesasPolloPiernaSeeder::class,
                SopePiernaSeeder::class,
                EnchiladaPiernaSeeder::class,
            ]);
        });
    }
}
