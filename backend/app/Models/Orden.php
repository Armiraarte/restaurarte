<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use InvalidArgumentException;

/** Orden (antes "mesa"): número de mesa o nombre del cliente, registrada en un turno. Tabla `orden`. */
class Orden extends Model
{
    public const CREATED_AT = 'creado_en';

    public const UPDATED_AT = 'actualizado_en';

    /** orden.estatus */
    public const ABIERTA = 0;

    public const PAGANDO = 1;

    public const PAGADO = 2;

    protected $table = 'orden';

    protected $primaryKey = 'idOrden';

    public $incrementing = true;

    protected $keyType = 'int';

    protected $fillable = ['codigo', 'nombre', 'origen', 'total', 'tipo_orden', 'estatus', 'idTurno', 'idSesion_tablet'];

    protected $attributes = [
        'tipo_orden' => TipoVenta::COMER_AQUI,
        'total' => '0.00',
        'estatus' => self::ABIERTA,
    ];

    protected function casts(): array
    {
        return [
            'idOrden' => 'integer',
            'total' => 'decimal:2',
            'tipo_orden' => 'integer',
            'estatus' => 'integer',
            'idTurno' => 'integer',
            'idSesion_tablet' => 'integer',
            'creado_en' => 'datetime',
            'actualizado_en' => 'datetime',
        ];
    }

    /** "Mesa 05" → "5"; un nombre ("Terraza") se conserva sin espacios sobrantes. */
    public static function normalizarNombre(string $nombre): string
    {
        $nombre = trim(preg_replace('/\s+/', ' ', $nombre));
        if (preg_match('/^(?:mesa\s*)?0*(\d+)$/iD', $nombre, $m)) {
            return $m[1] === '' ? '0' : $m[1];
        }

        return $nombre;
    }

    protected static function booted(): void
    {
        static::saving(function (Orden $orden): void {
            $orden->codigo = self::normalizarNombre((string) ($orden->codigo ?? $orden->nombre));
            $orden->nombre = self::normalizarNombre((string) ($orden->nombre ?? $orden->codigo));
            if ($orden->codigo === '' || $orden->nombre === '') {
                throw new InvalidArgumentException('La orden necesita un número de mesa o un nombre.');
            }
            if (mb_strlen($orden->codigo) > 100 || mb_strlen($orden->nombre) > 100) {
                throw new InvalidArgumentException('El código y nombre admiten hasta 100 caracteres.');
            }

            $total = (string) $orden->getAttributes()['total'];
            if (! preg_match('/^\d+(\.\d{1,2})?$/D', $total) || (float) $total > 9999999999.99) {
                throw new InvalidArgumentException('El total debe ser un importe no negativo con hasta dos decimales.');
            }

            $estatus = $orden->getAttributes()['estatus'];
            if (filter_var($estatus, FILTER_VALIDATE_INT, ['options' => ['min_range' => self::ABIERTA, 'max_range' => self::PAGADO]]) === false) {
                throw new InvalidArgumentException('El estatus debe ser 0 (abierta), 1 (pagando) o 2 (pagado).');
            }

            if ($orden->isDirty('tipo_orden') && ! TipoVenta::whereKey($orden->tipo_orden)->exists()) {
                throw new InvalidArgumentException('El tipo de orden no existe en el catálogo.');
            }
        });
    }

    /** Tipo de orden (tipos_venta): comer aquí o para llevar. */
    public function tipoOrden(): BelongsTo
    {
        return $this->belongsTo(TipoVenta::class, 'tipo_orden');
    }

    /** Turno de caja en que se registró la orden (la tablet solo muestra las del turno abierto). */
    public function turno(): BelongsTo
    {
        return $this->belongsTo(Turno::class, 'idTurno', 'idTurno');
    }

    /** Sesión de tablet desde la que se registró. */
    public function sesionTablet(): BelongsTo
    {
        return $this->belongsTo(SesionTablet::class, 'idSesion_tablet');
    }

    /** Productos pedidos en la orden (tabla orden_has_detalle). */
    public function detalles(): HasMany
    {
        return $this->hasMany(OrdenDetalle::class, 'idOrden');
    }

    public function extras(): HasMany
    {
        return $this->hasMany(OrdenExtra::class, 'idOrden');
    }
}
