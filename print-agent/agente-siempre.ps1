# Mantiene corriendo el agente de impresion: si se cierra o falla, lo vuelve a iniciar a los 3 s.
# Arranca solo al iniciar sesion (instalar-inicio-automatico.ps1). Registro: data\agente.log
Set-Location $PSScriptRoot
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { $node = Join-Path $env:ProgramFiles 'nodejs\node.exe' }
$registro = Join-Path $PSScriptRoot 'data\agente.log'
New-Item -ItemType Directory -Force (Split-Path $registro) | Out-Null

while ($true) {
  Add-Content -Path $registro -Value "$(Get-Date -Format s) iniciando agente"
  & $node agente.mjs 2>&1 | Add-Content -Path $registro
  Add-Content -Path $registro -Value "$(Get-Date -Format s) el agente se detuvo (codigo $LASTEXITCODE); reinicio en 3 s"
  Start-Sleep -Seconds 3
}
