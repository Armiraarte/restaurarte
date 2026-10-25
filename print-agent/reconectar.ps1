# "Reconectar impresoras" (icono del escritorio que deja el instalador): vuelve a conectar la impresion con
# SOFT RESTAURANTE sin apagar ni reiniciar la computadora. Cierra el programa de impresion (vigilante, agente y
# procesos de impresion), lo vuelve a abrir y espera a que el servidor lo vea; al final avisa en una ventana.
#   powershell -ExecutionPolicy Bypass -File C:\SoftRestaurante\agente\reconectar.ps1 [-SinVentana]
param([switch]$SinVentana)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.Windows.Forms

$agente = [IO.Path]::GetFullPath($PSScriptRoot)
$raiz = Split-Path $agente
$tarea = 'SOFT RESTAURANTE - agente de impresion'

function Avisar([string]$texto, [string]$icono) {
    if ($SinVentana) { Write-Output $texto; return }
    [void][System.Windows.Forms.MessageBox]::Show($texto, 'SOFT RESTAURANTE - Impresoras', 'OK', $icono)
}

# Servidor y token del agente (.env que deja el instalador junto a la carpeta del agente).
$config = @{}
$archivoEnv = Join-Path $raiz '.env'
if (Test-Path $archivoEnv) {
    foreach ($linea in Get-Content $archivoEnv) { if ($linea -match '^\s*([A-Z_]+)=(.*)$') { $config[$Matches[1]] = $Matches[2].Trim() } }
}
$servidor = "$($config.SERVIDOR_URL)".TrimEnd('/')
$token = $config.PRINT_AGENT_TOKEN

try {
    # 1. Cerrar el programa de impresión de esta carpeta.
    $procesos = @(Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='powershell.exe'" | Where-Object {
        $_.ProcessId -ne $PID -and $_.CommandLine -and -not $_.CommandLine.Contains('reconectar.ps1') -and
        ($_.CommandLine.Contains("$agente\") -or
         ($_.Name -eq 'node.exe' -and $_.CommandLine -match '(^|[\s"])agente\.mjs([\s"]|$)' -and
          "$($_.ExecutablePath)".Equals((Join-Path $raiz 'node\node.exe'), [StringComparison]::OrdinalIgnoreCase)))
    })
    foreach ($proceso in $procesos) { Stop-Process -Id $proceso.ProcessId -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 2

    # 2. Abrirlo de nuevo: con la tarea de Windows y, si no arranca, directo desde aquí.
    try { Start-ScheduledTask -TaskName $tarea } catch {}
    Start-Sleep -Seconds 3
    $corriendo = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains('agente-siempre.ps1') }
    if (-not $corriendo) {
        $siempre = Join-Path $agente 'agente-siempre.ps1'
        Start-Process powershell.exe -WindowStyle Hidden -ArgumentList "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$siempre`""
    }

    # 3. Esperar a que el servidor lo vea. La conexión seguirá reintentando aunque termine esta ventana.
    if (-not $servidor -or -not $token) {
        Avisar 'Se reinició el programa de impresión.' 'Information'
        exit 0
    }
    $equipo = [Net.Dns]::GetHostName()
    $limite = (Get-Date).AddSeconds(30)
    while ((Get-Date) -lt $limite) {
        try {
            $estado = Invoke-RestMethod -Uri "$servidor/api/agente/estado" -Headers @{ 'X-Agent-Token' = $token } -TimeoutSec 5
            if ($estado.conectado -and $estado.agente.equipo -eq $equipo) {
                Avisar 'Listo: las impresoras están conectadas a SOFT RESTAURANTE.' 'Information'
                exit 0
            }
        } catch {}
        Start-Sleep -Seconds 2
    }
    Avisar 'El programa de impresión se reinició, pero todavía no llega al servidor. Revisa que esta computadora tenga internet: se conecta sola en cuanto pueda.' 'Warning'
    exit 1
} catch {
    Avisar "No se pudo reconectar: $($_.Exception.Message)" 'Error'
    exit 2
}
