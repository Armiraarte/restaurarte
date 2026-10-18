# Registra la Axiohm USB con el controlador x64 firmado que incluye Windows.
# Los tickets del proyecto se envian en RAW con los comandos de la impresora.
$ErrorActionPreference = 'Stop'
$resultado = Join-Path (Split-Path $PSScriptRoot -Parent) '.tools\axiohm-install-result.local.json'
New-Item -ItemType Directory -Path (Split-Path $resultado -Parent) -Force | Out-Null

try {
    $identidad = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identidad)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Ejecuta este archivo como administrador para registrar el controlador de impresion.'
    }

    $dispositivo = @(Get-PnpDevice -PresentOnly | Where-Object {
        $_.InstanceId -like 'USB\VID_05D9&PID_A000\*' -and $_.Status -eq 'OK'
    })
    if ($dispositivo.Count -ne 1) { throw 'Conecta y enciende una sola Axiohm APOS Premium por USB.' }

    $puertos = @(Get-ChildItem -LiteralPath 'HKLM:\SYSTEM\CurrentControlSet\Control\Print\Monitors\USB Monitor\Ports' |
        Where-Object { (Get-ItemProperty -LiteralPath $_.PSPath).'Device Id' -eq $dispositivo[0].InstanceId })
    if ($puertos.Count -ne 1) { throw 'No se pudo identificar el puerto USB de la Axiohm.' }
    $puerto = $puertos[0].PSChildName
    $nombre = 'Axiohm APOS2101'
    $driver = 'Generic / Text Only'

    if (-not (Get-PrinterDriver -Name $driver -ErrorAction SilentlyContinue)) {
        $inf = @(Get-ChildItem -Path "$env:windir\System32\DriverStore\FileRepository\prnge001.inf_amd64_*\prnge001.inf")
        if ($inf.Count -lt 1) { throw 'No se encontro el controlador generico x64 de Microsoft en Windows.' }
        Add-PrinterDriver -Name $driver -InfPath $inf[0].FullName -PrinterEnvironment 'Windows x64'
    }

    $existente = Get-Printer -Name $nombre -ErrorAction SilentlyContinue
    if ($existente) {
        if ($existente.DriverName -ne $driver -or $existente.PortName -ne $puerto) {
            throw 'Ya existe una cola Axiohm APOS2101 con otra configuracion; revisala antes de modificarla.'
        }
    } else {
        Add-Printer -Name $nombre -DriverName $driver -PortName $puerto -PrintProcessor 'winprint'
    }
    Set-Printer -Name $nombre -Comment 'AXIOHM APOS PREMIUM USB: tickets ESC/POS RAW de SOFT RESTAURANTE'
    $impresora = Get-Printer -Name $nombre
    @{ ok = $true; nombre = $impresora.Name; driver = $impresora.DriverName; puerto = $impresora.PortName } |
        ConvertTo-Json | Set-Content -LiteralPath $resultado -Encoding UTF8
} catch {
    @{ ok = $false; error = $_.Exception.Message } | ConvertTo-Json |
        Set-Content -LiteralPath $resultado -Encoding UTF8
    Write-Error $_
    exit 1
}
