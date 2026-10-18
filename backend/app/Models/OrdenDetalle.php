<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use InvalidArgumentException;

/**
 * Renglón del detalle de una orden (tabla orden_has_detalle): producto y cantidad.
 * Si no se indica subtotal, se calcula como cantidad × (producto.precio + carnes extra) al guardarlo.
 * sin_queso:   solo Quesadillas; llevan queso sin registrarlo y se marca cuando las piden NO QUESO.
 * carne_extra: solo Hamburguesas; 1 = DOBLE CARNE, 2 = TRIPLE CARNE, cada una a PRECIO_CARNE_EXTRA.
 */
class OrdenDetalle extends Model
{
    public const CREATED_AT = 'creado_en';

    public const UPDATED_AT = 'actualizado_en';

    protected $table = 'orden_has_detalle';

    protected $primaryKey = 'idDetalle_Orden';

    public const CATEGORIA_SIN_QUESO = 'Quesadillas';

    public const CATEGORIA_CARNE_EXTRA = 'Hamburguesas';

    /** Precio de cada carne extra por pieza (igual que backend/src/detallePedido.ts). */
    public const PRECIO_CARNE_EXTRA = 20;

    /** Hasta triple carne: la normal más dos extra. */
    public const MAX_CARNE_EXTRA = 2;

    protected $fillable = ['idOrden', 'idProducto', 'cantidad', 'sin_queso', 'con_queso', 'carne_extra', 'mix_grupo', 'opciones', 'subtotal'];

    protected function casts(): array
    {
        return [
            'idDetalle_Orden' => 'integer',
            'idOrden' => 'integer',
            'idProducto' => 'integer',
            'cantidad' => 'integer',
            'sin_queso' => 'boolean',
            'con_queso' => 'boolean',
            'mix_grupo' => 'integer',
            'opciones' => 'array',
            'carne_extra' => 'integer',
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

            $categoria = $producto->categoria?->nombre;
            if ($detalle->con_queso && $categoria !== 'Tacos') {
                throw new InvalidArgumentException('Solo los tacos usan la opción CON QUESO.');
            }
            if ($detalle->mix_grupo !== null && filter_var($detalle->mix_grupo, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) === false) {
                throw new InvalidArgumentException('El grupo MIX debe ser un entero mayor que cero.');
            }
            if ($detalle->sin_queso && $categoria !== self::CATEGORIA_SIN_QUESO) {
                throw new InvalidArgumentException('Solo las quesadillas se pueden pedir sin queso.');
            }

            $carneExtra = $detalle->carne_extra ?? 0;
            if (filter_var($carneExtra, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => self::MAX_CARNE_EXTRA]]) === false) {
                throw new InvalidArgumentException('La carne extra va de 0 a '.self::MAX_CARNE_EXTRA.'.');
            }
            if ($carneExtra > 0 && $categoria !== self::CATEGORIA_CARNE_EXTRA) {
                throw new InvalidArgumentException('Solo las hamburguesas llevan carne extra.');
            }

            // Subtotal = cantidad × (precio del producto + carnes extra) en este momento
            // (se guarda y ya no cambia con el precio).
            if ($detalle->subtotal === null || $detalle->isDirty(['cantidad', 'idProducto', 'carne_extra'])) {
                $porPieza = (float) $producto->precio + $carneExtra * self::PRECIO_CARNE_EXTRA;
                $detalle->subtotal = number_format($detalle->cantidad * $porPieza, 2, '.', '');
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
