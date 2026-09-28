param(
    [switch]$Check,
    [switch]$Install
)
$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appDir = Join-Path $env:LOCALAPPDATA 'Transcritor AgentFlix'
$venvPython = Join-Path $appDir 'venv\Scripts\python.exe'
$webViewId = '{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'

function Refresh-ProcessPath {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = "$machine;$user;$env:APPDATA\npm"
}

function Get-Python311 {
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python311\python.exe'),
        (Join-Path $env:ProgramFiles 'Python311\python.exe')
    )
    $launcher = Get-Command py.exe -ErrorAction SilentlyContinue
    if ($launcher) {
        try {
            $candidate = & $launcher.Source -3.11 -c 'import sys; print(sys.executable)' 2>$null
            if ($LASTEXITCODE -eq 0 -and $candidate) { $candidates += $candidate }
        } catch { }
    }
    $python = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($python) { $candidates += $python.Source }
    foreach ($candidate in $candidates) {
        if (-not (Test-Path $candidate)) { continue }
        try {
            $version = & $candidate --version 2>$null
            $bytes = [System.IO.File]::ReadAllBytes($candidate)
            $offset = [BitConverter]::ToInt32($bytes, 60)
            $machine = [BitConverter]::ToUInt16($bytes, $offset + 4)
            if ($LASTEXITCODE -eq 0 -and $version -match '^Python 3\.11\.' -and $machine -eq 0x8664) {
                return $candidate
            }
        } catch { }
    }
    return $null
}

function Get-Codex {
    $command = Get-Command codex.cmd -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $candidate = Join-Path $env:APPDATA 'npm\codex.cmd'
    if (Test-Path $candidate) { return $candidate }
    return $null
}

function Has-DeviceAuth {
    $codex = Get-Codex
    if (-not $codex) { return $false }
    try {
        $helpText = (& $codex login --help 2>&1 | Out-String)
        return ($LASTEXITCODE -eq 0 -and $helpText.Contains('--device-auth'))
    } catch { return $false }
}

function Has-WebView2 {
    $paths = @(
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\$webViewId",
        "HKCU:\Software\Microsoft\EdgeUpdate\Clients\$webViewId"
    )
    foreach ($path in $paths) {
        $item = Get-ItemProperty -Path $path -Name pv -ErrorAction SilentlyContinue
        if ($item -and $item.pv -and $item.pv -ne '0.0.0.0') { return $true }
    }
    return $false
}

function Has-VCRuntime {
    $paths = @(
        'HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64',
        'HKLM:\SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x64'
    )
    foreach ($path in $paths) {
        $item = Get-ItemProperty -Path $path -Name Installed -ErrorAction SilentlyContinue
        if ($item -and $item.Installed -eq 1) { return $true }
    }
    return $false
}

function Has-Packages {
    if (-not (Test-Path $venvPython)) { return $false }
    try {
        & $venvPython -c 'import faster_whisper, imageio_ffmpeg, webview, PyInstaller, yt_dlp; imageio_ffmpeg.get_ffmpeg_exe()' *> $null
        return ($LASTEXITCODE -eq 0 -and (Test-Path (Join-Path $appDir 'venv\Scripts\yt-dlp.exe')))
    } catch { return $false }
}

function Has-Model {
    if (-not (Test-Path $venvPython)) { return $false }
    try {
        & $venvPython (Join-Path $scriptDir 'windows_model.py') *> $null
        return ($LASTEXITCODE -eq 0)
    } catch { return $false }
}

