#!/usr/bin/env python3
"""Check and prepare a Mac for Transcritor Codex before app installation."""
import argparse
import hashlib
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import tempfile
import urllib.request

HOME = Path.home()
MODEL_DIR = HOME / ".cache/whisper-cpp"
FULL_MODEL = MODEL_DIR / "ggml-large-v3-turbo.bin"
SMALL_MODEL = MODEL_DIR / "ggml-large-v3-turbo-q5_0.bin"
MODEL_URL = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin"
MODEL_SHA1 = "e050f7970618a659205450ad97eb95a18d69c9ee"
HOMEBREW_URL = "https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh"


def sha1(path):
    digest = hashlib.sha1()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def tool_path(name):
    paths = ["/opt/homebrew/bin", "/usr/local/bin", "/Applications/ChatGPT.app/Contents/Resources"]
    search_path = os.pathsep.join(paths + [os.environ.get("PATH", "")])
    return shutil.which(name, path=search_path)


def model_ready():
    override = os.environ.get("WHISPER_MODEL")
    if override:
        path = Path(override).expanduser()
        return path if path.is_file() and path.stat().st_size > 100_000_000 else None
    if FULL_MODEL.is_file() and FULL_MODEL.stat().st_size > 100_000_000:
        return FULL_MODEL
    if SMALL_MODEL.is_file():
        if sha1(SMALL_MODEL) != MODEL_SHA1:
            raise RuntimeError(f"Modelo em cache falhou na verificação: {SMALL_MODEL}")
        return SMALL_MODEL
    return None


def report():
    mac = sys.platform == "darwin"
    python = sys.version_info >= (3, 9)
    arch = platform.machine() in ("arm64", "x86_64")
    brew = bool(tool_path("brew"))
    ffmpeg = bool(tool_path("ffmpeg"))
    whisper = bool(tool_path("whisper-cli"))
    youtube = bool(tool_path("yt-dlp"))
    codex = bool(tool_path("codex"))
    swift = bool(tool_path("swiftc"))
    model = model_ready()
    device_auth = False
    if codex:
        help_text = subprocess.run([tool_path("codex"), "login", "--help"], capture_output=True, text=True, timeout=20)
        device_auth = help_text.returncode == 0 and "--device-auth" in help_text.stdout
    checks = [("macOS", mac), ("CPU compatível", arch), ("Python 3.9+", python),
              ("Homebrew", brew), ("ffmpeg", ffmpeg), ("whisper-cli", whisper), ("yt-dlp", youtube),
              ("Codex CLI com /device", codex and device_auth), ("Compilador Swift", swift),
              ("Modelo Whisper", bool(model))]
    for label, okay in checks:
        print(f"{'OK' if okay else 'FALTA'}  {label}")
    return all(okay for _, okay in checks)


def ensure(install=False):
    if sys.platform != "darwin" or platform.machine() not in ("arm64", "x86_64"):
        raise RuntimeError("Este app requer um Mac Intel ou Apple Silicon.")
    if sys.version_info < (3, 9):
        raise RuntimeError("Python 3.9 ou superior é necessário.")
    brew = tool_path("brew")
    if not brew:
        if not install:
            raise RuntimeError("Homebrew ausente. Execute o bootstrap com --install.")
        print("Instalando Homebrew pelo instalador oficial. O macOS pode solicitar confirmação local.", flush=True)
        with tempfile.TemporaryDirectory(prefix="transcritor-bootstrap-") as directory:
            script = Path(directory) / "install-homebrew.sh"
            urllib.request.urlretrieve(HOMEBREW_URL, script)
            subprocess.run(["/bin/bash", str(script)], check=True)
        brew = tool_path("brew")
        if not brew:
            raise RuntimeError("Homebrew não ficou disponível após a instalação.")
    for tool, package in (("ffmpeg", "ffmpeg"), ("whisper-cli", "whisper-cpp"), ("yt-dlp", "yt-dlp")):
        if not tool_path(tool):
            if not install:
                raise RuntimeError(f"{tool} ausente. Execute o bootstrap com --install.")
            print(f"Instalando {package}…", flush=True)
            subprocess.run([brew, "install", package], check=True)
    if not tool_path("codex"):
        if not install:
            raise RuntimeError("Codex CLI ausente. Execute o bootstrap com --install.")
        print("Instalando Codex CLI…", flush=True)
        subprocess.run([brew, "install", "--cask", "codex"], check=True)
    if not tool_path("swiftc"):
        if install:
            subprocess.run(["xcode-select", "--install"], check=False)
        raise RuntimeError("Compilador Swift ausente. Conclua a instalação das Command Line Tools do macOS e execute o bootstrap novamente.")
    if not model_ready():
        if not install:
            raise RuntimeError("Modelo Whisper ausente. Execute o bootstrap com --install.")
        free = shutil.disk_usage(HOME).free
        if free < 1024 ** 3:
            raise RuntimeError("É necessário pelo menos 1 GiB livre para o modelo Whisper.")
        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        print("Baixando modelo Whisper multilíngue (~547 MiB)…", flush=True)
        partial = SMALL_MODEL.with_suffix(".part")
        try:
            urllib.request.urlretrieve(MODEL_URL, partial)
            if sha1(partial) != MODEL_SHA1:
                raise RuntimeError("Hash do modelo Whisper não confere.")
            partial.replace(SMALL_MODEL)
        finally:
            partial.unlink(missing_ok=True)
    if not report():
        raise RuntimeError("Bootstrap incompleto; veja os itens marcados FALTA.")
    print("Bootstrap concluído. Mac pronto para instalar o app.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Bootstrap do Transcritor Codex")
    parser.add_argument("--check", action="store_true", help="Somente verificar, sem instalar")
    parser.add_argument("--install", action="store_true", help="Instalar dependências ausentes")
    args = parser.parse_args()
    try:
        if args.check:
            sys.exit(0 if report() else 1)
        ensure(install=args.install)
    except (RuntimeError, OSError, subprocess.CalledProcessError) as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        sys.exit(1)
