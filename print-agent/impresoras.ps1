# Lista las impresoras de Windows en JSON e indica si su dispositivo USB está conectado.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Normalizar([string]$s) { ($s -replace '\s', '').ToLowerInvariant() }

$puertos = @{}
foreach ($p in Get-PrinterPort) { $puertos[$p.Name] = $p.Description }

$dispositivos = @(Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue |
  Where-Object { $_.Status -eq 'OK' -and $_.FriendlyName } |
  ForEach-Object { Normalizar $_.FriendlyName })

$resultado = foreach ($imp in Get-CimInstance Win32_Printer) {
  $esUsb = $imp.PortName -like 'USB*'
  $conectada = -not $imp.WorkOffline
  if ($esUsb) {
    # El puerto USB guarda el nombre del dispositivo; si ese dispositivo no está presente, está desconectada.
    $desc = $puertos[$imp.PortName]
    $conectada = $conectada -and [bool]$desc -and ($dispositivos -contains (Normalizar $desc))
  }
  [pscustomobject]@{
    nombre        = $imp.Name
    driver        = $imp.DriverName
    puerto        = $imp.PortName
    usb           = $esUsb
    conectada     = $conectada
    predeterminada = [bool]$imp.Default
  }
}

ConvertTo-Json -InputObject @($resultado) -Compress
