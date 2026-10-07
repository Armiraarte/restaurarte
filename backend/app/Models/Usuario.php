<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Support\Str;

class Usuario extends Authenticatable
{
    public const CREATED_AT = 'creado_en';

    public const UPDATED_AT = 'actualizado_en';

    protected $table = 'usuarios';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id', 'usuario', 'nombre', 'rol', 'password_hash', 'acceso', 'activo',
    ];

    protected $hidden = ['password_hash'];

    protected function casts(): array
    {
        return [
            'password_hash' => 'hashed',
            'activo' => 'boolean',
            'creado_en' => 'datetime',
            'actualizado_en' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Usuario $usuario): void {
            if (! $usuario->getKey()) {
                $usuario->id = 'u-'.Str::uuid();
            }
        });
    }

    protected function usuario(): Attribute
    {
        return Attribute::make(
            set: fn (string $valor) => strtolower(trim($valor)),
        );
    }

    public function getAuthPasswordName(): string
    {
        return 'password_hash';
    }

    /** Tablet vinculada a esta cuenta (solo para usuarios con rol "tablet"). */
    public function tablet(): HasOne
    {
        return $this->hasOne(Tablet::class, 'usuario_id');
    }

    /** Tablets que este administrador dio de alta. */
    public function tabletsRegistradas(): HasMany
    {
        return $this->hasMany(Tablet::class, 'creado_por');
    }
}
