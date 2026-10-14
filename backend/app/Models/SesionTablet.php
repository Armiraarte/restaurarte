<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use RuntimeException;

/** Sesión de una tablet dentro del turno de caja: se abre al iniciar sesión la tablet. */
class SesionTablet extends Model
{
    public const CREATED_AT = 'creado_en';

    public const UPDATED_AT = 'actualizado_en';

    protected $table = 'sesiones_tablet';

    protected $fillable = ['turno_id', 'tablet_id', 'usuario_id', 'iniciada_en', 'cerrada_en'];

    protected $hidden = ['tablet_abierta'];

    protected function casts(): array
    {
        return [
            'iniciada_en' => 'datetime',
            'cerrada_en' => 'datetime',
            'creado_en' => 'datetime',
            'actualizado_en' => 'datetime',
        ];
    }

    /**
     * Sesión abierta de la tablet en el turno actual. Si tenía una de un turno anterior, la cierra.
     * Requiere que la caja haya iniciado turno.
     */
    public static function iniciar(Tablet $tablet): self
    {
        $turno = Turno::actual() ?? throw new RuntimeException('La caja no ha iniciado turno.');

        $abierta = static::where('tablet_id', $tablet->id)->whereNull('cerrada_en')->first();
        if ($abierta && $abierta->turno_id === $turno->idTurno) {
            return $abierta;
        }
        $abierta?->update(['cerrada_en' => now()]);

        return static::create([
            'turno_id' => $turno->idTurno,
            'tablet_id' => $tablet->id,
            'usuario_id' => $tablet->usuario_id,
            'iniciada_en' => now(),
        ]);
    }

    public function turno(): BelongsTo
    {
        return $this->belongsTo(Turno::class, 'turno_id', 'idTurno');
    }

    public function tablet(): BelongsTo
    {
        return $this->belongsTo(Tablet::class, 'tablet_id');
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'usuario_id');
    }

    /** Órdenes registradas desde esta sesión (orden.idSesion_tablet). */
    public function ordenes(): HasMany
    {
        return $this->hasMany(Orden::class, 'idSesion_tablet');
    }
}