function Report {
    Refresh-ProcessPath
    $arch = $env:PROCESSOR_ARCHITECTURE
    $build = [Environment]::OSVersion.Version.Build
    $windows = [Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT -and
               (($arch -eq 'AMD64' -and $build -ge 17763) -or ($arch -eq 'ARM64' -and $build -ge 22000))
    $supportedCpu = [Environment]::Is64BitOperatingSystem -and $arch -in @('AMD64', 'ARM64')
    $checks = [ordered]@{
        'Windows x64 10 1809+/11 ou ARM64 11' = $windows
        'CPU x64 ou ARM64' = $supportedCpu
        'winget' = [bool](Get-Command winget.exe -ErrorAction SilentlyContinue)
        'Python 3.11 x64' = [bool](Get-Python311)
        'Node.js/npm' = [bool](Get-Command npm.cmd -ErrorAction SilentlyContinue)
        'Codex CLI com /device' = Has-DeviceAuth
        'WebView2 Runtime' = Has-WebView2
        'Visual C++ Runtime x64' = Has-VCRuntime
        'Pacotes Python do app' = Has-Packages
        'Modelo Whisper' = Has-Model
    }
    foreach ($entry in $checks.GetEnumerator()) {
        $mark = if ($entry.Value) { 'OK' } else { 'FALTA' }
        Write-Host "$mark  $($entry.Key)"
    }
    return -not ($checks.Values -contains $false)
}

function Install-WingetPackage([string]$packageId, [string]$architecture = '') {
    $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
    if (-not $winget) { throw 'winget ausente. Instale ou atualize App Installer da Microsoft e execute novamente.' }
    $wingetArgs = @('install', '--id', $packageId, '-e', '--source', 'winget',
                    '--accept-package-agreements', '--accept-source-agreements')
    if ($architecture) { $wingetArgs += @('--architecture', $architecture) }
    & $winget.Source @wingetArgs
    if ($LASTEXITCODE -ne 0) { throw "Falha ao instalar $packageId pelo winget." }
    Refresh-ProcessPath
}

function Install-WebView2 {
    $download = Join-Path $env:TEMP 'TranscritorAgentFlix-WebView2Setup.exe'
    try {
        Invoke-WebRequest -Uri 'https://go.microsoft.com/fwlink/p/?LinkId=2124703' -OutFile $download -UseBasicParsing
        $result = Start-Process -FilePath $download -ArgumentList '/silent', '/install' -Wait -PassThru
        if ($result.ExitCode -ne 0 -or -not (Has-WebView2)) { throw 'WebView2 Runtime não ficou disponível após a instalação.' }
    } finally {
        if (Test-Path $download) { Remove-Item -LiteralPath $download }
    }
}

if (-not $Check -and -not $Install) { $Check = $true }
if ($Install) {
    $arch = $env:PROCESSOR_ARCHITECTURE
    $build = [Environment]::OSVersion.Version.Build
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT -or
        -not (($arch -eq 'AMD64' -and $build -ge 17763) -or ($arch -eq 'ARM64' -and $build -ge 22000))) {
        throw 'É necessário Windows 10 1809+ x64 ou Windows 11 x64/ARM64.'
    }
    Refresh-ProcessPath
    if (-not (Get-Python311)) { Install-WingetPackage 'Python.Python.3.11' 'x64' }
    if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { Install-WingetPackage 'OpenJS.NodeJS.LTS' }
    if (-not (Has-DeviceAuth)) {
        $npm = Get-Command npm.cmd -ErrorAction Stop
        & $npm.Source install -g '@openai/codex'
        if ($LASTEXITCODE -ne 0) { throw 'Não foi possível instalar o Codex CLI.' }
        Refresh-ProcessPath
    }
    if (-not (Has-WebView2)) { Install-WebView2 }
    if (-not (Has-VCRuntime)) { Install-WingetPackage 'Microsoft.VCRedist.2015+.x64' }
    $python = Get-Python311
    if (-not $python) { throw 'Python 3.11 indisponível após a instalação. Abra outro PowerShell e execute novamente.' }
    if (-not (Test-Path $venvPython)) {
        New-Item -ItemType Directory -Path $appDir -Force | Out-Null
        & $python -m venv (Join-Path $appDir 'venv')
        if ($LASTEXITCODE -ne 0) { throw 'Não foi possível criar o ambiente Python do app.' }
    }
    if (-not (Has-Packages)) {
        & $venvPython -m pip install --disable-pip-version-check -r (Join-Path $scriptDir 'requirements-windows.txt')
        if ($LASTEXITCODE -ne 0) { throw 'Não foi possível instalar os pacotes Python do app.' }
    }
    if (-not (Has-Model)) {
        $freeBytes = [System.IO.DriveInfo]::new($env:SystemDrive).AvailableFreeSpace
        if ($freeBytes -lt 4GB) { throw 'Separe pelo menos 4 GiB livres para o modelo de voz e o app.' }
        & $venvPython (Join-Path $scriptDir 'windows_model.py') --install
        if ($LASTEXITCODE -ne 0) { throw 'Não foi possível baixar o modelo Whisper.' }
    }
}
if (-not (Report)) { exit 1 }
Write-Host 'Bootstrap concluído. Windows pronto para instalar o app.'

exit 0
