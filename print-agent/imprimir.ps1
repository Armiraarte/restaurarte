# Imprime un ticket a través del driver de Windows (sirve para impresoras raster como la Star TSP143).
# Uso: imprimir.ps1 -Archivo ticket.json
#   Las líneas admiten texto, derecha, alinear, negrita, grande, pequeno y separador;
#   una línea { "imagen": "logo-completo", "anchoMm": 50 } dibuja el logo del negocio.
param([Parameter(Mandatory)] [string]$Archivo)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
. (Join-Path $PSScriptRoot 'dibujar-ticket.ps1')

$ticket = Get-Content -Raw -Encoding UTF8 $Archivo | ConvertFrom-Json

$doc = New-Object System.Drawing.Printing.PrintDocument
$doc.PrinterSettings.PrinterName = $ticket.impresora
if (-not $doc.PrinterSettings.IsValid) { throw "La impresora '$($ticket.impresora)' no existe en Windows." }
$doc.DocumentName = 'Ticket Los Diablitos'
$doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
$doc.OriginAtMargins = $false

$doc.add_PrintPage({
  param($sender, $e)
  [void](Dibujar-Ticket -Graphics $e.Graphics -Ticket $ticket)
  $e.HasMorePages = $false
})

try {
  $doc.Print()
} finally {
  $doc.Dispose()
}
Write-Output 'ok'
