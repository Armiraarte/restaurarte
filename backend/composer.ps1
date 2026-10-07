$ErrorActionPreference = 'Stop'
$toolsDir = Join-Path (Split-Path $PSScriptRoot -Parent) '.tools'
$localPhp = Join-Path $toolsDir 'php\php.exe'
$php = if (Test-Path -LiteralPath $localPhp) { $localPhp } else { (Get-Command php -ErrorAction Stop).Source }
if (Test-Path -LiteralPath (Join-Path $toolsDir 'composer.phar')) {
    $composer = Join-Path $toolsDir 'composer.phar'
} else {
    $composerDir = Split-Path (Get-Command composer -ErrorAction Stop).Source -Parent
    $composer = Join-Path $composerDir 'composer.phar'
}
if (-not (Test-Path -LiteralPath $composer)) {
    throw 'No se encontro composer.phar. Ejecuta .\scripts\setup-php.ps1.'
}
& $php $composer "--working-dir=$PSScriptRoot" @args
exit $LASTEXITCODE
