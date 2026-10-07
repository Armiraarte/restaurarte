<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use InvalidArgumentException;

class Tablet extends Model
{
    public const CREATED_AT = 'creado_en';

    public const UPDATED_AT = 'actualizado_en';

    protected $table = 'tablets';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id', 'usuario_id', 'creado_por', 'numero', 'nombre', 'ubicacion', 'mesero',
        'sesion_iniciada_en', 'ultima_conexion', 'ip', 'activa',
    ];

    protected function casts(): array
    {
        return [
            'activa' => 'boolean',
            'sesion_iniciada_en' => 'datetime',
            'ultima_conexion' => 'datetime',
            'creado_en' => 'datetime',
            'actualizado_en' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (Tablet $tablet): void {
            $tablet->numero = str_pad(trim((string) $tablet->numero), 2, '0', STR_PAD_LEFT);

            if (! $tablet->getKey()) {
                $tablet->id = 'tablet-'.$tablet->numero;
            }
            if (trim((string) $tablet->nombre) === '') {
                $tablet->nombre = 'TABLET '.$tablet->numero;
            }

            // La cuenta vinculada debe ser de tipo tablet.
            if ($tablet->isDirty('usuario_id')) {
                $rol = Usuario::whereKey($tablet->usuario_id)->value('rol');
                if ($rol !== 'tablet') {
                    throw new InvalidArgumentException('La tablet debe vincularse a un usuario con rol "tablet".');
                }
            }

            // Solo un administrador da de alta tablets.
            if ($tablet->isDirty('creado_por')) {
                $rol = Usuario::whereKey($tablet->creado_por)->value('rol');
                if ($rol !== 'admin') {
                    throw new InvalidArgumentException('La tablet debe registrarla un usuario con rol "admin".');
                }
            }
        });
    }

    /** Cuenta (usuario y contraseña/PIN) con la que inicia sesión esta tablet. */
    public function usuario(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'usuario_id');
    }

    /** Administrador que dio de alta la tablet. */
    public function creadoPor(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'creado_por');
    }
}
