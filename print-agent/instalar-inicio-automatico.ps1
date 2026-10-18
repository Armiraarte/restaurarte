# Registra en el Programador de tareas de Windows el agente de impresion y el tunel hacia el servidor, para que
# arranquen solos (ocultos) al iniciar sesion en esta PC. Es por usuario: no necesita permisos de administrador.
# Uso:            powershell -ExecutionPolicy Bypass -File .\print-agent\instalar-inicio-automatico.ps1
# Para quitarlos: Unregister-ScheduledTask -TaskName 'SOFT RESTAURANTE - agente de impresion' -Confirm:$false
#                 Unregister-ScheduledTask -TaskName 'SOFT RESTAURANTE - tunel de impresion' -Confirm:$false
$ErrorActionPreference = 'Stop'
$tareas = [ordered]@{
  'SOFT RESTAURANTE - agente de impresion' = 'agente-siempre.ps1'
  'SOFT RESTAURANTE - tunel de impresion'  = 'tunel-servidor.ps1'
}
foreach ($nombre in $tareas.Keys) {
  $script = Join-Path $PSScriptRoot $tareas[$nombre]
  $accion = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""
  $inicio = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
  $ajustes = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
  Register-ScheduledTask -TaskName $nombre -Action $accion -Trigger $inicio -Settings $ajustes -Force `
    -Description 'SOFT RESTAURANTE: impresion de tickets desde https://losdiablitos.restaurarte.com.mx' | Out-Null
  Write-Output "registrada: $nombre"
}
