<?php

namespace Tests\Feature;

use App\Models\Orden;
use App\Models\SesionTablet;
use App\Models\Tablet;
use App\Models\Turno;
use App\Models\Usuario;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use RuntimeException;
use Tests\TestCase;

class TurnoTest extends TestCase
{
    use RefreshDatabase;

    private Usuario $admin;

    private Tablet $tablet;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = Usuario::create(['id' => 'u-admin', 'usuario' => 'admin', 'nombre' => 'Admin', 'rol' => 'admin', 'password_hash' => 'clave-prueba']);
        $cuenta = Usuario::create(['usuario' => 'tablet01', 'nombre' => 'Tablet 01', 'rol' => 'tablet', 'password_hash' => '1234', 'acceso' => 'pin']);
        $this->tablet = Tablet::create(['usuario_id' => $cuenta->id, 'creado_por' => $this->admin->id, 'numero' => '01']);
    }

    public function test_iniciar_sesion_en_caja_abre_un_solo_turno(): void
    {
        $turno = Turno::iniciar($this->admin);
        $otraVez = Turno::iniciar($this->admin);

        $this->assertTrue($turno->is($otraVez));
        $this->assertNull($turno->fresh()->fecha_fin);
        $this->assertSame(Turno::ABIERTO, $turno->fresh()->estatus);
        $this->assertTrue($turno->usuario->is($this->admin));
        $this->assertDatabaseCount('turnos', 1);
    }

    public function test_cerrar_marca_fecha_fin_y_estatus_cerrado(): void
    {
        $turno = Turno::iniciar($this->admin);
        $turno->cerrar();

        $turno->refresh();
        $this->assertSame(Turno::CERRADO, $turno->estatus);
        $this->assertNotNull($turno->fecha_fin);
        $this->assertNull(Turno::actual());
    }

    public function test_solo_caja_abre_turno(): void
    {
        $this->expectException(InvalidArgumentException::class);
        Turno::iniciar($this->tablet->usuario);
    }

    public function test_la_tablet_necesita_turno_de_caja_para_iniciar_sesion(): void
    {
        $this->expectException(RuntimeException::class);
        SesionTablet::iniciar($this->tablet);
    }

    public function test_sesion_de_tablet_dentro_del_turno_y_mesas_del_turno(): void
    {
        $turno = Turno::iniciar($this->admin);
        $sesion = SesionTablet::iniciar($this->tablet);

        $this->assertTrue($sesion->is(SesionTablet::iniciar($this->tablet)), 'repetir no abre otra sesión');
        $this->assertTrue($sesion->turno->is($turno));

        $mesa = Orden::create(['codigo' => '5', 'idTurno' => $turno->idTurno, 'idSesion_tablet' => $sesion->id]);
        $this->assertTrue($turno->ordenes->first()->is($mesa));
        $this->assertTrue($mesa->sesionTablet->tablet->is($this->tablet));

        // Al cerrar el turno se cierran sus sesiones; el siguiente turno empieza sin mesas.
        $turno->cerrar();
        $this->assertNotNull($sesion->fresh()->cerrada_en);
        $nuevo = Turno::iniciar($this->admin);
        $this->assertFalse($nuevo->is($turno));
        $this->assertCount(0, $nuevo->ordenes);
        $this->assertFalse(SesionTablet::iniciar($this->tablet)->is($sesion));
    }
}
