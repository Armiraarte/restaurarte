<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Registro del cierre de un turno (tabla cierres_turno): corte hecho en caja o cierre automático
 * a la medianoche si el turno se quedó abierto. Guarda lo vendido al cerrarlo.
 */
class CierreTurno extends Model
{
    public const CREATED_AT = 'creado_en';

    public const UPDATED_AT = 'actualizado_en';

    /** cierres_turno.tipo */
    public const CORTE = 'corte';

    public const AUTOMATICO = 'automatico';

    protected $table = 'cierres_turno';

    protected $fillable = ['turno_id', 'tipo', 'usuario_id', 'cerrado_en', 'ordenes_cobradas', 'total_vendido', 'ordenes_pendientes'];

    protected function casts(): array
    {
        return [
            'turno_id' => 'integer',
            'cerrado_en' => 'datetime',
            'ordenes_cobradas' => 'integer',
            'total_vendido' => 'decimal:2',
            'ordenes_pendientes' => 'integer',
            'creado_en' => 'datetime',
            'actualizado_en' => 'datetime',
        ];
    }

    public function turno(): BelongsTo
    {
        return $this->belongsTo(Turno::class, 'turno_id', 'idTurno');
    }

    /** Quién hizo el corte (null en el cierre automático). */
    public function usuario(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'usuario_id');
    }
}
