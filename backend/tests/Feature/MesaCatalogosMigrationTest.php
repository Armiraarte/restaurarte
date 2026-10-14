<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class MesaCatalogosMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_convierte_registros_existentes_conservando_su_identidad_y_total(): void
    {
        // La tabla se llama `orden` desde la migración 000013; estas migraciones anteriores trabajan sobre `mesas`.
        $orden = require database_path('migrations/2026_10_10_000013_renombrar_mesas_a_orden.php');
        $orden->down();
        $ids = require database_path('migrations/2026_10_09_000005_autoincrementar_id_y_agregar_codigo_a_mesas.php');
        $ids->down();
        $migracion = require database_path('migrations/2026_10_09_000004_catalogar_tipos_venta_y_estatus_de_mesas.php');
        $migracion->down();

        foreach ([[false, false], [false, true], [true, false], [true, true]] as $indice => [$paraLlevar, $activa]) {
            DB::table('mesas')->insert([
                'id' => 'mesa-anterior-'.$indice,
                'nombre' => (string) ($indice + 1),
                'para_llevar' => $paraLlevar,
                'activa' => $activa,
                'total' => '148.50',
                'creado_en' => '2026-10-08 12:00:00',
                'actualizado_en' => '2026-10-08 12:30:00',
            ]);
        }

        $migracion->up();

        $this->assertFalse(Schema::hasColumn('mesas', 'para_llevar'));
        $this->assertFalse(Schema::hasColumn('mesas', 'activa'));
        $this->assertSame(4, DB::table('mesas')->count());

        foreach ([[1, 0], [1, 1], [2, 0], [2, 1]] as $indice => [$tipoVentaId, $estatus]) {
            $mesa = DB::table('mesas')->where('id', 'mesa-anterior-'.$indice)->first();
            $this->assertSame((string) ($indice + 1), $mesa->nombre);
            $this->assertSame($tipoVentaId, $mesa->tipo_venta_id);
            $this->assertSame($estatus, $mesa->estatus);
            $this->assertSame(148.50, (float) $mesa->total);
            $this->assertSame('2026-10-08 12:30:00', $mesa->actualizado_en);
        }

        $migracion->down();

        foreach ([[0, 0], [0, 1], [1, 0], [1, 1]] as $indice => [$paraLlevar, $activa]) {
            $anterior = DB::table('mesas')->where('id', 'mesa-anterior-'.$indice)->first();
            $this->assertSame($paraLlevar, $anterior->para_llevar);
            $this->assertSame($activa, $anterior->activa);
            $this->assertSame(148.50, (float) $anterior->total);
        }

        $migracion->up();
        $ids->up();
        $orden->up();
    }
}
