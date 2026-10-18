# Tunel de impresion: el servidor (https://losdiablitos.restaurarte.com.mx) le manda los tickets al agente
# de impresion de esta PC. La PC abre una conexion SSH hacia el servidor y le presta su puerto 9101, que en el
# servidor solo existe en 127.0.0.1 (PRINT_AGENT_URL=http://127.0.0.1:9101). No hay que abrir puertos en el modem.
# Si se cae el internet o se reinicia el servidor, se vuelve a conectar sola a los pocos segundos.
#
# Llave: %USERPROFILE%\.ssh\restaurarte_tunel. En el servidor es del usuario tunel-impresion y solo puede
# abrir este tunel (restrict,port-forwarding,permitlisten="127.0.0.1:9101"): sin consola ni nada mas.
# Arranca sola al iniciar sesion (instalar-inicio-automatico.ps1). Registro: data\tunel.log
$llave = Join-Path $env:USERPROFILE '.ssh\restaurarte_tunel'
$ssh = Join-Path $env:WINDIR 'System32\OpenSSH\ssh.exe'
$registro = Join-Path $PSScriptRoot 'data\tunel.log'
New-Item -ItemType Directory -Force (Split-Path $registro) | Out-Null

while ($true) {
  Add-Content -Path $registro -Value "$(Get-Date -Format s) conectando"
  & $ssh -N -R 127.0.0.1:9101:127.0.0.1:9101 -i $llave `
    -o IdentitiesOnly=yes -o BatchMode=yes -o ExitOnForwardFailure=yes `
    -o ServerAliveInterval=20 -o ServerAliveCountMax=3 -o StrictHostKeyChecking=accept-new `
    tunel-impresion@losdiablitos.restaurarte.com.mx 2>&1 | Add-Content -Path $registro
  Add-Content -Path $registro -Value "$(Get-Date -Format s) desconectado (codigo $LASTEXITCODE); reintento en 5 s"
  Start-Sleep -Seconds 5
}
