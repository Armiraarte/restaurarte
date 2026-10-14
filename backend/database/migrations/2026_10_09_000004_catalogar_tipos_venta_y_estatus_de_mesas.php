<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tipos_venta', function (Blueprint $table): void {
            $table->id();
            $table->string('codigo', 32)->unique();
            $table->string('nombre', 100);
            $table->timestamp('creado_en')->nullable();
            $table->timestamp('actualizado_en')->nullable();
        });

        // Catálogo necesario para convertir el tipo de servicio de las mesas existentes.
        $fecha = now();
        DB::table('tipos_venta')->insert([
            ['id' => 1, 'codigo' => 'comer_aqui', 'nombre' => 'Comer aquí', 'creado_en' => $fecha, 'actualizado_en' => $fecha],
            ['id' => 2, 'codigo' => 'para_llevar', 'nombre' => 'Para llevar', 'creado_en' => $fecha, 'actualizado_en' => $fecha],
        ]);

        Schema::table('mesas', function (Blueprint $table): void {
            $table->foreignId('tipo_venta_id')->default(1)->constrained('tipos_venta')
                ->restrictOnUpdate()->restrictOnDelete();
            // Código numérico; el significado de cada estatus se definirá después.
            $table->unsignedTinyInteger('estatus')->default(1);
        });

        DB::table('mesas')->update([
            'tipo_venta_id' => DB::raw('CASE WHEN para_llevar = 1 THEN 2 ELSE 1 END'),
            'estatus' => DB::raw('CASE WHEN activa = 1 THEN 1 ELSE 0 END'),
        ]);

        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement('ALTER TABLE mesas DROP CONSTRAINT mesas_para_llevar_valido');
        }

        Schema::table('mesas', function (Blueprint $table): void {
            $table->dropColumn(['para_llevar', 'activa']);
        });
    }

    public function down(): void
    {
        Schema::table('mesas', function (Blueprint $table): void {
            $table->boolean('para_llevar')->default(false);
            $table->boolean('activa')->default(true);
        });

        DB::table('mesas')->update([
            'para_llevar' => DB::raw('CASE WHEN tipo_venta_id = 2 THEN 1 ELSE 0 END'),
            'activa' => DB::raw('CASE WHEN estatus = 0 THEN 0 ELSE 1 END'),
        ]);

        Schema::table('mesas', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('tipo_venta_id');
            $table->dropColumn('estatus');
        });

        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement('ALTER TABLE mesas
                ADD CONSTRAINT mesas_para_llevar_valido CHECK (para_llevar IN (0, 1))');
        }

        Schema::dropIfExists('tipos_venta');
    }
};
