<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Termino extends Model
{
    public const CREATED_AT = 'creado_en';

    public const UPDATED_AT = 'actualizado_en';

    protected $table = 'termino';

    protected $fillable = ['nombre', 'estatus'];

    protected function casts(): array
    {
        return ['id' => 'integer', 'estatus' => 'integer'];
    }
}
