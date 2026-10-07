<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tablets', function (Blueprint $table): void {
            // Mismo formato de ID que usa la app: "tablet-01".
            $table->string('id', 64)->primary();
            // Cuenta con la que inicia sesión la tablet (usuarios.rol = 'tablet'). Una cuenta por tablet.
            $table->string('usuario_id', 64)->unique();
            $table->foreign('usuario_id')->references('id')->on('usuarios')
                ->cascadeOnUpdate()
                ->restrictOnDelete(); // los usuarios se desactivan (activo = false), no se borran
            // Administrador que dio de alta la tablet (Configuración → Usuarios).
            $table->string('creado_por', 64);
            $table->foreign('creado_por')->references('id')->on('usuarios')
                ->cascadeOnUpdate()
                ->restrictOnDelete();
            $table->string('numero', 8)->unique(); // "01"
            $table->string('nombre'); // "TABLET 01"
            $table->string('ubicacion')->default(''); // "Salón principal", "Terraza"
            // Mesero en sesión; es texto hasta que exista la tabla de meseros.
            $table->string('mesero')->nullable();
            $table->timestamp('sesion_iniciada_en')->nullable();
            $table->timestamp('ultima_conexion')->nullable(); // último latido recibido (/api/tablets/latido)
            $table->string('ip', 45)->nullable(); // IPv4 o IPv6
            $table->boolean('activa')->default(true);
            $table->timestamp('creado_en')->nullable();
            $table->timestamp('actualizado_en')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tablets');
    }
};
