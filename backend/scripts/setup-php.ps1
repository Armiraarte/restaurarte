$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$toolsDir = Join-Path $projectRoot '.tools'
$phpDir = Join-Path $toolsDir 'php'
New-Item -ItemType Directory -Path $phpDir -Force | Out-Null

$releases = Invoke-RestMethod -Uri 'https://windows.php.net/downloads/releases/releases.json'
$release = $releases.'8.4'.'nts-vs17-x64'.zip
if (-not $release.path -or -not $release.sha256) {
    throw 'No se pudo obtener una distribucion oficial de PHP 8.4 para Windows x64.'
}
$zipPath = Join-Path $toolsDir $release.path
Invoke-WebRequest -UseBasicParsing -Uri ("https://windows.php.net/downloads/releases/" + $release.path) -OutFile $zipPath
if ((Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $release.sha256.ToLowerInvariant()) {
    throw 'La suma SHA-256 del archivo de PHP no coincide con la publicacion oficial.'
}
Expand-Archive -LiteralPath $zipPath -DestinationPath $phpDir -Force

$caPath = Join-Path $phpDir 'cacert.pem'
Invoke-WebRequest -UseBasicParsing -Uri 'https://curl.se/ca/cacert.pem' -OutFile $caPath
$phpIni = @(
    'extension_dir="ext"',
    'extension=curl',
    'extension=fileinfo',
    'extension=intl',
    'extension=mbstring',
    'extension=openssl',
    'extension=pdo_mysql',
    'extension=pdo_sqlite',
    'extension=sqlite3',
    'extension=zip',
    'memory_limit=512M',
    'date.timezone=America/Mexico_City',
    ('curl.cainfo="' + $caPath.Replace('\', '/') + '"'),
    ('openssl.cafile="' + $caPath.Replace('\', '/') + '"')
)
[System.IO.File]::WriteAllLines((Join-Path $phpDir 'php.ini'), $phpIni, [System.Text.UTF8Encoding]::new($false))

$installerPath = Join-Path $toolsDir 'composer-setup.php'
Invoke-WebRequest -UseBasicParsing -Uri 'https://getcomposer.org/installer' -OutFile $installerPath
$installerSignature = (Invoke-RestMethod -Uri 'https://composer.github.io/installer.sig').Trim()
if ((Get-FileHash -LiteralPath $installerPath -Algorithm SHA384).Hash.ToLowerInvariant() -ne $installerSignature.ToLowerInvariant()) {
    throw 'La firma del instalador de Composer no coincide con la publicacion oficial.'
}
& (Join-Path $phpDir 'php.exe') $installerPath "--install-dir=$toolsDir" '--filename=composer.phar' '--quiet'
if ($LASTEXITCODE -ne 0) { throw 'No se pudo instalar Composer.' }
& (Join-Path $phpDir 'php.exe') --version
Write-Output 'PHP y Composer locales preparados. Usa artisan.ps1 y composer.ps1 desde backend.'
