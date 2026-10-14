<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use InvalidArgumentException;

/**
 * Renglón del detalle de una orden (tabla orden_has_detalle): producto y cantidad.
 * Si no se indica subtotal, se calcula como cantidad × producto.precio al guardarlo.
 */
class OrdenDetalle extends Model
{
    public const CREATED_AT = 'creado_en';

    public const UPDATED_AT = 'actualizado_en';

    protected $table = 'orden_has_detalle';

    protected $primaryKey = 'idDetalle_Orden';

    protected $fillable = ['idOrden', 'idProducto', 'cantidad', 'subtotal'];

    protected function casts(): array
    {
        return [
            'idDetalle_Orden' => 'integer',
            'idOrden' => 'integer',
            'idProducto' => 'integer',
            'cantidad' => 'integer',
            'subtotal' => 'decimal:2',
            'creado_en' => 'datetime',
            'actualizado_en' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (OrdenDetalle $detalle): void {
            if (filter_var($detalle->cantidad, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) === false) {
                throw new InvalidArgumentException('La cantidad debe ser un entero mayor que cero.');
            }

            $producto = Producto::find($detalle->idProducto)
                ?? throw new InvalidArgumentException('El producto no existe.');

            // Subtotal = cantidad × precio del producto en este momento (se guarda y ya no cambia con el precio).
            if ($detalle->subtotal === null || $detalle->isDirty(['cantidad', 'idProducto'])) {
                $detalle->subtotal = number_format($detalle->cantidad * (float) $producto->precio, 2, '.', '');
            }

            $subtotal = (string) $detalle->getAttributes()['subtotal'];
            if (! preg_match('/^\d+(\.\d{1,2})?$/D', $subtotal)) {
                throw new InvalidArgumentException('El subtotal debe ser un importe no negativo con hasta dos decimales.');
            }
        });
    }

    public function orden(): BelongsTo
    {
        return $this->belongsTo(Orden::class, 'idOrden');
    }

    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class, 'idProducto');
    }
}
