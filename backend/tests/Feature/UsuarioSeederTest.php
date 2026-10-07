<?php

namespace Tests\Feature;

use App\Models\Usuario;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use InvalidArgumentException;
use Tests\TestCase;

class UsuarioSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_repetir_seeder_conserva_el_administrador_y_su_clave(): void
    {
        config([
            'pos.admin.usuario' => 'admin',
            'pos.admin.nombre' => 'Administrador',
            'pos.admin.password' => 'clave-inicial-prueba',
        ]);
        $this->seed(DatabaseSeeder::class);
        $admin = Usuario::findOrFail('u-admin');
        $admin->update(['nombre' => 'Nombre actualizado']);

        config(['pos.admin.password' => 'otra-clave-prueba']);
        $this->seed(DatabaseSeeder::class);

        $this->assertDatabaseCount('usuarios', 1);
        $this->assertSame('Nombre actualizado', $admin->fresh()->nombre);
        $this->assertTrue(Hash::check('clave-inicial-prueba', $admin->fresh()->password_hash));
        $this->assertFalse(Hash::check('otra-clave-prueba', $admin->fresh()->password_hash));
    }

    public function test_no_carga_un_administrador_sin_configuracion_valida(): void
    {
        config(['pos.admin.password' => '']);

        try {
            $this->seed(DatabaseSeeder::class);
            $this->fail('El seeder debe exigir credenciales antes de insertar.');
        } catch (InvalidArgumentException $exception) {
            $this->assertStringContainsString('ADMIN_PASSWORD', $exception->getMessage());
            $this->assertDatabaseCount('usuarios', 0);
        }
    }
}
