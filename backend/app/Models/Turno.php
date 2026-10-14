<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Turno de caja: lo inicia un administrador o cajero con «Iniciar turno». Solo uno abierto a la vez.
 * Tabla `turnos`: idTurno, idUsuario, fecha_inicio, fecha_fin, estatus (1 abierto, 0 cerrado), creado_en, actualizado_en.
 */
class Turno extends Model
{
    public const CREATED_AT = 'creado_en';

    public const UPDATED_AT = 'actualizado_en';

    /** turnos.estatus */
    public const ABIERTO = 1;

    public const CERRADO = 0;

    /** Roles que pueden iniciar el turno de caja. */
    public const ROLES_CAJA = ['admin', 'cajero'];

    protected $table = 'turnos';

    protected $primaryKey = 'idTurno';

    protected $fillable = ['idUsuario', 'fecha_inicio', 'fecha_fin', 'estatus'];

    protected $attributes = ['estatus' => self::ABIERTO];

    protected function casts(): array
    {
        return [
            'idTurno' => 'integer',
            'estatus' => 'integer',
            'fecha_inicio' => 'datetime',
            'fecha_fin' => 'datetime',
            'creado_en' => 'datetime',
            'actualizado_en' => 'datetime',
        ];
    }

    /** Turno abierto actual, o null. */
    public static function actual(): ?self
    {
        return static::where('estatus', self::ABIERTO)->first();
    }

    /** Devuelve el turno abierto; si no hay, lo abre a nombre de ese usuario de caja. */
    public static function iniciar(Usuario $usuario): self
    {
        if (! in_array($usuario->rol, self::ROLES_CAJA, true)) {
            throw new InvalidArgumentException('Solo un administrador o cajero inicia el turno de caja.');
        }

        // Bloquea el turno abierto (si lo hay) para que dos cajas no abran dos turnos al mismo tiempo.
        return DB::transaction(fn () => static::where('estatus', self::ABIERTO)->lockForUpdate()->first()
            ?? static::create(['idUsuario' => $usuario->id, 'fecha_inicio' => now(), 'estatus' => self::ABIERTO]));
    }

    public function cerrar(): void
    {
        $this->update(['fecha_fin' => now(), 'estatus' => self::CERRADO]);
        $this->sesionesTablet()->whereNull('cerrada_en')->update(['cerrada_en' => now()]);
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'idUsuario');
    }

    public function sesionesTablet(): HasMany
    {
        return $this->hasMany(SesionTablet::class, 'turno_id', 'idTurno');
    }

    /** Órdenes registradas en el turno (orden.idTurno). */
    public function ordenes(): HasMany
    {
        return $this->hasMany(Orden::class, 'idTurno', 'idTurno');
    }
}
