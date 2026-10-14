<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use InvalidArgumentException;

/** Complemento que se agrega o quita de un producto: Crema, Salsa, Lechuga… */
class Complemento extends Model
{
    public const CREATED_AT = 'creado_en';

    public const UPDATED_AT = 'actualizado_en';

    protected $table = 'complementos';

    protected $fillable = ['nombre', 'estatus'];

    protected $attributes = ['estatus' => 1];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'estatus' => 'integer',
            'creado_en' => 'datetime',
            'actualizado_en' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (Complemento $complemento): void {
            $complemento->nombre = trim(preg_replace('/\s+/', ' ', (string) $complemento->nombre));
            if ($complemento->nombre === '' || mb_strlen($complemento->nombre) > 100) {
                throw new InvalidArgumentException('El complemento necesita un nombre de hasta 100 caracteres.');
            }

            if (filter_var($complemento->getAttributes()['estatus'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 255]]) === false) {
                throw new InvalidArgumentException('El estatus debe ser un entero de 0 a 255.');
            }
        });
    }

    /** Productos que llevan este complemento (tabla producto_has_complemento). */
    public function productos(): BelongsToMany
    {
        return $this->belongsToMany(Producto::class, 'producto_has_complemento', 'complemento_id', 'producto_id')
            ->withTimestamps('creado_en', 'actualizado_en');
    }
}
