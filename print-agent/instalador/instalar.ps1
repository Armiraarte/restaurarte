# Instalador de impresión de SOFT RESTAURANTE. Lo abre Instalar-impresoras-SOFT-RESTAURANTE.exe (con permiso de
# administrador) desde la carpeta donde se descomprime. Deja la computadora lista para imprimir:
#   1. Drivers e impresoras de Windows (Star TSP143 de cocina, Axiohm APOS2101 de caja).
#   2. El agente de impresión con su propio Node.js en C:\SoftRestaurante, conectado al servidor por internet
#      (sin túnel ni llaves): SERVIDOR_URL y PRINT_AGENT_TOKEN de config.env.
#   3. Cocina y caja asignadas, arranque automático al iniciar sesión (y revisión cada minuto de que siga
#      corriendo), revisión de impresoras cada 5 minutos e ícono «Reconectar impresoras» en el escritorio.
#   4. Comprueba que el servidor ya ve las impresoras.
# Se puede volver a correr cuando sea: reemplaza la instalación anterior y conserva las asignaciones válidas.
param(
    [string]$Destino = 'C:\SoftRestaurante',
    [int]$Puerto = 9101,
    [switch]$SoloArchivos, # pruebas: sin drivers, tareas de Windows ni permisos de administrador
    [switch]$SinPausa
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
try { $Host.UI.RawUI.WindowTitle = 'SOFT RESTAURANTE - Instalador de impresoras' } catch {}

function Paso($texto) { Write-Host "`n== $texto" -ForegroundColor Cyan }
function Bien($texto) { Write-Host "   OK  $texto" -ForegroundColor Green }
function Aviso($texto) { Write-Host "   !!  $texto" -ForegroundColor Yellow }

$tareaAgente = 'SOFT RESTAURANTE - agente de impresion'
$tareaRevisar = 'SOFT RESTAURANTE - revisar impresoras'
$driverStar = 'Star TSP100 Cutter (TSP143)'
$codigo = 0

New-Item -ItemType Directory -Force $Destino | Out-Null
try { Start-Transcript -Path (Join-Path $Destino 'instalacion.log') -Force | Out-Null } catch {}
try {
    Write-Host 'SOFT RESTAURANTE - Instalador de impresoras' -ForegroundColor White
    Write-Host 'Conecta y enciende las impresoras por USB. Esto tarda uno o dos minutos.'

    # config.env: SERVIDOR_URL y PRINT_AGENT_TOKEN (los pone crear-instalador.ps1).
    $config = @{}
    foreach ($linea in Get-Content (Join-Path $PSScriptRoot 'config.env')) {
        if ($linea -match '^\s*([A-Z_]+)=(.*)$') { $config[$Matches[1]] = $Matches[2].Trim() }
    }
    $servidor = $config.SERVIDOR_URL.TrimEnd('/')
    $token = $config.PRINT_AGENT_TOKEN
    if (-not $servidor -or -not $token) { throw 'Al instalador le falta la configuración del servidor (config.env).' }
    $cabecera = @{ 'X-Agent-Token' = $token }

    if (-not $SoloArchivos) {
        $admin = (New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole(
            [Security.Principal.WindowsBuiltInRole]::Administrator)
        if (-not $admin) { throw 'Abre el instalador con permiso de administrador.' }
        if (-not [Environment]::Is64BitOperatingSystem) { throw 'Este instalador es para Windows de 64 bits.' }
    }

    # ---------- 1. Si ya estaba instalado, se detiene para reemplazar sus archivos ----------
    Paso 'Preparando'
    if (-not $SoloArchivos) { Get-ScheduledTask -TaskName $tareaAgente -ErrorAction SilentlyContinue | Stop-ScheduledTask }
    $anteriores = @(Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='powershell.exe'" | Where-Object {
        $_.ProcessId -ne $PID -and $_.CommandLine -and
        ($_.CommandLine.Contains("$Destino\agente") -or $_.CommandLine.Contains("$Destino\node") -or "$($_.ExecutablePath)".StartsWith("$Destino\"))
    })
    foreach ($proceso in $anteriores) { Stop-Process -Id $proceso.ProcessId -Force -ErrorAction SilentlyContinue }
    if ($anteriores.Count) { Start-Sleep -Seconds 1; Bien 'Se detuvo la instalación anterior.' } else { Bien 'Listo para instalar.' }

    # ---------- 2. Impresoras de Windows ----------
    if (-not $SoloArchivos) {
        Paso 'Impresoras de Windows (Star de cocina y Axiohm de caja)'
        & (Join-Path $PSScriptRoot 'impresoras\impresoras-windows.ps1')
    }

    # ---------- 3. Agente de impresión ----------
    Paso 'Programa de impresión'
    foreach ($carpeta in 'agente', 'node', 'impresoras') {
        $origen = Join-Path $PSScriptRoot $carpeta
        if (-not (Test-Path $origen)) { continue }
        & robocopy.exe $origen (Join-Path $Destino $carpeta) /E /R:2 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
        if ($LASTEXITCODE -ge 8) { throw "No se pudieron copiar los archivos de $carpeta (robocopy $LASTEXITCODE)." }
    }
    Get-ChildItem $Destino -Recurse -File | Unblock-File -ErrorAction SilentlyContinue

    $variables = "SERVIDOR_URL=$servidor`r`nPRINT_AGENT_TOKEN=$token`r`n"
    if ($Puerto -ne 9101) { $variables += "PRINT_AGENT_PORT=$Puerto`r`n" }
    [IO.File]::WriteAllText((Join-Path $Destino '.env'), $variables)

    # Asignaciones: cocina = Star, caja = Axiohm (se conservan las que ya había si esa impresora existe).
    $datos = Join-Path $Destino 'agente\data'
    New-Item -ItemType Directory -Force $datos | Out-Null
    $impresorasWindows = @(Get-Printer -ErrorAction SilentlyContinue)
    $star = $impresorasWindows | Where-Object { $_.DriverName -eq $driverStar } | Select-Object -First 1
    $sugeridas = @{ cocina = $(if ($star) { $star.Name } else { $driverStar }); caja = 'Axiohm APOS2101' }
    $archivoAsignaciones = Join-Path $datos 'asignaciones.json'
    $guardadas = $null
    if (Test-Path $archivoAsignaciones) { try { $guardadas = Get-Content -Raw $archivoAsignaciones | ConvertFrom-Json } catch {} }
    $asignaciones = [ordered]@{}
    foreach ($destinoTicket in 'cocina', 'caja') {
        $guardada = if ($guardadas) { $guardadas.$destinoTicket } else { $null }
        $asignaciones[$destinoTicket] = if ($guardada -and ($impresorasWindows.Name -contains $guardada)) { $guardada } else { $sugeridas[$destinoTicket] }
    }
    [IO.File]::WriteAllText($archivoAsignaciones, (($asignaciones | ConvertTo-Json) + "`n"))
    if (-not $SoloArchivos) {
        # El agente corre con el usuario de Windows: necesita escribir sus asignaciones y su registro.
        & icacls.exe $datos /grant '*S-1-5-32-545:(OI)(CI)M' /T /Q | Out-Null
    }
    Bien "Instalado en $Destino (cocina: $($asignaciones.cocina) · caja: $($asignaciones.caja))"

    # ---------- 4. Arranque automático ----------
    $siempre = Join-Path $Destino 'agente\agente-siempre.ps1'
    $argumentos = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$siempre`""
    if (-not $SoloArchivos) {
        Paso 'Arranque automático con Windows'
        # Corre con el usuario que tiene la sesión abierta (imprimir con el driver de la Star necesita su sesión).
        $usuario = (Get-CimInstance Win32_ComputerSystem).UserName
        if (-not $usuario) { $usuario = "$env:USERDOMAIN\$env:USERNAME" }
        $ajustes = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
            -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
        # Al entrar a Windows y, además, cada minuto: si el programa se cerró por lo que sea, vuelve a abrirse solo
        # (agente-siempre.ps1 deja correr una sola copia; las demás se cierran al instante).
        Register-ScheduledTask -TaskName $tareaAgente -Force `
            -Action (New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argumentos) `
            -Trigger @((New-ScheduledTaskTrigger -AtLogOn -User $usuario),
                (New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1))) `
            -Principal (New-ScheduledTaskPrincipal -UserId $usuario -LogonType Interactive -RunLevel Limited) `
            -Settings $ajustes -Description "SOFT RESTAURANTE: imprime los tickets de $servidor" | Out-Null
        Bien "El programa de impresión arranca solo al entrar a Windows ($usuario) y se revisa cada minuto."

        try {
            # Botón para el personal: reconecta la impresión sin apagar la computadora.
            $escritorio = [Environment]::GetFolderPath('CommonDesktopDirectory')
            $acceso = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $escritorio 'Reconectar impresoras.lnk'))
            $acceso.TargetPath = 'powershell.exe'
            $acceso.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$(Join-Path $Destino 'agente\reconectar.ps1')`""
            $acceso.IconLocation = "$env:SystemRoot\System32\shell32.dll,16"
            $acceso.Description = 'SOFT RESTAURANTE: vuelve a conectar las impresoras sin apagar la computadora'
            $acceso.Save()
            Bien 'En el escritorio quedó el ícono «Reconectar impresoras».'
        } catch { Aviso "No se pudo crear el ícono «Reconectar impresoras»: $($_.Exception.Message)" }

        try {
            $revisar = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$(Join-Path $Destino 'impresoras\impresoras-windows.ps1')`" -Silencioso"
            Register-ScheduledTask -TaskName $tareaRevisar -Force `
                -Action (New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $revisar) `
                -Trigger @((New-ScheduledTaskTrigger -AtStartup),
                    (New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) -RepetitionInterval (New-TimeSpan -Minutes 5))) `
                -Principal (New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest) `
                -Settings (New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
                    -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -MultipleInstances IgnoreNew) `
                -Description 'SOFT RESTAURANTE: agrega las impresoras de tickets en cuanto se conectan' | Out-Null
            Bien 'Si conectan una impresora después, aparece sola en unos minutos.'
        } catch { Aviso "No se pudo programar la revisión de impresoras: $($_.Exception.Message)" }

        try {
            # Conectada a la corriente, la computadora no se suspende (suspendida no imprime).
            & powercfg.exe /change standby-timeout-ac 0 | Out-Null
            & powercfg.exe /change hibernate-timeout-ac 0 | Out-Null
            # Ni al cerrar la tapa (0 = no hacer nada), siempre que esté conectada a la corriente.
            & powercfg.exe /setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0 | Out-Null
            & powercfg.exe /setactive SCHEME_CURRENT | Out-Null
            Bien 'Conectada a la corriente, la computadora ya no se suspende (ni con la tapa cerrada).'
        } catch { Aviso 'No se pudo cambiar la suspensión de la computadora.' }
    }

    # ---------- 5. Arrancar y comprobar ----------
    Paso 'Conectando con SOFT RESTAURANTE'
    if ($SoloArchivos) { Start-Process powershell.exe -ArgumentList $argumentos -WindowStyle Hidden }
    else { Start-ScheduledTask -TaskName $tareaAgente }

    $estado = $null
    $respaldo = $SoloArchivos
    $inicio = Get-Date
    while (-not $estado -and ((Get-Date) - $inicio).TotalSeconds -lt 120) {
        try {
            $estado = Invoke-RestMethod -Uri "http://127.0.0.1:$Puerto/impresoras" -Headers $cabecera -TimeoutSec 60
        } catch {
            Start-Sleep -Seconds 2
            # Si la tarea no lo arrancó (p. ej. sesión distinta), se arranca directo desde aquí.
            if (-not $respaldo -and ((Get-Date) - $inicio).TotalSeconds -gt 20) {
                $respaldo = $true
                Start-Process powershell.exe -ArgumentList $argumentos -WindowStyle Hidden
            }
        }
    }
    if (-not $estado) { throw "El programa de impresión no arrancó. Revisa $datos\agente.log" }
    Bien 'El programa de impresión está corriendo.'

    $equipo = [Net.Dns]::GetHostName()
    $conectado = $null
    $inicio = Get-Date
    while (-not $conectado -and ((Get-Date) - $inicio).TotalSeconds -lt 45) {
        try {
            $respuesta = Invoke-RestMethod -Uri "$servidor/api/agente/estado" -Headers $cabecera -TimeoutSec 15
            if ($respuesta.conectado -and $respuesta.agente.equipo -eq $equipo) { $conectado = $respuesta }
        } catch {}
        if (-not $conectado) { Start-Sleep -Seconds 2 }
    }
    if ($conectado) { Bien "Conectado a $servidor como «$equipo»." }
    else {
        $codigo = 2
        Aviso "Todavía no se conecta a $servidor. Revisa que esta computadora tenga internet; se conecta sola en cuanto pueda."
    }

    Paso 'Resultado'
    foreach ($destinoTicket in 'cocina', 'caja') {
        $nombre = $estado.asignaciones.$destinoTicket
        $impresora = $estado.destinos.$destinoTicket
        $titulo = if ($destinoTicket -eq 'cocina') { 'Cocina' } else { 'Caja  ' }
        if ($impresora -and $impresora.conectada) { Bien "$titulo  $nombre  (conectada)" }
        elseif ($impresora) { $codigo = [Math]::Max($codigo, 1); Aviso "$titulo  $nombre  (desconectada: conéctala y enciéndela)" }
        else { $codigo = [Math]::Max($codigo, 1); Aviso "$titulo  $nombre  (todavía no aparece en Windows: conéctala y enciéndela)" }
    }
    Write-Host ''
    if ($codigo -eq 0) {
        Write-Host 'LISTO. Ya se puede imprimir desde SOFT RESTAURANTE (Configuración > Impresoras > Probar).' -ForegroundColor Green
    } else {
        Write-Host 'Instalado. Lo que falta se arregla solo en cuanto las impresoras estén conectadas y haya internet.' -ForegroundColor Yellow
    }
} catch {
    $codigo = 3
    Write-Host "`nNO SE PUDO TERMINAR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Detalle en $Destino\instalacion.log" -ForegroundColor Red
} finally {
    try { Stop-Transcript | Out-Null } catch {}
}
if (-not $SinPausa) { Write-Host ''; Read-Host 'Presiona Enter para cerrar' | Out-Null }
exit $codigo
