<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use InvalidArgumentException;

/**
 * Renglón del detalle de una orden (tabla orden_has_detalle): producto y cantidad.
 * Si no se indica subtotal, se calcula como cantidad × (producto.precio + carnes extra) al guardarlo.
 * sin_queso:   Quesadillas y Hamburguesas; se marca cuando las piden SIN QUESO.
 * carne_extra: solo Hamburguesas; 1 = DOBLE CARNE, 2 = TRIPLE CARNE, cada una a PRECIO_CARNE_EXTRA.
 */
class OrdenDetalle extends Model
{
    public const CREATED_AT = 'creado_en';

    public const UPDATED_AT = 'actualizado_en';

    protected $table = 'orden_has_detalle';

    protected $primaryKey = 'idDetalle_Orden';

    public const CATEGORIAS_SIN_QUESO = ['Tacos', 'Sopes', 'Quesadillas', 'Hamburguesas', 'Lonches'];

    public const CATEGORIA_CARNE_EXTRA = 'Hamburguesas';

    /** Precio de cada carne extra por pieza (igual que backend/src/detallePedido.ts). */
    public const PRECIO_CARNE_EXTRA = 20;

    /** Hasta triple carne: la normal más dos extra. */
    public const MAX_CARNE_EXTRA = 2;

    protected $fillable = ['idOrden', 'idProducto', 'cantidad', 'sin_queso', 'con_queso', 'carne_extra', 'mix_grupo', 'opciones', 'termino_id', 'subtotal'];

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
            'termino_id' => 'integer',
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
            if ($detalle->con_queso && ! in_array($categoria, self::CATEGORIAS_SIN_QUESO, true)) {
                throw new InvalidArgumentException('La opción CON QUESO no está disponible para este producto.');
            }
            if ($detalle->con_queso && $detalle->sin_queso) {
                throw new InvalidArgumentException('El producto no puede llevar CON QUESO y SIN QUESO a la vez.');
            }
            if ($detalle->termino_id !== null) {
                $termino = Termino::whereKey($detalle->termino_id)->where('estatus', 1)->first();
                if (! $termino || ! in_array($categoria, ['Tacos', 'Tacos Dorados'], true) || ($categoria === 'Tacos Dorados' && $termino->nombre === 'Dorado')) {
                    throw new InvalidArgumentException('El término no está disponible para este producto.');
                }
            }
            if ($detalle->mix_grupo !== null && filter_var($detalle->mix_grupo, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) === false) {
                throw new InvalidArgumentException('El grupo MIX debe ser un entero mayor que cero.');
            }
            if ($detalle->sin_queso && ! in_array($categoria, self::CATEGORIAS_SIN_QUESO, true)) {
                throw new InvalidArgumentException('La opción SIN QUESO no está disponible para este producto.');
            }

            $carneExtra = $detalle->carne_extra ?? 0;
            if (filter_var($carneExtra, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => self::MAX_CARNE_EXTRA]]) === false) {
                throw new InvalidArgumentException('La carne extra va de 0 a '.self::MAX_CARNE_EXTRA.'.');
            }
            if ($carneExtra > 0 && $categoria !== self::CATEGORIA_CARNE_EXTRA) {
                throw new InvalidArgumentException('Solo las hamburguesas llevan carne extra.');
            }

            $opciones = $detalle->opciones ?? [];
            $papas = $opciones['papas'] ?? null;
            $papasAnteriores = $detalle->getOriginal('opciones')['papas'] ?? null;
            if ($papas !== null) {
                if (! in_array($categoria, ['Hamburguesas', 'Lonches'], true)) {
                    throw new InvalidArgumentException('Solo las hamburguesas y lonches ofrecen CON PAPAS.');
                }
                if (! $detalle->exists || $papas !== $papasAnteriores) {
                    $productoPapas = Producto::whereHas('categoria', fn ($q) => $q->where('nombre', 'Papas a la Francesa')->where('estatus', 1))
                        ->where('tamano', 'Orden completa')->where('estatus', 1)->first()
                        ?? throw new InvalidArgumentException('La orden completa de papas no está disponible.');
                    $papas = [
                        'idProducto' => $productoPapas->id, 'nombre' => $productoPapas->nombre,
                        'tamano' => $productoPapas->tamano, 'precio' => (float) $productoPapas->precio,
                    ];
                    $detalle->opciones = [...$opciones, 'papas' => $papas];
                }
            }

            // Subtotal = cantidad × (precio del producto + carnes extra + orden completa de papas)
            // (se guarda y ya no cambia con el precio).
            if ($detalle->subtotal === null || $detalle->isDirty(['cantidad', 'idProducto', 'carne_extra']) || $papas !== $papasAnteriores) {
                $porPieza = (float) $producto->precio + $carneExtra * self::PRECIO_CARNE_EXTRA + ($papas['precio'] ?? 0);
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

    public function termino(): BelongsTo
    {
        return $this->belongsTo(Termino::class, 'termino_id');
    }
}
