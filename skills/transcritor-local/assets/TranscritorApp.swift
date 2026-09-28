import AppKit
import WebKit

final class TranscritorApp: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var server: Process?

    func applicationDidFinishLaunching(_ notification: Notification) {
        installEditMenu()
        let configuration = WKWebViewConfiguration()
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.setValue(false, forKey: "drawsBackground")

        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1120, height: 820),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable],
                          backing: .buffered, defer: false)
        window.title = "Transcritor AgentFlix"
        window.minSize = NSSize(width: 390, height: 560)
        window.contentView = webView
        window.delegate = self
        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        startServer()
    }

    private func installEditMenu() {
        let mainMenu = NSMenu()
        let appItem = NSMenuItem()
        let appMenu = NSMenu(title: "Transcritor AgentFlix")
        appMenu.addItem(NSMenuItem(title: "Sair do Transcritor AgentFlix", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        appItem.submenu = appMenu
        mainMenu.addItem(appItem)

        let editItem = NSMenuItem()
        let editMenu = NSMenu(title: "Editar")
        for (title, action, key, modifiers) in [
            ("Copiar", Selector(("copy:")), "c", NSEvent.ModifierFlags.command),
            ("Colar", Selector(("paste:")), "v", NSEvent.ModifierFlags.command),
            ("Selecionar tudo", Selector(("selectAll:")), "a", NSEvent.ModifierFlags.command),
            ("Copiar com Ctrl+C", Selector(("copy:")), "c", NSEvent.ModifierFlags.control),
            ("Colar com Ctrl+V", Selector(("paste:")), "v", NSEvent.ModifierFlags.control)
        ] {
            let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
            item.keyEquivalentModifierMask = modifiers
            editMenu.addItem(item)
        }
        editItem.submenu = editMenu
        mainMenu.addItem(editItem)
        NSApp.mainMenu = mainMenu
    }

    private func startServer() {
        let home = FileManager.default.homeDirectoryForCurrentUser
        let script = home.appendingPathComponent("Library/Application Support/Transcritor Codex/transcritor.py").path
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/python3")
        process.arguments = [script, "serve", "--no-browser"]
        var environment = ProcessInfo.processInfo.environment
        environment["PATH"] = "/opt/homebrew/bin:/usr/local/bin:/Applications/ChatGPT.app/Contents/Resources:" + (environment["PATH"] ?? "")
        process.environment = environment
        let output = Pipe()
        process.standardOutput = output
        process.standardError = output
        server = process
        do {
            try process.run()
        } catch {
            showError("Não foi possível iniciar o transcritor local.")
            return
        }
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            var line = Data()
            while let byte = try? output.fileHandleForReading.read(upToCount: 1), !byte.isEmpty {
                if byte[0] == 10 {
                    if let raw = String(data: line, encoding: .utf8), raw.hasPrefix("http://127.0.0.1:"),
                       let url = URL(string: raw.trimmingCharacters(in: .whitespacesAndNewlines)) {
                        DispatchQueue.main.async { self?.webView.load(URLRequest(url: url)) }
                        return
                    }
                    line.removeAll(keepingCapacity: true)
                } else if line.count < 4096 {
                    line.append(byte[0])
                }
            }
            DispatchQueue.main.async { self?.showError("O servidor local não iniciou. Execute a skill novamente para verificar as dependências.") }
        }
    }

    private func showError(_ message: String) {
        let alert = NSAlert()
        alert.messageText = "Transcritor AgentFlix"
        alert.informativeText = message
        alert.alertStyle = .warning
        alert.runModal()
    }

    func windowWillClose(_ notification: Notification) { NSApp.terminate(nil) }
    func applicationWillTerminate(_ notification: Notification) {
        if let server, server.isRunning { server.terminate() }
    }

    private func isLocal(_ url: URL) -> Bool {
        url.host == "127.0.0.1" && url.scheme == "http"
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if navigationAction.shouldPerformDownload {
            decisionHandler(.download)
        } else if let url = navigationAction.request.url, !isLocal(url) {
            if url.scheme == "https" { NSWorkspace.shared.open(url) }
            decisionHandler(.cancel)
        } else {
            decisionHandler(.allow)
        }
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, url.scheme == "https" { NSWorkspace.shared.open(url) }
        return nil
    }

    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.beginSheetModal(for: window) { response in
            completionHandler(response == .OK ? panel.urls : nil)
        }
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse,
                  suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = suggestedFilename.lowercased().hasSuffix(".md")
            ? suggestedFilename : suggestedFilename + ".md"
        panel.beginSheetModal(for: window) { result in
            completionHandler(result == .OK ? panel.url : nil)
        }
    }
}

let application = NSApplication.shared
let delegate = TranscritorApp()
application.delegate = delegate
application.setActivationPolicy(.regular)
application.run()
