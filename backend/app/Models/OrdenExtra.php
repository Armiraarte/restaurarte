<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use InvalidArgumentException;

/** Cargo libre de una orden: sin producto de catálogo ni cantidad de unidades. */
class OrdenExtra extends Model
{
    public const CREATED_AT = 'creado_en';

    public const UPDATED_AT = 'actualizado_en';

    protected $table = 'orden_extra';

    protected $fillable = ['idOrden', 'descripcion', 'importe', 'mix_grupo'];

    protected function casts(): array
    {
        return ['id' => 'integer', 'idOrden' => 'integer', 'importe' => 'decimal:2', 'mix_grupo' => 'integer'];
    }

    protected static function booted(): void
    {
        static::saving(function (OrdenExtra $extra): void {
            $extra->descripcion = trim(preg_replace('/\s+/', ' ', (string) $extra->descripcion));
            if ($extra->descripcion === '' || mb_strlen($extra->descripcion) > 180) {
                throw new InvalidArgumentException('El extra necesita una descripción de hasta 180 caracteres.');
            }
            $importe = (string) ($extra->getAttributes()['importe'] ?? '');
            if (! preg_match('/^\d+(\.\d{1,2})?$/D', $importe) || (float) $importe < 0 || (float) $importe > 9999999.99) {
                throw new InvalidArgumentException('El importe debe ser cero o más y tener hasta dos decimales.');
            }
            $grupo = $extra->getAttributes()['mix_grupo'] ?? null;
            if ($grupo !== null && (filter_var($grupo, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 2147483647]]) === false
                || ! OrdenDetalle::where('idOrden', $extra->idOrden)->where('mix_grupo', $grupo)->exists())) {
                throw new InvalidArgumentException('El extra necesita un MIX de productos de la misma orden.');
            }
            $orden = Orden::find($extra->idOrden);
            if (! $orden || $orden->estatus !== Orden::ABIERTA) {
                throw new InvalidArgumentException('Solo se pueden registrar extras en una orden abierta.');
            }
        });
    }

    public function orden(): BelongsTo
    {
        return $this->belongsTo(Orden::class, 'idOrden');
    }
}
