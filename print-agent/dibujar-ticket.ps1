# Dibuja las mismas líneas en la impresora o en una imagen de vista previa.
function Dibujar-Ticket {
  param(
    [Parameter(Mandatory)] [System.Drawing.Graphics]$Graphics,
    [Parameter(Mandatory)] $Ticket
  )

  $g = $Graphics
  $g.PageUnit = [System.Drawing.GraphicsUnit]::Millimeter
  $ancho = [single]$Ticket.anchoMm
  $x = [single]2
  $util = $ancho - 4
  $y = [single]2

  $fuente = New-Object System.Drawing.Font('Consolas', 9)
  $fuenteNegrita = New-Object System.Drawing.Font('Consolas', 9, [System.Drawing.FontStyle]::Bold)
  $fuenteGrande = New-Object System.Drawing.Font('Consolas', 13, [System.Drawing.FontStyle]::Bold)
  $fuentePequena = New-Object System.Drawing.Font('Arial', 6)
  $izq = New-Object System.Drawing.StringFormat
  $centro = New-Object System.Drawing.StringFormat
  $centro.Alignment = [System.Drawing.StringAlignment]::Center
  $der = New-Object System.Drawing.StringFormat
  $der.Alignment = [System.Drawing.StringAlignment]::Far
  $pluma = New-Object System.Drawing.Pen([System.Drawing.Color]::Black, [single]0.3)
  $pluma.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash

  try {
    foreach ($l in $Ticket.lineas) {
      if ($l.imagen) {
        if ($l.imagen -ne 'logo-completo') { throw 'Imagen de ticket desconocida.' }
        $imagen = [System.Drawing.Image]::FromFile((Join-Path $PSScriptRoot 'assets\logo-completo.jpg'))
        try {
          # Solo se omiten márgenes blancos del archivo; se conserva todo el logo.
          $origen = New-Object System.Drawing.RectangleF(0, 140, 800, 312)
          $anchoLogo = if ($l.anchoMm) { [Math]::Min([single]$l.anchoMm, $util) } else { [Math]::Min(50, $util) }
          if ($anchoLogo -le 0) { throw 'El ancho del logo debe ser mayor a cero.' }
          $altoLogo = [single]($anchoLogo * $origen.Height / $origen.Width)
          $logoX = switch ($l.alinear) {
            'derecha' { $x + $util - $anchoLogo }
            'izquierda' { $x }
            default { $x + ($util - $anchoLogo) / 2 }
          }
          $destino = New-Object System.Drawing.RectangleF($logoX, $y, $anchoLogo, $altoLogo)
          $g.DrawImage($imagen, $destino, $origen, [System.Drawing.GraphicsUnit]::Pixel)
          $y += $altoLogo + 1
        } finally {
          $imagen.Dispose()
        }
        continue
      }

      if ($l.separador) {
        $y += 1.5
        $g.DrawLine($pluma, $x, $y, $x + $util, $y)
        $y += 1.5
        continue
      }

      $f = if ($l.grande) { $fuenteGrande } elseif ($l.pequeno) { $fuentePequena } elseif ($l.negrita) { $fuenteNegrita } else { $fuente }
      # escala: misma fuente con la letra más grande (1.5 = 50% más). Se libera al terminar la línea.
      $fuenteEscalada = $null
      if ($l.escala -and [single]$l.escala -ne 1) {
        $fuenteEscalada = New-Object System.Drawing.Font($f.FontFamily, [single]($f.Size * [single]$l.escala), $f.Style)
        $f = $fuenteEscalada
      }
      $texto = [string]$l.texto
      $formato = switch ($l.alinear) { 'centro' { $centro } 'derecha' { $der } default { $izq } }
      $anchoTexto = $util
      if ($l.derecha) {
        $medida = $g.MeasureString([string]$l.derecha, $f)
        $g.DrawString([string]$l.derecha, $f, [System.Drawing.Brushes]::Black, (New-Object System.Drawing.RectangleF($x, $y, $util, 100)), $der)
        $anchoTexto = $util - $medida.Width - 1
      }
      $rect = New-Object System.Drawing.RectangleF($x, $y, $anchoTexto, 1000)
      $alto = $g.MeasureString($texto, $f, (New-Object System.Drawing.SizeF($anchoTexto, 1000)), $formato).Height
      if (-not $texto) { $alto = $f.GetHeight($g) }
      $g.DrawString($texto, $f, [System.Drawing.Brushes]::Black, $rect, $formato)
      $y += [Math]::Max($alto, $f.GetHeight($g))
      if ($fuenteEscalada) { $fuenteEscalada.Dispose() }
    }
    return $y
  } finally {
    $fuente.Dispose()
    $fuenteNegrita.Dispose()
    $fuenteGrande.Dispose()
    $fuentePequena.Dispose()
    $izq.Dispose()
    $centro.Dispose()
    $der.Dispose()
    $pluma.Dispose()
  }
}
