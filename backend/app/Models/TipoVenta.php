<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TipoVenta extends Model
{
    public const COMER_AQUI = 1;

    public const PARA_LLEVAR = 2;

    public const CREATED_AT = 'creado_en';

    public const UPDATED_AT = 'actualizado_en';

    protected $table = 'tipos_venta';

    protected $fillable = ['id', 'codigo', 'nombre'];

    /** Órdenes de este tipo (orden.tipo_orden). */
    public function ordenes(): HasMany
    {
        return $this->hasMany(Orden::class, 'tipo_orden');
    }
}
