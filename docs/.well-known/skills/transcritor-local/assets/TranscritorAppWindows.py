"""Windows desktop window for the shared local transcriber."""
import ctypes
from pathlib import Path
import re
import threading
import webbrowser
from urllib.parse import urlparse

def error_box(message):
    ctypes.windll.user32.MessageBoxW(None, message, "Transcritor AgentFlix", 0x10)


class Bridge:
    def open_url(self, value):
        parsed = urlparse(value)
        allowed = ((parsed.hostname == "agentsflix.ai" and parsed.path in ("", "/")) or
                   (parsed.hostname == "chatgpt.com" and parsed.path in ("", "/")) or
                   (parsed.hostname == "auth.openai.com" and parsed.path == "/codex/device"))
        if parsed.scheme != "https" or not allowed or parsed.username or parsed.password:
            return False
        return webbrowser.open(value)

    def save_markdown(self, text, filename):
        if not isinstance(text, str) or len(text) > 50_000_000:
            raise ValueError("Transcrição inválida.")
        safe = re.sub(r'[<>:"/\\|?*]', "-", str(filename or "transcricao"))[:100].strip(" .")
        if not safe.lower().endswith(".md"):
            safe += ".md"
        if safe.lower() == ".md" or re.fullmatch(r"(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])", safe.split(".")[0], re.I):
            safe = "transcricao.md"
        downloads = Path.home() / "Downloads"
        downloads.mkdir(parents=True, exist_ok=True)
        base = Path(safe)
        for number in range(1000):
            name = safe if number == 0 else f"{base.stem} ({number}).md"
            path = downloads / name
            try:
                with path.open("x", encoding="utf-8") as target:
                    target.write(text)
                return name
            except FileExistsError:
                continue
        raise RuntimeError("Não há nome disponível na pasta Downloads.")


def main():
    try:
        import transcritor
        transcritor.doctor()
        import webview
    except Exception as exc:
        error_box(str(exc))
        return 1

    ready = threading.Event()
    outcome = {}

    def run_server():
        try:
            transcritor.serve(open_browser=False, on_ready=lambda url: (outcome.update(url=url), ready.set()))
        except Exception as exc:
            outcome["error"] = str(exc)
            ready.set()

    threading.Thread(target=run_server, name="transcritor-local", daemon=True).start()
    if not ready.wait(20) or "url" not in outcome:
        error_box(outcome.get("error", "O servidor local não iniciou."))
        return 1

    bridge = Bridge()
    webview.create_window(
        "Transcritor AgentFlix", outcome["url"], js_api=bridge,
        width=1120, height=820, min_size=(390, 560), background_color="#141414",
    )
    try:
        webview.start(gui="edgechromium")
    except Exception as exc:
        error_box("Não foi possível abrir a janela WebView2: " + str(exc))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
