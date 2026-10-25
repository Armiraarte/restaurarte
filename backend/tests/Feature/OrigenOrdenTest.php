<?php

namespace Tests\Feature;

use App\Models\Orden;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class OrigenOrdenTest extends TestCase
{
    use RefreshDatabase;

    public function test_guarda_llamada_y_nombre_sin_confundirlos_con_para_llevar(): void
    {
        $llamada = Orden::create(['codigo' => 'T1-001', 'nombre' => 'Ana', 'origen' => 'llamada', 'tipo_orden' => 1]);
        $nombre = Orden::create(['codigo' => 'T1-002', 'nombre' => 'Ana', 'origen' => 'nombre', 'tipo_orden' => 2]);
        $this->assertSame('llamada', $llamada->fresh()->origen);
        $this->assertSame('nombre', $nombre->fresh()->origen);
        $this->assertNotSame($llamada->idOrden, $nombre->idOrden);
    }

    public function test_migracion_conserva_ordenes_y_clasifica_mesas_y_nombres_anteriores(): void
    {
        $mesa = Orden::create(['codigo' => 'T1-001', 'nombre' => '3']);
        $nombre = Orden::create(['codigo' => 'T1-002', 'nombre' => 'Ana']);
        $migration = require database_path('migrations/2026_10_24_000029_agregar_origen_a_orden.php');
        $migration->down();
        $this->assertFalse(Schema::hasColumn('orden', 'origen'));
        $migration->up();
        $this->assertSame('mesa', $mesa->fresh()->origen);
        $this->assertSame('nombre', $nombre->fresh()->origen);
        $this->assertSame(2, DB::table('orden')->count());
    }
}
