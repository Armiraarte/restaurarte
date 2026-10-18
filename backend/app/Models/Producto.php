<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use InvalidArgumentException;

class Producto extends Model
{
    public const CREATED_AT = 'creado_en';

    public const UPDATED_AT = 'actualizado_en';

    protected $table = 'producto';

    protected $fillable = ['categoria_id', 'nombre', 'tamano', 'grupo', 'precio', 'estatus', 'imagen'];

    protected $hidden = ['tamano_clave'];

    protected $attributes = ['estatus' => 1, 'precio' => '0.00'];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'categoria_id' => 'integer',
            'precio' => 'decimal:2',
            'estatus' => 'integer',
            'creado_en' => 'datetime',
            'actualizado_en' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (Producto $producto): void {
            $producto->nombre = trim(preg_replace('/\s+/', ' ', (string) $producto->nombre));
            if ($producto->nombre === '' || mb_strlen($producto->nombre) > 100) {
                throw new InvalidArgumentException('El producto necesita un nombre de hasta 100 caracteres.');
            }

            if (filter_var($producto->getAttributes()['estatus'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 255]]) === false) {
                throw new InvalidArgumentException('El estatus debe ser un entero de 0 a 255.');
            }

            $precio = (string) $producto->getAttributes()['precio'];
            if (! preg_match('/^\d+(\.\d{1,2})?$/D', $precio) || (float) $precio > 9999999999.99) {
                throw new InvalidArgumentException('El precio debe ser un importe no negativo con hasta dos decimales.');
            }

            // Tamaño opcional ("Chica", "Media orden"…); vacío se guarda como NULL.
            $tamano = $producto->tamano === null ? null : trim(preg_replace('/\s+/', ' ', (string) $producto->tamano));
            $producto->tamano = $tamano === '' ? null : $tamano;
            if ($producto->tamano !== null && mb_strlen($producto->tamano) > 50) {
                throw new InvalidArgumentException('El tamaño admite hasta 50 caracteres.');
            }

            $imagen = $producto->imagen === null ? null : trim((string) $producto->imagen);
            $producto->imagen = $imagen === '' ? null : $imagen;
            if ($producto->imagen !== null && mb_strlen($producto->imagen) > 255) {
                throw new InvalidArgumentException('La ruta de la imagen admite hasta 255 caracteres.');
            }

            if ($producto->isDirty('categoria_id') && ! Categoria::whereKey($producto->categoria_id)->exists()) {
                throw new InvalidArgumentException('La categoría no existe.');
            }
        });
    }

    public function categoria(): BelongsTo
    {
        return $this->belongsTo(Categoria::class, 'categoria_id');
    }

    /** Complementos del producto (tabla producto_has_complemento). */
    public function complementos(): BelongsToMany
    {
        return $this->belongsToMany(Complemento::class, 'producto_has_complemento', 'producto_id', 'complemento_id')
            ->withTimestamps('creado_en', 'actualizado_en');
    }

    /** Renglones de órdenes en los que se pidió este producto (orden_has_detalle). */
    public function detallesOrden(): HasMany
    {
        return $this->hasMany(OrdenDetalle::class, 'idProducto');
    }
}
