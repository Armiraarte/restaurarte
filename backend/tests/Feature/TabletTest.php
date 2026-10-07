<?php

namespace Tests\Feature;

use App\Models\Tablet;
use App\Models\Usuario;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use Tests\TestCase;

class TabletTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): Usuario
    {
        return Usuario::firstOrCreate(['id' => 'u-admin'], [
            'usuario' => 'admin',
            'nombre' => 'Administrador',
            'rol' => 'admin',
            'password_hash' => 'clave-prueba',
        ]);
    }

    private function cuentaTablet(string $usuario = 'tablet01'): Usuario
    {
        return Usuario::create([
            'usuario' => $usuario,
            'nombre' => 'Tablet '.$usuario,
            'rol' => 'tablet',
            'password_hash' => '1234',
            'acceso' => 'pin',
        ]);
    }

    private function registrar(Usuario $cuenta, string $numero, array $extra = []): Tablet
    {
        return Tablet::create(['usuario_id' => $cuenta->id, 'creado_por' => $this->admin()->id, 'numero' => $numero] + $extra);
    }

    public function test_vincula_la_tablet_con_su_usuario_y_con_quien_la_registro(): void
    {
        $cuenta = $this->cuentaTablet();

        $tablet = $this->registrar($cuenta, '1', ['ubicacion' => 'Terraza'])->fresh();

        $this->assertSame('tablet-01', $tablet->id);
        $this->assertSame('01', $tablet->numero);
        $this->assertSame('TABLET 01', $tablet->nombre);
        $this->assertTrue($tablet->activa);
        $this->assertTrue($tablet->usuario->is($cuenta));
        $this->assertTrue($cuenta->fresh()->tablet->is($tablet));
        $this->assertTrue($tablet->creadoPor->is($this->admin()));
        $this->assertTrue($this->admin()->tabletsRegistradas->first()->is($tablet));
    }

    public function test_solo_se_vincula_a_usuarios_con_rol_tablet(): void
    {
        $this->expectException(InvalidArgumentException::class);
        Tablet::create(['usuario_id' => $this->admin()->id, 'creado_por' => $this->admin()->id, 'numero' => '01']);
    }

    public function test_solo_un_administrador_puede_registrarla(): void
    {
        $cuenta = $this->cuentaTablet('tablet01');

        $this->expectException(InvalidArgumentException::class);
        Tablet::create(['usuario_id' => $cuenta->id, 'creado_por' => $this->cuentaTablet('tablet02')->id, 'numero' => '01']);
    }

    public function test_una_cuenta_no_puede_tener_dos_tablets(): void
    {
        $cuenta = $this->cuentaTablet();
        $this->registrar($cuenta, '01');

        $this->expectException(QueryException::class);
        $this->registrar($cuenta, '02');
    }

    public function test_no_permite_numeros_de_tablet_repetidos(): void
    {
        $this->registrar($this->cuentaTablet('tablet01'), '01');

        $this->expectException(QueryException::class);
        $this->registrar($this->cuentaTablet('tablet02'), '1', ['id' => 'tablet-otra']);
    }

    public function test_no_se_puede_borrar_un_usuario_con_tablet_vinculada(): void
    {
        $cuenta = $this->cuentaTablet();
        $this->registrar($cuenta, '01');

        $this->expectException(QueryException::class);
        $cuenta->delete();
    }
}
