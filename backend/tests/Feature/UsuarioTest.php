<?php

namespace Tests\Feature;

use App\Models\Usuario;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class UsuarioTest extends TestCase
{
    use RefreshDatabase;

    public function test_normaliza_usuario_genera_id_y_guarda_solo_hash_del_pin(): void
    {
        $usuario = Usuario::create([
            'usuario' => ' TABLET_01 ',
            'nombre' => 'Tablet 01',
            'rol' => 'tablet',
            'password_hash' => '123456',
            'acceso' => 'pin',
        ])->fresh();

        $this->assertMatchesRegularExpression('/^u-[0-9a-f-]{36}$/D', $usuario->id);
        $this->assertSame('tablet_01', $usuario->usuario);
        $this->assertTrue($usuario->activo);
        $this->assertTrue(Hash::check('123456', $usuario->getAuthPassword()));
        $this->assertArrayNotHasKey('password_hash', $usuario->toArray());
        $this->assertNotNull($usuario->creado_en);
    }

    public function test_no_permite_usuarios_duplicados_por_espacios_o_mayusculas(): void
    {
        $datos = ['usuario' => 'admin', 'nombre' => 'Administrador', 'rol' => 'admin', 'password_hash' => 'clave-prueba'];
        Usuario::create($datos);

        $this->expectException(QueryException::class);
        Usuario::create(array_replace($datos, ['usuario' => ' ADMIN ']));
    }
}
