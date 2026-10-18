<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Opciones que se registran en cada renglón (la API solo las acepta en su categoría):
        //   sin_queso   → Quesadillas: llevan queso sin registrarlo; se marca cuando las piden NO QUESO.
        //   carne_extra → Hamburguesas: 0 normal, 1 DOBLE CARNE, 2 TRIPLE CARNE; cada carne extra suma
        //                 OrdenDetalle::PRECIO_CARNE_EXTRA al precio de la pieza (ya incluido en subtotal).
        Schema::table('orden_has_detalle', function (Blueprint $table): void {
            $table->boolean('sin_queso')->default(false)->after('cantidad');
            $table->unsignedTinyInteger('carne_extra')->default(0)->after('sin_queso');
        });
    }

    public function down(): void
    {
        Schema::table('orden_has_detalle', function (Blueprint $table): void {
            $table->dropColumn(['sin_queso', 'carne_extra']);
        });
    }
};
