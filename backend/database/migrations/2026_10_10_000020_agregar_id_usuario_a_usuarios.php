<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * usuarios.idUsuario: número autoincrementable (1, 2, 3…), primera columna de la tabla.
 * El `id` de texto ("u-admin", "u-8ec2…") se conserva como llave primaria; lo siguen usando
 * tablets, turnos y sesiones_tablet. Los usuarios existentes se numeran por fecha de creación.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('usuarios', function (Blueprint $table): void {
            $table->unsignedBigInteger('idUsuario')->nullable()->first();
        });

        $numero = 0;
        foreach (DB::table('usuarios')->orderBy('creado_en')->orderBy('id')->pluck('id') as $id) {
            DB::table('usuarios')->where('id', $id)->update(['idUsuario' => ++$numero]);
        }

        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            // AUTO_INCREMENT necesita un índice: se le pone único (el id de texto sigue como llave primaria).
            DB::statement('ALTER TABLE usuarios
                MODIFY COLUMN idUsuario BIGINT UNSIGNED NOT NULL AUTO_INCREMENT FIRST,
                ADD UNIQUE INDEX usuarios_idusuario_unique (idUsuario)');
        } else {
            // SQLite (pruebas) no permite autoincremento fuera de la llave primaria: solo único.
            Schema::table('usuarios', function (Blueprint $table): void {
                $table->unique('idUsuario', 'usuarios_idusuario_unique');
            });
        }
    }

    public function down(): void
    {
        Schema::table('usuarios', function (Blueprint $table): void {
            $table->dropUnique('usuarios_idusuario_unique');
        });
        Schema::table('usuarios', function (Blueprint $table): void {
            $table->dropColumn('idUsuario');
        });
    }
};
