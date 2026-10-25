<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Una persona de una cuenta dividida: Cuenta `numero` de `personas` de la orden. La guarda la API
 * (backend/src/cuentasDivididas.ts) al tocar «Guardar e imprimir» en Dividir cuenta.
 */
class OrdenCuentaDividida extends Model
{
    public const CREATED_AT = 'creado_en';

    public const UPDATED_AT = null;

    public const IGUALES = 'iguales';

    public const PRODUCTOS = 'productos';

    protected $table = 'orden_cuenta_dividida';

    protected $fillable = ['idOrden', 'numero', 'personas', 'modo', 'importe', 'total_orden', 'contenido', 'creado_por'];

    protected function casts(): array
    {
        return [
            'id' => 'integer', 'idOrden' => 'integer', 'numero' => 'integer', 'personas' => 'integer',
            'importe' => 'decimal:2', 'total_orden' => 'decimal:2', 'contenido' => 'array',
        ];
    }

    public function orden(): BelongsTo
    {
        return $this->belongsTo(Orden::class, 'idOrden');
    }
}
