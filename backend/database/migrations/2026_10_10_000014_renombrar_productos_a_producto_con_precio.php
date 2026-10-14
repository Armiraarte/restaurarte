<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * La tabla `productos` pasa a llamarse `producto` y guarda su propio precio:
 *   1. Renombra la tabla (las llaves foráneas de otras tablas la siguen).
 *   2. Agrega `precio` después de `tamano` y lo llena con producto_precio.
 *   3. Elimina producto_precio (su información ya quedó en producto.precio).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::rename('productos', 'producto');

        Schema::table('producto', function (Blueprint $table): void {
            $table->decimal('precio', 12, 2)->default(0)->after('tamano');
        });

        DB::statement('UPDATE producto SET precio = COALESCE(
            (SELECT pp.precio FROM producto_precio pp WHERE pp.producto_id = producto.id), 0)');

        // Primero se elimina producto_precio: en MySQL el nombre de su CHECK se reutiliza abajo.
        Schema::dropIfExists('producto_precio');

        if ($this->esMysql()) {
            DB::statement('ALTER TABLE producto ADD CONSTRAINT producto_precio_no_negativo CHECK (precio >= 0)');
        }
    }

    public function down(): void
    {
        Schema::create('producto_precio', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('producto_id')->unique()->constrained('producto')->cascadeOnUpdate()->cascadeOnDelete();
            $table->decimal('precio', 12, 2);
            $table->timestamp('creado_en')->useCurrent();
            $table->timestamp('actualizado_en')->useCurrent()->useCurrentOnUpdate();
        });
        DB::statement('INSERT INTO producto_precio (producto_id, precio) SELECT id, precio FROM producto');

        if ($this->esMysql()) {
            DB::statement('ALTER TABLE producto DROP CONSTRAINT producto_precio_no_negativo');
        }
        Schema::table('producto', function (Blueprint $table): void {
            $table->dropColumn('precio');
        });
        Schema::rename('producto', 'productos');

        if ($this->esMysql()) {
            DB::statement('ALTER TABLE producto_precio ADD CONSTRAINT producto_precio_no_negativo CHECK (precio >= 0)');
        }
    }

    private function esMysql(): bool
    {
        return in_array(DB::getDriverName(), ['mysql', 'mariadb'], true);
    }
};
