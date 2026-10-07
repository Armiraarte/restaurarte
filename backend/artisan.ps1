$ErrorActionPreference = 'Stop'
$localPhp = Join-Path (Split-Path $PSScriptRoot -Parent) '.tools\php\php.exe'
$php = if (Test-Path -LiteralPath $localPhp) { $localPhp } else { (Get-Command php -ErrorAction Stop).Source }
& $php -r 'exit(PHP_VERSION_ID >= 80400 ? 0 : 1);'
if ($LASTEXITCODE -ne 0) {
    throw 'Este proyecto necesita PHP 8.4 o superior. Ejecuta .\scripts\setup-php.ps1.'
}
& $php (Join-Path $PSScriptRoot 'artisan') @args
exit $LASTEXITCODE
