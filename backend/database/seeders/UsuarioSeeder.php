<?php

namespace Database\Seeders;

use App\Models\Usuario;
use Illuminate\Database\Seeder;
use InvalidArgumentException;

class UsuarioSeeder extends Seeder
{
    public function run(): void
    {
        if (Usuario::find('u-admin')) {
            return;
        }

        $usuario = strtolower(trim((string) config('pos.admin.usuario')));
        $nombre = trim((string) config('pos.admin.nombre'));
        $password = (string) config('pos.admin.password');

        if (! preg_match('/^[a-z0-9._-]{3,32}$/D', $usuario) || $nombre === '' || strlen($password) < 6) {
            throw new InvalidArgumentException('Configura ADMIN_USUARIO, ADMIN_NOMBRE y ADMIN_PASSWORD en backend/.env.');
        }

        Usuario::firstOrCreate(['id' => 'u-admin'], [
            'usuario' => $usuario,
            'nombre' => $nombre,
            'rol' => 'admin',
            'password_hash' => $password,
            'acceso' => 'password',
            'activo' => true,
        ]);
    }
}
