<?php

namespace Tests\Feature;

use App\Models\CierreTurno;
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

    public function test_el_corte_guarda_el_registro_del_cierre_con_lo_vendido(): void
    {
        $turno = Turno::iniciar($this->admin);
        Orden::create(['codigo' => '1', 'idTurno' => $turno->idTurno, 'total' => '120.00', 'estatus' => Orden::PAGADO]);
        Orden::create(['codigo' => '2', 'idTurno' => $turno->idTurno, 'total' => '80.50', 'estatus' => Orden::PAGADO]);

        $cierre = $turno->cerrar($this->admin);

        $this->assertSame(CierreTurno::CORTE, $cierre->tipo);
        $this->assertSame('u-admin', $cierre->usuario_id);
        $this->assertSame(2, $cierre->ordenes_cobradas);
        $this->assertSame('200.50', $cierre->fresh()->total_vendido);
        $this->assertSame(0, $cierre->ordenes_pendientes);
        $this->assertTrue($turno->fresh()->cierre->is($cierre));
    }

    public function test_el_cierre_automatico_queda_registrado_a_la_medianoche_con_lo_pendiente(): void
    {
        $turno = Turno::iniciar($this->admin);
        Orden::create(['codigo' => '3', 'idTurno' => $turno->idTurno, 'total' => '45.00', 'estatus' => Orden::PAGANDO]);
        $medianoche = now()->startOfDay();

        $cierre = $turno->cerrar(null, $medianoche);

        $this->assertSame(CierreTurno::AUTOMATICO, $cierre->tipo);
        $this->assertNull($cierre->usuario_id);
        $this->assertSame(1, $cierre->ordenes_pendientes);
        $this->assertTrue($medianoche->equalTo($turno->fresh()->fecha_fin));
    }

    public function test_lo_que_quedo_sin_cobrar_en_un_cierre_automatico_pasa_al_siguiente_turno(): void
    {
        $ayer = Turno::iniciar($this->admin);
        $porCobrar = Orden::create(['codigo' => '4', 'idTurno' => $ayer->idTurno, 'total' => '60.00', 'estatus' => Orden::PAGANDO]);
        $conPedido = Orden::create(['codigo' => '5', 'idTurno' => $ayer->idTurno, 'total' => '30.00', 'estatus' => Orden::ABIERTA]);
        $vacia = Orden::create(['codigo' => '6', 'idTurno' => $ayer->idTurno, 'total' => '0.00', 'estatus' => Orden::ABIERTA]);
        $cobrada = Orden::create(['codigo' => '7', 'idTurno' => $ayer->idTurno, 'total' => '90.00', 'estatus' => Orden::PAGADO]);
        $ayer->cerrar(null, now()->startOfDay());

        $hoy = Turno::iniciar($this->admin);

        $this->assertSame($hoy->idTurno, $porCobrar->fresh()->idTurno);
        $this->assertSame($hoy->idTurno, $conPedido->fresh()->idTurno);
        $this->assertSame($ayer->idTurno, $vacia->fresh()->idTurno);
        $this->assertSame($ayer->idTurno, $cobrada->fresh()->idTurno);
    }

    public function test_tras_un_corte_normal_no_se_mueve_ninguna_orden(): void
    {
        $ayer = Turno::iniciar($this->admin);
        $pendiente = Orden::create(['codigo' => '8', 'idTurno' => $ayer->idTurno, 'total' => '60.00', 'estatus' => Orden::PAGANDO]);
        $ayer->cerrar($this->admin);

        Turno::iniciar($this->admin);

        $this->assertSame($ayer->idTurno, $pendiente->fresh()->idTurno);
    }

    public function test_un_turno_solo_tiene_un_registro_de_cierre(): void
    {
        $turno = Turno::iniciar($this->admin);
        $turno->cerrar($this->admin);

        $this->expectException(QueryException::class);
        CierreTurno::create(['turno_id' => $turno->idTurno, 'tipo' => CierreTurno::AUTOMATICO, 'cerrado_en' => now()]);
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
