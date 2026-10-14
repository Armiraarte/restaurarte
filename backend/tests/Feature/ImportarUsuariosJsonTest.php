<?php

namespace Tests\Feature;

use App\Models\Tablet;
use App\Models\Usuario;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ImportarUsuariosJsonTest extends TestCase
{
    use RefreshDatabase;

    private string $archivo = 'storage/framework/testing/usuarios-prueba.json';

    protected function setUp(): void
    {
        parent::setUp();

        Usuario::create(['id' => 'u-admin', 'usuario' => 'admin', 'nombre' => 'Admin', 'rol' => 'admin', 'password_hash' => 'clave-prueba']);

        // Hashes "$2b$" como los genera bcryptjs en la API de Node.
        $hash = '$2b$'.substr(password_hash('1234', PASSWORD_BCRYPT), 4);
        @mkdir(dirname(base_path($this->archivo)), 0777, true);
        file_put_contents(base_path($this->archivo), json_encode([
            ['id' => 'u-1', 'usuario' => 'tablet1', 'nombre' => 'Tablet 01', 'rol' => 'tablet', 'passwordHash' => $hash, 'creadoEn' => '2026-10-07T09:23:24.658Z'],
            ['id' => 'u-2', 'usuario' => 'tablet02', 'nombre' => 'Tablet 02', 'rol' => 'tablet', 'passwordHash' => $hash, 'acceso' => 'pin'],
        ]));
    }

    protected function tearDown(): void
    {
        @unlink(base_path($this->archivo));
        parent::tearDown();
    }

    public function test_importa_usuarios_y_tablets_vinculados_sin_duplicar_al_repetir(): void
    {
        $this->artisan('pos:importar-usuarios-json', ['--archivo' => $this->archivo])->assertExitCode(0);
        $this->artisan('pos:importar-usuarios-json', ['--archivo' => $this->archivo])->assertExitCode(0);

        $this->assertDatabaseCount('usuarios', 3);
        $this->assertDatabaseCount('tablets', 2);

        $t2 = Tablet::where('numero', '02')->firstOrFail();
        $this->assertSame('u-2', $t2->usuario_id);
        $this->assertSame('u-admin', $t2->creado_por);
        $this->assertSame('Tablet 02', $t2->nombre);
        $this->assertSame('pin', $t2->usuario->acceso);

        // La contraseña/PIN sigue funcionando en Laravel (prefijo $2y$).
        $this->assertTrue(Hash::check('1234', Usuario::find('u-1')->password_hash));
    }
}
