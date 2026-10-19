# Verifica raster, avance/corte y el largo del driver sin enviar trabajos a la impresora.
param(
  [Parameter(Mandatory)] [string]$Archivo,
  [Parameter(Mandatory)] [string]$VistaPrevia,
  [string]$ImpresoraDriver = 'Star TSP100 Cutter (TSP143)'
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -Path (Join-Path $PSScriptRoot '..\escpos.cs') -ReferencedAssemblies System.Drawing
. (Join-Path $PSScriptRoot '..\dibujar-ticket.ps1')
$ticket = Get-Content -Raw -Encoding UTF8 -LiteralPath $Archivo | ConvertFrom-Json
$medida = New-Object System.Drawing.Bitmap(576, 1)
try {
  $medida.SetResolution(203.2, 203.2)
  $g = [System.Drawing.Graphics]::FromImage($medida)
  try { $altoMm = Dibujar-Ticket -Graphics $g -Ticket $ticket } finally { $g.Dispose() }
} finally { $medida.Dispose() }
$alto = [int][Math]::Ceiling(($altoMm + 2) * 8)
$imagen = New-Object System.Drawing.Bitmap(576, $alto)
try {
  $imagen.SetResolution(203.2, 203.2)
  $g = [System.Drawing.Graphics]::FromImage($imagen)
  try {
    $g.Clear([System.Drawing.Color]::White)
    [void](Dibujar-Ticket -Graphics $g -Ticket $ticket)
  } finally { $g.Dispose() }
  $imagen.Save($VistaPrevia, [System.Drawing.Imaging.ImageFormat]::Png)
  $bytes = [EscPosRaw]::Encode($imagen)
  $final = [BitConverter]::ToString($bytes, $bytes.Length - 7)
  if ($final -ne '1B-32-0A-1D-56-42-00') { throw 'El avance antes del corte debe ser de una sola linea.' }
  $ultimaTinta = -1
  for ($y = $alto - 1; $y -ge 0 -and $ultimaTinta -eq -1; $y--) {
    for ($x = 0; $x -lt 576; $x++) {
      if ($imagen.GetPixel($x, $y).GetBrightness() -lt 0.8) { $ultimaTinta = $y; break }
    }
  }
  $blancoFinalMm = ($alto - 1 - $ultimaTinta) / 8
  if ($ultimaTinta -lt 0 -or $blancoFinalMm -gt 10) { throw "Margen en blanco excesivo: $blancoFinalMm mm." }
} finally { $imagen.Dispose() }

$doc = New-Object System.Drawing.Printing.PrintDocument
try {
  $doc.PrinterSettings.PrinterName = $ImpresoraDriver
  if (-not $doc.PrinterSettings.IsValid) { throw 'No se encontro la impresora de Windows para validar el papel.' }
  $altoAnterior = $doc.DefaultPageSettings.PaperSize.Height
  Ajustar-PaginaTicket -Documento $doc -Ticket $ticket
  $altoPapelMm = $doc.DefaultPageSettings.PaperSize.Height * 25.4 / 100
  # El calculo usa las metricas del driver: admite diferencias pequenas frente al raster de 203.2 dpi.
  if ([Math]::Abs($altoPapelMm - $altoMm - 2) -gt 3) { throw 'El papel del driver no coincide con el contenido.' }
  # PreviewPrintController genera una pagina en memoria, sin pasar por la cola fisica.
  $preview = New-Object System.Drawing.Printing.PreviewPrintController
  $doc.PrintController = $preview
  $doc.add_PrintPage({
    param($sender, $e)
    [void](Dibujar-Ticket -Graphics $e.Graphics -Ticket $ticket)
    $e.HasMorePages = $false
  })
  $doc.Print()
  $paginas = $preview.GetPreviewPageInfo()
  try {
    if ($paginas.Length -ne 1) { throw 'La vista previa debe tener una sola pagina.' }
    if ($paginas[0].PhysicalSize.Height -ne $doc.DefaultPageSettings.PaperSize.Height) { throw 'El driver ignoro el largo ajustado.' }
  } finally { foreach ($pagina in $paginas) { $pagina.Image.Dispose() } }
  @{ ok = $true; impreso = $false; contenidoMm = [Math]::Round($altoMm, 2); papelMm = [Math]::Round($altoPapelMm, 2); blancoFinalMm = $blancoFinalMm; altoAnteriorMm = [Math]::Round($altoAnterior * 25.4 / 100, 2); avanceFinal = $final } | ConvertTo-Json -Compress
} finally { $doc.Dispose() }
