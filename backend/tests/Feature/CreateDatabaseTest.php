<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class CreateDatabaseTest extends TestCase
{
    public function test_rechaza_conexiones_distintas_de_mysql(): void
    {
        $this->artisan('db:create')
            ->expectsOutputToContain('requiere una conexion MySQL o MariaDB')
            ->assertExitCode(1);
    }

    public function test_rechaza_nombres_de_base_invalidos(): void
    {
        config(['database.connections.mysql.database' => 'base`; DROP DATABASE mysql;']);

        $this->artisan('db:create', ['--connection' => 'mysql'])
            ->expectsOutputToContain('DB_DATABASE debe contener')
            ->assertExitCode(1);
    }

    public function test_rechaza_bases_del_sistema(): void
    {
        config(['database.connections.mysql.database' => 'mysql']);

        $this->artisan('db:create', ['--connection' => 'mysql'])
            ->expectsOutputToContain('una base propia del proyecto')
            ->assertExitCode(1);
    }

    public function test_crea_base_vacia_conserva_datos_y_aplica_clases_en_mysql_real(): void
    {
        if (! env('MYSQL_INTEGRATION_TESTS', false)) {
            $this->markTestSkipped('Define MYSQL_INTEGRATION_TESTS=1 para probar el servidor MySQL real.');
        }

        $nombre = 'restaurarte_test_'.str_replace('-', '', (string) Str::uuid());
        config([
            'database.default' => 'mysql',
            'database.connections.mysql.database' => $nombre,
            'database.connections.mysql.url' => null,
            'pos.admin.usuario' => 'admin_prueba',
            'pos.admin.nombre' => 'Administrador de prueba',
            'pos.admin.password' => 'clave-solo-para-pruebas',
        ]);

        try {
            $this->artisan('db:create')->assertExitCode(0);
            $this->assertCount(0, DB::select('SHOW TABLES'));

            DB::statement('CREATE TABLE preservada (id integer PRIMARY KEY)');
            DB::table('preservada')->insert(['id' => 1]);

            $this->artisan('db:create')
                ->expectsOutputToContain('ya existe')
                ->assertExitCode(0);
            $this->assertSame(1, DB::table('preservada')->count());

            $this->artisan('migrate', ['--database' => 'mysql', '--force' => true])->assertExitCode(0);
            $this->artisan('db:seed', ['--database' => 'mysql', '--force' => true])->assertExitCode(0);
            $this->artisan('db:seed', ['--database' => 'mysql', '--force' => true])->assertExitCode(0);

            $this->assertSame(1, DB::table('usuarios')->count());
            $admin = DB::table('usuarios')->where('id', 'u-admin')->first();
            $this->assertSame('admin_prueba', $admin->usuario);
            $this->assertTrue(Hash::check('clave-solo-para-pruebas', $admin->password_hash));
        } finally {
            $this->assertMatchesRegularExpression('/^restaurarte_test_[a-f0-9]{32}$/D', $nombre);
            DB::purge('mysql');
            $config = config('database.connections.mysql');
            $config['database'] = null;
            $config['url'] = null;
            $config['name'] = '_limpiar_prueba';
            try {
                DB::build($config)->getSchemaBuilder()->dropDatabaseIfExists($nombre);
            } finally {
                DB::purge('_limpiar_prueba');
            }
        }
    }
}
