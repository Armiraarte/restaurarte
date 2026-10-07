# Imprime un ticket a través del driver de Windows (sirve para impresoras raster como la Star TSP143).
# Uso: imprimir.ps1 -Archivo ticket.json
#   { "impresora": "...", "anchoMm": 72, "lineas": [ { "texto": "...", "derecha": "...", "alinear": "centro", "negrita": true, "grande": true, "separador": true } ] }
param([Parameter(Mandatory)] [string]$Archivo)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$ticket = Get-Content -Raw -Encoding UTF8 $Archivo | ConvertFrom-Json

$doc = New-Object System.Drawing.Printing.PrintDocument
$doc.PrinterSettings.PrinterName = $ticket.impresora
if (-not $doc.PrinterSettings.IsValid) { throw "La impresora '$($ticket.impresora)' no existe en Windows." }
$doc.DocumentName = 'Ticket RESTAURARTE'
$doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
$doc.OriginAtMargins = $false

$fuente        = New-Object System.Drawing.Font('Consolas', 9)
$fuenteNegrita = New-Object System.Drawing.Font('Consolas', 9, [System.Drawing.FontStyle]::Bold)
$fuenteGrande  = New-Object System.Drawing.Font('Consolas', 13, [System.Drawing.FontStyle]::Bold)

$doc.add_PrintPage({
  param($sender, $e)
  $g = $e.Graphics
  $g.PageUnit = [System.Drawing.GraphicsUnit]::Millimeter
  $ancho = [single]$ticket.anchoMm
  $x = [single]2
  $util = $ancho - 4
  $y = [single]2

  $izq = New-Object System.Drawing.StringFormat
  $centro = New-Object System.Drawing.StringFormat
  $centro.Alignment = [System.Drawing.StringAlignment]::Center
  $der = New-Object System.Drawing.StringFormat
  $der.Alignment = [System.Drawing.StringAlignment]::Far

  foreach ($l in $ticket.lineas) {
    if ($l.separador) {
      $pluma = New-Object System.Drawing.Pen([System.Drawing.Color]::Black, [single]0.3)
      $pluma.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
      $y += 1.5
      $g.DrawLine($pluma, $x, $y, $x + $util, $y)
      $y += 1.5
      continue
    }

    $f = if ($l.grande) { $fuenteGrande } elseif ($l.negrita) { $fuenteNegrita } else { $fuente }
    $texto = [string]$l.texto
    $formato = switch ($l.alinear) { 'centro' { $centro } 'derecha' { $der } default { $izq } }
    $ancho_texto = $util
    if ($l.derecha) {
      # Columna derecha (importes): se dibuja aparte y el texto izquierdo deja espacio.
      $medida = $g.MeasureString([string]$l.derecha, $f)
      $g.DrawString([string]$l.derecha, $f, [System.Drawing.Brushes]::Black, (New-Object System.Drawing.RectangleF($x, $y, $util, 100)), $der)
      $ancho_texto = $util - $medida.Width - 1
    }
    $rect = New-Object System.Drawing.RectangleF($x, $y, $ancho_texto, 1000)
    $alto = $g.MeasureString($texto, $f, (New-Object System.Drawing.SizeF($ancho_texto, 1000)), $formato).Height
    if (-not $texto) { $alto = $f.GetHeight($g) }
    $g.DrawString($texto, $f, [System.Drawing.Brushes]::Black, $rect, $formato)
    $y += [Math]::Max($alto, $f.GetHeight($g))
  }
  $e.HasMorePages = $false
})

$doc.Print()
Write-Output 'ok'
