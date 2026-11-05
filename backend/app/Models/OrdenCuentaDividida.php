<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Una persona de una cuenta dividida: Cuenta `numero` de `personas` de la orden. La guarda la API
 * (backend/src/cuentasDivididas.ts) al tocar «Guardar e imprimir» en Dividir cuenta. En Cajas cada cuenta
 * se cobra por separado (recibido, cobrada_por, pagada_en); con todas pagadas, la orden queda PAGADO.
 */
class OrdenCuentaDividida extends Model
{
    public const CREATED_AT = 'creado_en';

    public const UPDATED_AT = null;

    public const IGUALES = 'iguales';

    public const PRODUCTOS = 'productos';

    protected $table = 'orden_cuenta_dividida';

    protected $fillable = [
        'idOrden', 'numero', 'personas', 'modo', 'importe', 'total_orden', 'contenido', 'creado_por',
        'recibido', 'cobrada_por', 'pagada_en',
    ];

    protected function casts(): array
    {
        return [
            'id' => 'integer', 'idOrden' => 'integer', 'numero' => 'integer', 'personas' => 'integer',
            'importe' => 'decimal:2', 'total_orden' => 'decimal:2', 'contenido' => 'array',
            'recibido' => 'decimal:2', 'pagada_en' => 'datetime',
        ];
    }

    public function pagada(): bool
    {
        return $this->pagada_en !== null;
    }

    public function orden(): BelongsTo
    {
        return $this->belongsTo(Orden::class, 'idOrden');
    }
}
