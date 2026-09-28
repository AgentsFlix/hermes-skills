#!/usr/bin/env python3
"""Install the local transcriber as a macOS app and CLI."""
import argparse
from pathlib import Path
import plistlib
import shutil
import subprocess
import sys
import tempfile

from bootstrap import ensure

ROOT = Path(__file__).resolve().parents[1]
HOME = Path.home()
DATA = HOME / "Library/Application Support/Transcritor Codex"
APP = HOME / "Desktop/Transcritor AgentFlix.app"


def create_icon(destination):
    """Render the packaged AgentFlix vector as a native macOS app icon."""
    with tempfile.TemporaryDirectory(prefix="transcritor-icon-") as temporary:
        iconset = Path(temporary) / "AgentFlix.iconset"
        iconset.mkdir()
        master = Path(temporary) / "master.png"
        subprocess.run(["sips", "-s", "format", "png", "-z", "1024", "1024",
                        str(ROOT / "assets/agentflix-mark.svg"), "--out", str(master)],
                       check=True, stdout=subprocess.DEVNULL)
        for points in (16, 32, 128, 256, 512):
            for scale in (1, 2):
                pixels = points * scale
                name = f"icon_{points}x{points}{'@2x' if scale == 2 else ''}.png"
                subprocess.run(["sips", "-z", str(pixels), str(pixels), str(master),
                                "--out", str(iconset / name)], check=True, stdout=subprocess.DEVNULL)
        subprocess.run(["iconutil", "-c", "icns", str(iconset), "-o", str(destination)],
                       check=True, stdout=subprocess.DEVNULL)


def install():
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-deps", action="store_true", help="Do not install or download dependencies")
    args = parser.parse_args()
    ensure(install=not args.no_deps)
    DATA.mkdir(parents=True, exist_ok=True)
    for name in ("transcritor.py", "index.html", "agentflix-logo.svg", "agentflix-mark.svg",
                 "escolher-arquivo.webp", "colar-youtube.webp",
                 "archivo-regular.ttf", "archivo-bold.ttf", "archivo-OFL.txt",
                 "onboarding-como-acessar.mp4", "onboarding-logar-codex.mp4"):
        shutil.copy2(ROOT / "assets" / name, DATA / name)
    executable = APP / "Contents/MacOS/TranscritorApp"
    executable.parent.mkdir(parents=True, exist_ok=True)
    (executable.parent / "launch").unlink(missing_ok=True)
    resources = APP / "Contents/Resources"
    resources.mkdir(parents=True, exist_ok=True)
    create_icon(resources / "AgentFlix.icns")
    plist = {
        "CFBundleName": "Transcritor AgentFlix",
        "CFBundleDisplayName": "Transcritor AgentFlix",
        "CFBundleIdentifier": "ai.agentsflix.transcritor",
        "CFBundleVersion": "1.2.0",
        "CFBundleShortVersionString": "1.2.0",
        "CFBundleExecutable": "TranscritorApp",
        "CFBundleIconFile": "AgentFlix.icns",
        "CFBundlePackageType": "APPL",
        "LSMinimumSystemVersion": "12.0",
        "NSAppTransportSecurity": {"NSAllowsLocalNetworking": True},
    }
    with (APP / "Contents/Info.plist").open("wb") as target:
        plistlib.dump(plist, target)
    subprocess.run(["swiftc", "-O", "-framework", "AppKit", "-framework", "WebKit",
                    str(ROOT / "assets/TranscritorApp.swift"), "-o", str(executable)], check=True)
    executable.chmod(0o755)
    print(f"Instalado: {APP}")
    print(f"CLI: python3 '{DATA / 'transcritor.py'}' transcribe arquivo.mp4 -o transcricao.md")


if __name__ == "__main__":
    try:
        install()
    except (RuntimeError, OSError, subprocess.CalledProcessError) as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        sys.exit(1)
