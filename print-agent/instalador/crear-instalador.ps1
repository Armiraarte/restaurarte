# Arma Instalar-impresoras-SOFT-RESTAURANTE.exe: un solo archivo que deja lista la computadora de las impresoras
# (ver instalar.ps1). Se corre en una PC que ya tenga instalados el driver de la Star TSP143 y Node.js.
#   powershell -ExecutionPolicy Bypass -File .\print-agent\instalador\crear-instalador.ps1 -ArchivoToken <archivo>
# -ArchivoToken: archivo con el PRINT_AGENT_TOKEN del servidor (el mismo de /opt/restaurarte/backend.env).
# El .exe lleva ese token dentro: se sube a /opt/restaurarte/data/descargas/ y solo administración o caja lo
# descargan desde Configuración > Impresoras. No se guarda en git (salida\ está ignorada).
param(
    [Parameter(Mandatory)] [string]$ArchivoToken,
    [string]$Servidor = 'https://losdiablitos.restaurarte.com.mx',
    [string]$Salida, # por omisión: salida\Instalar-impresoras-SOFT-RESTAURANTE.exe junto a este script
    [string]$DriverStar = (Get-ChildItem "$env:windir\System32\DriverStore\FileRepository\smjt100.inf_amd64_*" -Directory |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName),
    [string]$Node = (Get-Command node -ErrorAction SilentlyContinue).Source,
    [switch]$SinManifiesto # pruebas: el .exe no pide permiso de administrador
)
$ErrorActionPreference = 'Stop'
if (-not $Salida) { $Salida = Join-Path $PSScriptRoot 'salida\Instalar-impresoras-SOFT-RESTAURANTE.exe' }
Add-Type -AssemblyName System.IO.Compression.FileSystem, System.Drawing

$token = (Get-Content -Raw $ArchivoToken).Trim()
if ($token.Length -lt 32) { throw 'El token del agente es muy corto.' }
if (-not $DriverStar -or -not (Test-Path (Join-Path $DriverStar 'smjt100.inf'))) { throw 'No se encontró el driver de la Star TSP143 (smjt100.inf).' }
if (-not $Node -or -not (Test-Path $Node)) { throw 'No se encontró node.exe.' }

$agente = Split-Path $PSScriptRoot
$trabajo = Join-Path ([IO.Path]::GetTempPath()) ("crear-instalador-" + [guid]::NewGuid().ToString('N'))
$paquete = Join-Path $trabajo 'paquete'
try {
    foreach ($carpeta in 'impresoras\Star-TSP143', 'agente\assets', 'node') { New-Item -ItemType Directory -Force (Join-Path $paquete $carpeta) | Out-Null }
    Copy-Item (Join-Path $PSScriptRoot 'instalar.ps1') $paquete
    Copy-Item (Join-Path $PSScriptRoot 'impresoras-windows.ps1') (Join-Path $paquete 'impresoras')
    Copy-Item "$DriverStar\*" (Join-Path $paquete 'impresoras\Star-TSP143') -Recurse -Exclude '*.PNF'
    # El agente: todo menos lo del túnel SSH y los instaladores de la PC de desarrollo.
    Get-ChildItem $agente -File | Where-Object {
        $_.Extension -in '.mjs', '.ps1', '.cs' -and $_.Name -notin 'tunel-servidor.ps1', 'instalar-inicio-automatico.ps1', 'instalar-axiohm.ps1'
    } | Copy-Item -Destination (Join-Path $paquete 'agente')
    Copy-Item (Join-Path $agente 'assets\*') (Join-Path $paquete 'agente\assets')
    Copy-Item $Node (Join-Path $paquete 'node\node.exe')
    [IO.File]::WriteAllText((Join-Path $paquete 'config.env'), "SERVIDOR_URL=$($Servidor.TrimEnd('/'))`r`nPRINT_AGENT_TOKEN=$token`r`n")

    $zip = Join-Path $trabajo 'paquete.zip'
    [IO.Compression.ZipFile]::CreateFromDirectory($paquete, $zip, [IO.Compression.CompressionLevel]::Optimal, $false)

    # Ícono del .exe: el logo de la app (PNG dentro del .ico, como lo acepta Windows desde Vista).
    $logo = [Drawing.Image]::FromFile((Resolve-Path (Join-Path $agente '..\frontend\public\icons\cenaduria-512.png')))
    $tamanos = 256, 48, 32, 16
    $pngs = foreach ($tamano in $tamanos) {
        $imagen = New-Object Drawing.Bitmap $tamano, $tamano
        $lienzo = [Drawing.Graphics]::FromImage($imagen)
        $lienzo.InterpolationMode = 'HighQualityBicubic'
        $lienzo.DrawImage($logo, 0, 0, $tamano, $tamano)
        $lienzo.Dispose()
        $memoria = New-Object IO.MemoryStream
        $imagen.Save($memoria, [Drawing.Imaging.ImageFormat]::Png)
        $imagen.Dispose()
        , $memoria.ToArray()
    }
    $logo.Dispose()
    $ico = Join-Path $trabajo 'icono.ico'
    $escritor = New-Object IO.BinaryWriter ([IO.File]::Create($ico))
    $escritor.Write([uint16]0); $escritor.Write([uint16]1); $escritor.Write([uint16]$tamanos.Count)
    $posicion = 6 + 16 * $tamanos.Count
    for ($i = 0; $i -lt $tamanos.Count; $i++) {
        $lado = if ($tamanos[$i] -ge 256) { 0 } else { $tamanos[$i] }
        $escritor.Write([byte]$lado); $escritor.Write([byte]$lado); $escritor.Write([byte]0); $escritor.Write([byte]0)
        $escritor.Write([uint16]1); $escritor.Write([uint16]32); $escritor.Write([uint32]$pngs[$i].Length); $escritor.Write([uint32]$posicion)
        $posicion += $pngs[$i].Length
    }
    foreach ($png in $pngs) { $escritor.Write($png) }
    $escritor.Close()

    New-Item -ItemType Directory -Force (Split-Path $Salida) | Out-Null
    $opciones = @('/nologo', '/target:exe', '/platform:x64', '/optimize+', "/out:$Salida", "/win32icon:$ico",
        "/resource:$zip,paquete.zip", '/r:System.IO.Compression.dll', '/r:System.IO.Compression.FileSystem.dll')
    if (-not $SinManifiesto) { $opciones += "/win32manifest:$(Join-Path $PSScriptRoot 'instalador.manifest')" }
    & "$env:windir\Microsoft.NET\Framework64\v4.0.30319\csc.exe" @opciones (Join-Path $PSScriptRoot 'Instalador.cs')
    if ($LASTEXITCODE -ne 0) { throw "No se pudo compilar el instalador (csc $LASTEXITCODE)." }

    $archivo = Get-Item $Salida
    Write-Output ("{0}  {1:N1} MB  sha256 {2}" -f $archivo.FullName, ($archivo.Length / 1MB), (Get-FileHash $Salida -Algorithm SHA256).Hash.ToLower())
} finally {
    Remove-Item -Recurse -Force $trabajo -ErrorAction SilentlyContinue
}
