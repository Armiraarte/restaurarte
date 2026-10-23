# Mantiene corriendo el agente de impresion: si se cierra o falla, lo vuelve a iniciar a los 3 s.
# Arranca solo al iniciar sesion y el instalador lo vuelve a lanzar cada minuto por si se cerro (solo corre una
# copia). El agente se cierra solo si pasa 3 min sin el servidor, y aqui se reinicia limpio. Registro: data\agente.log
Set-Location $PSScriptRoot
# El instalador deja su propio Node junto al agente (..\node\node.exe); si no, el que tenga instalado la PC.
$node = Join-Path $PSScriptRoot '..\node\node.exe'
if (-not (Test-Path $node)) { $node = (Get-Command node -ErrorAction SilentlyContinue).Source }
if (-not $node) { $node = Join-Path $env:ProgramFiles 'nodejs\node.exe' }
$registro = Join-Path $PSScriptRoot 'data\agente.log'
New-Item -ItemType Directory -Force (Split-Path $registro) | Out-Null

# Una sola copia: la tarea de Windows lo vuelve a lanzar cada minuto por si se cerro, y el boton "Reconectar
# impresoras" tambien lo abre; si ya hay uno corriendo, este se cierra sin hacer nada.
$unico = New-Object System.Threading.Mutex($false, 'Local\SoftRestauranteAgenteImpresion')
try { $esElUnico = $unico.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $esElUnico = $true }
if (-not $esElUnico) { exit 0 }

# Mientras el agente corre, Windows no se suspende por inactividad (suspendida no imprime); la pantalla si se apaga.
try {
  Add-Type -Namespace SoftRestaurante -Name Energia -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint estado);'
  [void][SoftRestaurante.Energia]::SetThreadExecutionState([uint32]2147483649) # ES_CONTINUOUS | ES_SYSTEM_REQUIRED
} catch {
  Add-Content -Path $registro -Value "$(Get-Date -Format s) no se pudo evitar la suspension: $($_.Exception.Message)"
}

while ($true) {
  # El registro no crece sin fin: pasados 5 MB se guarda como agente.log.1 y se empieza otro.
  if ((Test-Path $registro) -and (Get-Item $registro).Length -gt 5MB) {
    Move-Item -Force $registro "$registro.1" -ErrorAction SilentlyContinue
  }
  Add-Content -Path $registro -Value "$(Get-Date -Format s) iniciando agente"
  & $node agente.mjs 2>&1 | Add-Content -Path $registro
  Add-Content -Path $registro -Value "$(Get-Date -Format s) el agente se detuvo (codigo $LASTEXITCODE); reinicio en 3 s"
  Start-Sleep -Seconds 3
}
