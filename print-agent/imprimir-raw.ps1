# Conserva el mismo diseno de tickets y lo envia como imagen ESC/POS a la Axiohm.
param(
    [Parameter(Mandatory)] [string]$Archivo,
    [string]$SalidaRaw,
    [string]$VistaPrevia
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Drawing
Add-Type -Path (Join-Path $PSScriptRoot 'escpos.cs') -ReferencedAssemblies System.Drawing
. (Join-Path $PSScriptRoot 'dibujar-ticket.ps1')

$ticket = Get-Content -Raw -Encoding UTF8 -LiteralPath $Archivo | ConvertFrom-Json
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
    if ($VistaPrevia) { $imagen.Save($VistaPrevia, [System.Drawing.Imaging.ImageFormat]::Png) }
    $bytes = [EscPosRaw]::Encode($imagen)
} finally { $imagen.Dispose() }

if ($SalidaRaw) {
    [System.IO.File]::WriteAllBytes($SalidaRaw, $bytes)
    @{ exportado = $true; bytes = $bytes.Length; ancho = 576; alto = $alto } | ConvertTo-Json -Compress
} else {
    if ([string]$ticket.impresora -notmatch '(?i)axiohm|apos') { throw 'Selecciona la cola Axiohm para este modo de impresion.' }
    $trabajo = [EscPosRaw]::Send([string]$ticket.impresora, $bytes)
    @{ ok = $true; impresora = $ticket.impresora; trabajo = $trabajo; bytes = $bytes.Length } | ConvertTo-Json -Compress
}
