<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use InvalidArgumentException;

class Categoria extends Model
{
    public const CREATED_AT = 'creado_en';

    public const UPDATED_AT = 'actualizado_en';

    protected $table = 'categorias';

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
        static::saving(function (Categoria $categoria): void {
            $categoria->nombre = trim(preg_replace('/\s+/', ' ', (string) $categoria->nombre));
            if ($categoria->nombre === '' || mb_strlen($categoria->nombre) > 100) {
                throw new InvalidArgumentException('La categoría necesita un nombre de hasta 100 caracteres.');
            }

            if (filter_var($categoria->getAttributes()['estatus'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 255]]) === false) {
                throw new InvalidArgumentException('El estatus debe ser un entero de 0 a 255.');
            }
        });
    }

    public function productos(): HasMany
    {
        return $this->hasMany(Producto::class, 'categoria_id');
    }
}
