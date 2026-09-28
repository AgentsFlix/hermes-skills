param([switch]$NoDeps)
$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$skillDir = Split-Path -Parent $scriptDir
$assets = Join-Path $skillDir 'assets'
$appDir = Join-Path $env:LOCALAPPDATA 'Transcritor AgentFlix'
$venvPython = Join-Path $appDir 'venv\Scripts\python.exe'
$bootstrap = Join-Path $scriptDir 'bootstrap_windows.ps1'

if ($NoDeps) { & $bootstrap -Check } else { & $bootstrap -Install }
if ($LASTEXITCODE -ne 0) { throw 'Bootstrap incompleto. Corrija os itens FALTA antes de criar o app.' }

$arguments = @(
    '--noconfirm', '--clean', '--onefile', '--windowed',
    '--name', 'Transcritor AgentFlix',
    '--icon', (Join-Path $assets 'agentflix.ico'),
    '--paths', $assets,
    '--distpath', (Join-Path $appDir 'dist'),
    '--workpath', (Join-Path $appDir 'build'),
    '--specpath', $appDir,
    '--hidden-import', 'webview.platforms.edgechromium',
    '--collect-all', 'imageio_ffmpeg',
    '--collect-all', 'faster_whisper',
    '--collect-all', 'webview'
)
foreach ($name in @('index.html', 'agentflix-logo.svg', 'agentflix-mark.svg',
                    'escolher-arquivo.webp', 'colar-youtube.webp',
                    'archivo-regular.ttf', 'archivo-bold.ttf', 'archivo-OFL.txt',
                    'onboarding-como-acessar.mp4', 'onboarding-logar-codex.mp4')) {
    $arguments += @('--add-data', "$(Join-Path $assets $name);.")
}
$arguments += (Join-Path $assets 'TranscritorAppWindows.py')
& $venvPython -m PyInstaller @arguments
if ($LASTEXITCODE -ne 0) { throw 'Falha ao compilar o aplicativo Windows.' }

$source = Join-Path $appDir 'dist\Transcritor AgentFlix.exe'
$desktop = [Environment]::GetFolderPath('DesktopDirectory')
if (-not $desktop -or -not (Test-Path $desktop)) { throw 'Não foi possível localizar a Área de Trabalho.' }
$destination = Join-Path $desktop 'Transcritor AgentFlix.exe'
Copy-Item -LiteralPath $source -Destination $destination -Force
Write-Host "App criado: $destination"
Write-Host 'Abra o executável na Área de Trabalho. O login /device e a transcrição rodam na janela do app.'
