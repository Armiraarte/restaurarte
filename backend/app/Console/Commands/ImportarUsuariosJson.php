<?php

namespace App\Console\Commands;

use App\Models\Tablet;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Pasa a MySQL los usuarios que la API de Node guardó en data/usuarios.json (antes de conectar la base)
 * y crea la fila de `tablets` de cada cuenta de tablet, vinculada a su usuario y a quien la registró.
 * Se puede repetir: lo que ya existe no se duplica ni se modifica.
 */
class ImportarUsuariosJson extends Command
{
    protected $signature = 'pos:importar-usuarios-json
        {--archivo=data/usuarios.json : Archivo JSON de la API de Node}
        {--registro=u-admin : ID del administrador que figura como quien dio de alta las tablets}';

    protected $description = 'Importa a MySQL los usuarios y tablets guardados en el JSON de la API';

    public function handle(): int
    {
        $ruta = base_path($this->option('archivo'));
        if (! is_file($ruta)) {
            $this->error("No existe {$ruta}.");

            return self::FAILURE;
        }

        $usuarios = json_decode((string) file_get_contents($ruta), true);
        if (! is_array($usuarios)) {
            $this->error('El archivo no contiene una lista de usuarios válida.');

            return self::FAILURE;
        }

        $registro = (string) $this->option('registro');
        if (DB::table('usuarios')->where('id', $registro)->value('rol') !== 'admin') {
            $this->error("{$registro} no es un administrador en la tabla usuarios.");

            return self::FAILURE;
        }

        $nuevosUsuarios = 0;
        $nuevasTablets = 0;

        try {
            DB::transaction(function () use ($usuarios, $registro, &$nuevosUsuarios, &$nuevasTablets): void {
                foreach ($usuarios as $u) {
                    if (($u['id'] ?? '') === 'u-admin' || empty($u['usuario']) || empty($u['passwordHash'])) {
                        continue;
                    }

                    $usuario = strtolower(trim($u['usuario']));
                    $existente = DB::table('usuarios')->where('id', $u['id'])->orWhere('usuario', $usuario)->first();

                    if (! $existente) {
                        // Se copia el hash tal cual (no se vuelve a cifrar). Node genera "$2b$" y Laravel solo
                        // acepta "$2y$"; es el mismo bcrypt, así que basta con cambiar el prefijo.
                        DB::table('usuarios')->insert([
                            'id' => $u['id'],
                            'usuario' => $usuario,
                            'nombre' => trim($u['nombre'] ?? $usuario),
                            'rol' => $u['rol'],
                            'password_hash' => $this->hashLaravel($u['passwordHash']),
                            'acceso' => ($u['acceso'] ?? 'password') === 'pin' ? 'pin' : 'password',
                            'activo' => true,
                            'creado_en' => isset($u['creadoEn']) ? Carbon::parse($u['creadoEn']) : now(),
                            'actualizado_en' => now(),
                        ]);
                        $existente = DB::table('usuarios')->where('id', $u['id'])->first();
                        $nuevosUsuarios++;
                        $this->line("  usuario  {$usuario} ({$u['rol']})");
                    }

                    if ($existente->rol === 'tablet' && ! Tablet::where('usuario_id', $existente->id)->exists()) {
                        $tablet = Tablet::create([
                            'usuario_id' => $existente->id,
                            'creado_por' => $registro,
                            'numero' => $this->numeroLibre($existente->nombre.' '.$existente->usuario),
                            'nombre' => strtoupper($existente->nombre),
                        ]);
                        $nuevasTablets++;
                        $this->line("  tablet   {$tablet->nombre} (#{$tablet->numero}) → {$existente->usuario}");
                    }
                }
            });
        } catch (Throwable $e) {
            $this->error('No se importó nada: '.$e->getMessage());

            return self::FAILURE;
        }

        $this->info("Listo: {$nuevosUsuarios} usuarios y {$nuevasTablets} tablets nuevos.");

        return self::SUCCESS;
    }

    /** "$2b$…" / "$2a$…" (bcryptjs) → "$2y$…" (PHP/Laravel). Mismo algoritmo, otro prefijo. */
    private function hashLaravel(string $hash): string
    {
        return in_array(substr($hash, 0, 4), ['$2a$', '$2b$'], true) ? '$2y$'.substr($hash, 4) : $hash;
    }

    /** Número de la tablet a partir de su nombre ("Tablet 02" → "02"); si está ocupado, el siguiente libre. */
    private function numeroLibre(string $texto): string
    {
        $numero = preg_match('/(\d+)/', $texto, $m) ? (int) $m[1] : 1;
        $ocupados = Tablet::pluck('numero')->map(fn ($n) => (int) $n)->all();
        while (in_array($numero, $ocupados, true)) {
            $numero++;
        }

        return str_pad((string) $numero, 2, '0', STR_PAD_LEFT);
    }
}
