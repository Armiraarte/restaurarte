<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    // La hamburguesa de pollo es de pollo a la plancha. Se renombra el mismo producto (no se crea otro),
    // así sus ventas anteriores conservan el historial. En una base nueva no hay nada que renombrar:
    // ProductoSeeder ya la crea con el nombre correcto.
    public function up(): void
    {
        $this->renombrar('Pollo', 'Pollo a la plancha');
    }

    public function down(): void
    {
        $this->renombrar('Pollo a la plancha', 'Pollo');
    }

    private function renombrar(string $de, string $a): void
    {
        $categoria = DB::table('categorias')->where('nombre', 'Hamburguesas')->value('id');
        if ($categoria === null) {
            return;
        }
        $yaExiste = DB::table('producto')->where('categoria_id', $categoria)->where('nombre', $a)->exists();
        if (! $yaExiste) {
            DB::table('producto')->where('categoria_id', $categoria)->where('nombre', $de)->update(['nombre' => $a, 'actualizado_en' => now()]);
        }
    }
};
