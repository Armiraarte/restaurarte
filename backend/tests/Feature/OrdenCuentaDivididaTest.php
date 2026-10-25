<?php

namespace Tests\Feature;

use App\Models\Orden;
use App\Models\OrdenCuentaDividida;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrdenCuentaDivididaTest extends TestCase
{
    use RefreshDatabase;

    private function cuenta(Orden $orden, int $numero, array $datos = []): OrdenCuentaDividida
    {
        return OrdenCuentaDividida::create([
            'idOrden' => $orden->idOrden, 'numero' => $numero, 'personas' => 2, 'modo' => 'iguales',
            'importe' => '50.00', 'total_orden' => '100.00', 'creado_por' => 'Tablet 01', ...$datos,
        ]);
    }

    public function test_guarda_cada_persona_como_cuenta_numerada_de_la_orden_sin_cambiar_su_total(): void
    {
        $orden = Orden::create(['nombre' => '4']);
        $this->cuenta($orden, 2, ['modo' => 'productos', 'importe' => '30.00', 'contenido' => [
            'productos' => [['cantidad' => 1, 'nombre' => 'Bebidas Coca-Cola', 'importe' => 30]], 'extras' => [],
        ]]);
        $this->cuenta($orden, 1, ['modo' => 'productos', 'importe' => '70.00']);

        $cuentas = $orden->fresh()->cuentasDivididas;
        $this->assertSame([1, 2], $cuentas->pluck('numero')->all());
        $this->assertSame('30.00', $cuentas[1]->importe);
        $this->assertSame('Bebidas Coca-Cola', $cuentas[1]->contenido['productos'][0]['nombre']);
        $this->assertNull($cuentas[0]->contenido);
        $this->assertSame('0.00', $orden->fresh()->total);
    }

    public function test_no_repite_el_numero_de_cuenta_y_se_borra_con_la_orden(): void
    {
        $orden = Orden::create(['nombre' => '5']);
        $this->cuenta($orden, 1);
        try {
            $this->cuenta($orden, 1);
            $this->fail('Una orden no puede tener dos veces la Cuenta 1.');
        } catch (QueryException) {
            $this->addToAssertionCount(1);
        }
        $orden->delete();
        $this->assertSame(0, OrdenCuentaDividida::count());
    }
}
