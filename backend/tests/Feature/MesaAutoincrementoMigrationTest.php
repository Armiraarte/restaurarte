<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class MesaAutoincrementoMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_convierte_los_ids_conservando_codigos_importes_y_fechas(): void
    {
        // La tabla se llama `orden` desde la migración 000013; estas migraciones anteriores trabajan sobre `mesas`.
        $orden = require database_path('migrations/2026_10_10_000013_renombrar_mesas_a_orden.php');
        $orden->down();
        $migracion = require database_path('migrations/2026_10_09_000005_autoincrementar_id_y_agregar_codigo_a_mesas.php');
        $migracion->down();

        foreach (['1', 'Terraza'] as $indice => $nombre) {
            DB::table('mesas')->insert([
                'id' => 'mesa-anterior-'.$indice,
                'nombre' => $nombre,
                'tipo_venta_id' => $indice + 1,
                'estatus' => $indice,
                'total' => '148.50',
                'creado_en' => '2026-10-08 12:00:00',
                'actualizado_en' => '2026-10-08 12:30:00',
            ]);
        }

        $migracion->up();

        $this->assertSame(2, DB::table('mesas')->count());
        foreach (['1', 'Terraza'] as $indice => $codigo) {
            $mesa = DB::table('mesas')->where('codigo', $codigo)->first();
            $this->assertGreaterThan(0, (int) $mesa->id);
            $this->assertSame($codigo, $mesa->nombre);
            $this->assertSame($indice + 1, (int) $mesa->tipo_venta_id);
            $this->assertSame($indice, (int) $mesa->estatus);
            $this->assertSame(148.50, (float) $mesa->total);
            $this->assertSame('2026-10-08 12:00:00', $mesa->creado_en);
            $this->assertSame('2026-10-08 12:30:00', $mesa->actualizado_en);
        }
        $maximo = DB::table('mesas')->max('id');
        $nueva = DB::table('mesas')->insertGetId(['codigo' => 'Patio', 'nombre' => 'Patio']);
        $this->assertGreaterThan($maximo, $nueva);

        $migracion->down();

        $this->assertFalse(Schema::hasColumn('mesas', 'codigo'));
        $anterior = DB::table('mesas')->where('nombre', '1')->first();
        $this->assertStringStartsWith('mesa-', $anterior->id);
        $this->assertSame(148.50, (float) $anterior->total);

        $migracion->up();
        $orden->up();
    }
}
