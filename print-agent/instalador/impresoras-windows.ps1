# Deja instaladas en Windows las impresoras de tickets de SOFT RESTAURANTE (Windows 10/11 de 64 bits):
#   - Star TSP143 (TSP100) de cocina: driver de Star de la carpeta Star-TSP143 (firmado por Microsoft). Con el
#     driver instalado, Windows crea la impresora solo en cuanto se conecta.
#   - Axiohm APOS2101 de caja: usa "Generic / Text Only", que ya trae Windows; se registra en su puerto USB.
# Lo usa el instalador y, con -Silencioso, una tarea de Windows cada 5 minutos: si conectan una impresora después
# de instalar, aparece sola sin volver a correr nada. Necesita permisos de administrador.
param([switch]$Silencioso)
$ErrorActionPreference = 'Stop'

function Bien($texto) { if (-not $Silencioso) { Write-Host "   OK  $texto" -ForegroundColor Green } }
function Aviso($texto) { if (-not $Silencioso) { Write-Host "   !!  $texto" -ForegroundColor Yellow } }

$driverStar = 'Star TSP100 Cutter (TSP143)'
$driverAxiohm = 'Generic / Text Only'
$nombreAxiohm = 'Axiohm APOS2101'

# ---------- Star TSP143 (cocina) ----------
if (-not $Silencioso -or -not (Get-PrinterDriver -Name $driverStar -ErrorAction SilentlyContinue)) {
    $inf = Join-Path $PSScriptRoot 'Star-TSP143\smjt100.inf'
    $salida = & pnputil.exe /add-driver $inf /install 2>&1
    if ($LASTEXITCODE -notin 0, 259, 3010) { throw "No se pudo agregar el driver de Star (pnputil código $LASTEXITCODE): $salida" }
    if (-not (Get-PrinterDriver -Name $driverStar -ErrorAction SilentlyContinue)) { Add-PrinterDriver -Name $driverStar }
}
Bien "Driver de la Star listo: $driverStar"

$star = Get-Printer -ErrorAction SilentlyContinue | Where-Object { $_.DriverName -eq $driverStar } | Select-Object -First 1
if ($star) {
    Bien "Star lista: $($star.Name)"
} else {
    # Conectada pero sin impresora en Windows (pasa si se conectó antes de tener el driver): se crea en su puerto USB.
    $puertoStar = Get-PrinterPort | Where-Object { $_.Name -like 'USB*' -and $_.Description -match 'Star|TSP' } | Select-Object -First 1
    if ($puertoStar) {
        Add-Printer -Name $driverStar -DriverName $driverStar -PortName $puertoStar.Name
        Bien "Star creada: $driverStar ($($puertoStar.Name))"
    } else {
        Aviso 'La Star no está conectada: en cuanto la conecten y enciendan, Windows la agrega sola.'
    }
}

# ---------- Axiohm APOS2101 (caja) ----------
if (-not (Get-PrinterDriver -Name $driverAxiohm -ErrorAction SilentlyContinue)) {
    $inf = @(Get-ChildItem -Path "$env:windir\System32\DriverStore\FileRepository\prnge001.inf_amd64_*\prnge001.inf")
    if ($inf.Count -lt 1) { throw 'No se encontró el driver genérico de Windows (Generic / Text Only).' }
    Add-PrinterDriver -Name $driverAxiohm -InfPath $inf[0].FullName -PrinterEnvironment 'Windows x64'
}

if (Get-Printer -Name $nombreAxiohm -ErrorAction SilentlyContinue) {
    Bien "Axiohm lista: $nombreAxiohm"
} else {
    $dispositivo = @(Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue | Where-Object {
        $_.InstanceId -like 'USB\VID_05D9&PID_A000\*' -and $_.Status -eq 'OK'
    })
    $puerto = $null
    if ($dispositivo.Count -eq 1) {
        $puerto = Get-ChildItem -LiteralPath 'HKLM:\SYSTEM\CurrentControlSet\Control\Print\Monitors\USB Monitor\Ports' -ErrorAction SilentlyContinue |
            Where-Object { (Get-ItemProperty -LiteralPath $_.PSPath).'Device Id' -eq $dispositivo[0].InstanceId } |
            Select-Object -First 1 -ExpandProperty PSChildName
    }
    if ($puerto) {
        Add-Printer -Name $nombreAxiohm -DriverName $driverAxiohm -PortName $puerto -PrintProcessor 'winprint'
        Set-Printer -Name $nombreAxiohm -Comment 'AXIOHM APOS PREMIUM USB: tickets ESC/POS RAW de SOFT RESTAURANTE'
        Bien "Axiohm creada: $nombreAxiohm ($puerto)"
    } else {
        Aviso 'La Axiohm no está conectada: en cuanto la conecten y enciendan, aparece sola en unos minutos.'
    }
}
