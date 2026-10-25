# Actualización pequeña para la PC que ya tiene las impresoras instaladas. Conserva drivers y asignaciones.
param([string]$Destino = 'C:\SoftRestaurante', [switch]$SinReiniciar)
$ErrorActionPreference = 'Stop'
$Destino = [IO.Path]::GetFullPath($Destino)
$carpetaAgente = Join-Path $Destino 'agente'
if (-not (Test-Path -LiteralPath (Join-Path $Destino '.env')) -or
    -not (Test-Path -LiteralPath (Join-Path $carpetaAgente 'agente.mjs'))) {
    throw 'Ejecuta esta actualizacion en la computadora donde ya esta instalado SOFT RESTAURANTE para las impresoras.'
}
$asignaciones = Join-Path $carpetaAgente 'data\asignaciones.json'
$antes = if (Test-Path -LiteralPath $asignaciones) { (Get-FileHash -LiteralPath $asignaciones).Hash } else { $null }
$archivos = @('conexionServidor.mjs', 'agente-siempre.ps1', 'reconectar.ps1')
foreach ($archivo in $archivos) {
    if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot $archivo))) { throw "Falta $archivo en el paquete de actualizacion." }
}
$respaldo = Join-Path $carpetaAgente ('respaldo-conexion-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $respaldo -Force | Out-Null
foreach ($archivo in $archivos) {
    $destinoArchivo = Join-Path $carpetaAgente $archivo
    if (Test-Path -LiteralPath $destinoArchivo) { Copy-Item -LiteralPath $destinoArchivo -Destination $respaldo }
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $archivo) -Destination $destinoArchivo -Force
}
if ($antes -and (Get-FileHash -LiteralPath $asignaciones).Hash -ne $antes) { throw 'Las asignaciones cambiaron; revisa el archivo antes de continuar.' }
Write-Host 'Conexion actualizada. Las impresoras conservan sus drivers y asignaciones.'
if ($SinReiniciar) { return }
& (Join-Path $carpetaAgente 'reconectar.ps1') -SinVentana
exit $LASTEXITCODE
