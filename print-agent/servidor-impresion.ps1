# Proceso de impresion que se queda abierto (lo arranca agente.mjs, uno por impresora).
# Antes cada ticket abria un PowerShell nuevo, cargaba System.Drawing y compilaba escpos.cs: varios segundos
# por ticket. Aqui eso se hace una sola vez al arrancar y cada ticket solo se dibuja y se envia.
#
# Entrada (una linea JSON por trabajo):  { "id": 1, "modo": "raw" | "driver", "ticket": { impresora, anchoMm, lineas },
#                                          "salidaRaw": "ruta opcional (no imprime, guarda los bytes)" }
# Salida (una linea JSON por trabajo):   { "id": 1, "ok": true } o { "id": 1, "ok": false, "error": "..." }
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Drawing
Add-Type -Path (Join-Path $PSScriptRoot 'escpos.cs') -ReferencedAssemblies System.Drawing
. (Join-Path $PSScriptRoot 'dibujar-ticket.ps1')

# Axiohm (cocina): el ticket se dibuja como imagen y se manda en ESC/POS (mismo diseno que imprimir-raw.ps1).
function Imprimir-Raw($ticket, [string]$salidaRaw) {
    if (-not $ticket.lineas -or [single]$ticket.anchoMm -ne 72) { throw 'La Axiohm requiere un ticket de 72 mm de ancho imprimible.' }
    $medida = New-Object System.Drawing.Bitmap(576, 1)
    try {
        $medida.SetResolution(203.2, 203.2)
        $graphics = [System.Drawing.Graphics]::FromImage($medida)
        try { $altoMm = Dibujar-Ticket -Graphics $graphics -Ticket $ticket } finally { $graphics.Dispose() }
    } finally { $medida.Dispose() }
    $alto = [int][Math]::Ceiling(([single]$altoMm + 2) * 8)
    if ($alto -lt 1 -or $alto -gt 20000) { throw 'El ticket excede el largo permitido.' }

    $imagen = New-Object System.Drawing.Bitmap(576, $alto)
    try {
        $imagen.SetResolution(203.2, 203.2)
        $graphics = [System.Drawing.Graphics]::FromImage($imagen)
        try {
            $graphics.Clear([System.Drawing.Color]::White)
            $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
            [void](Dibujar-Ticket -Graphics $graphics -Ticket $ticket)
        } finally { $graphics.Dispose() }
        $bytes = [EscPosRaw]::Encode($imagen)
    } finally { $imagen.Dispose() }

    if ($salidaRaw) {
        [System.IO.File]::WriteAllBytes($salidaRaw, $bytes)
        return
    }
    if ([string]$ticket.impresora -notmatch '(?i)axiohm|apos') { throw 'Selecciona la cola Axiohm para este modo de impresion.' }
    [void][EscPosRaw]::Send([string]$ticket.impresora, $bytes)
}

# Star y demas: por el driver de Windows (mismo diseno que imprimir.ps1).
function Imprimir-Driver($ticket) {
    $doc = New-Object System.Drawing.Printing.PrintDocument
    try {
        $doc.PrinterSettings.PrinterName = $ticket.impresora
        if (-not $doc.PrinterSettings.IsValid) { throw "La impresora '$($ticket.impresora)' no existe en Windows." }
        $doc.DocumentName = 'Ticket Los Diablitos'
        Ajustar-PaginaTicket -Documento $doc -Ticket $ticket
        $doc.add_PrintPage({
            param($sender, $e)
            [void](Dibujar-Ticket -Graphics $e.Graphics -Ticket $ticket)
            $e.HasMorePages = $false
        })
        $doc.Print()
    } finally {
        $doc.Dispose()
    }
}

function Responder($datos) {
    [Console]::Out.WriteLine(($datos | ConvertTo-Json -Compress))
    [Console]::Out.Flush()
}

# Listo: agente.mjs espera esta linea antes de mandar trabajos.
Responder @{ listo = $true }

while ($true) {
    $linea = [Console]::In.ReadLine()
    if ($null -eq $linea) { break } # el agente cerro la entrada: termina
    if (-not $linea.Trim()) { continue }
    $id = $null
    try {
        $trabajo = $linea | ConvertFrom-Json
        $id = $trabajo.id
        if ($trabajo.modo -eq 'raw') { Imprimir-Raw $trabajo.ticket ([string]$trabajo.salidaRaw) }
        else { Imprimir-Driver $trabajo.ticket }
        Responder @{ id = $id; ok = $true }
    } catch {
        Responder @{ id = $id; ok = $false; error = $_.Exception.Message }
    }
}
