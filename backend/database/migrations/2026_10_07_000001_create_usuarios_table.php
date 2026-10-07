<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('usuarios', function (Blueprint $table): void {
            $table->string('id', 64)->primary();
            $table->string('usuario', 32)->unique();
            $table->string('nombre');
            $table->enum('rol', ['admin', 'cajero', 'mesero', 'cocina', 'tablet']);
            $table->string('password_hash');
            $table->enum('acceso', ['password', 'pin'])->default('password');
            $table->boolean('activo')->default(true);
            $table->timestamp('creado_en')->nullable();
            $table->timestamp('actualizado_en')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('usuarios');
    }
};
