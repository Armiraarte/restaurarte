<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
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
        return DB::transaction(function () use ($usuario): self {
            $abierto = static::where('estatus', self::ABIERTO)->lockForUpdate()->first();
            if ($abierto) {
                return $abierto;
            }
            $turno = static::create(['idUsuario' => $usuario->id, 'fecha_inicio' => now(), 'estatus' => self::ABIERTO]);
            // Órdenes sin cobrar de un turno que se cerró solo (nadie hizo el corte): pasan a este turno para cobrarlas.
            Orden::whereIn('idTurno', CierreTurno::where('tipo', CierreTurno::AUTOMATICO)->select('turno_id'))
                ->where(fn ($q) => $q->where('estatus', Orden::PAGANDO)->orWhere(fn ($q) => $q->where('estatus', Orden::ABIERTA)->where('total', '>', 0)))
                ->update(['idTurno' => $turno->idTurno]);

            return $turno;
        });
    }

    /**
     * Cierra el turno y guarda su registro (cierres_turno) con lo vendido y lo que quedó sin cobrar.
     * Con usuario es el corte de caja; sin usuario, el cierre automático (fin = la medianoche).
     */
    public function cerrar(?Usuario $quien = null, ?\DateTimeInterface $fin = null): CierreTurno
    {
        return DB::transaction(function () use ($quien, $fin): CierreTurno {
            $fin ??= now();
            $ordenes = $this->ordenes()->get(['estatus', 'total']);
            $cobradas = $ordenes->where('estatus', 2);
            $cierre = CierreTurno::create([
                'turno_id' => $this->idTurno,
                'tipo' => $quien ? CierreTurno::CORTE : CierreTurno::AUTOMATICO,
                'usuario_id' => $quien?->id,
                'cerrado_en' => $fin,
                'ordenes_cobradas' => $cobradas->count(),
                'total_vendido' => number_format((float) $cobradas->sum('total'), 2, '.', ''),
                'ordenes_pendientes' => $ordenes->filter(fn ($o) => $o->estatus === 1 || ($o->estatus === 0 && (float) $o->total > 0))->count(),
            ]);
            $this->update(['fecha_fin' => $fin, 'estatus' => self::CERRADO]);
            $this->sesionesTablet()->whereNull('cerrada_en')->update(['cerrada_en' => $fin]);

            return $cierre;
        });
    }

    /** Registro de su cierre (null mientras está abierto). */
    public function cierre(): HasOne
    {
        return $this->hasOne(CierreTurno::class, 'turno_id', 'idTurno');
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
