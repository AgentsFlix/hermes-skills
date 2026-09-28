function AgentFlixMountAgent(options) {
  const { root = document, life = window.AgentFlixRouteLife.create(), header = document.querySelector('header'), routeURL = new URL(location.href) } = options || {};
  "use strict";

  const prompt = root.getElementById("agent-prompt");
  const status = root.getElementById("copy-status");
  const tabs = [...root.querySelectorAll("[data-target]")];
  const fallbackTargets = {
    codex: { label: "Codex", install_field: "npx_codex", verification: "Confirme a skill em ~/.agents/skills e abra uma nova sessão." },
    "claude-code": { label: "Claude Code", install_field: "npx_claude_code", verification: "Confirme a skill no diretório informado pelo instalador e abra uma nova sessão." },
    hermes: { label: "Hermes", install_field: "install_cmd", verification: "Confirme a skill na pasta ~/.hermes/skills e abra uma nova sessão." },
    research: { label: "Pesquisa / sem terminal", kind: "read_only", artifact_field: "prompt_url", verification: "Confirme que abriu e leu o artefato, localizou Procedure e Verification e mantenha installed=false. Se não puder abrir, entregue a URL para handoff e pare." },
    chatgpt: { label: "ChatGPT", install_field: "zip_url", fallback_field: "prompt_url", verification: "Confirme que a skill aparece no produto ou que o arquivo colável foi anexado ao Project." },
    other: { label: "Outros agentes", install_field: "npx_any", verification: "Confirme a pasta de destino informada pelo instalador e abra uma nova sessão." }
  };
  let targets = fallbackTargets;

  async function copyPrompt() {
    const text = prompt.textContent.trim();
    let copied = false;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API indisponível");
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch (_) {
      const range = document.createRange();
      range.selectNodeContents(prompt);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      copied = document.execCommand("copy");
      selection.removeAllRanges();
    }
    status.textContent = copied
      ? "Prompt copiado. Cole na conversa com seu agente."
      : "Não foi possível copiar automaticamente. Selecione o texto do prompt e copie manualmente.";
  }

  function selectTarget(id, focus = false) {
    const target = targets[id] || fallbackTargets[id];
    const primaryField = target.install_field || target.artifact_field;
    tabs.forEach((tab) => {
      const selected = tab.dataset.target === id;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
    });
    root.getElementById("target-label").textContent = target.label;
    root.getElementById("target-title").textContent = target.kind === "read_only" ? "Uso sem instalação" : target.kind === "upload_or_project" ? "Upload ou Project" : "Instalação por skill";
    root.getElementById("target-field").textContent = target.fallback_field ? `${primaryField} ou ${target.fallback_field}` : primaryField;
    root.getElementById("target-description").innerHTML = target.kind === "read_only"
      ? `O agente lê <code>${primaryField}</code>. Se não conseguir abrir o artefato, entrega a URL para handoff e para sem improvisar.`
      : target.fallback_field
        ? `O prompt usa <code>${primaryField}</code> quando o formato principal estiver disponível e <code>${target.fallback_field}</code> como alternativa.`
        : `O prompt escolhe a skill e copia o campo <code>${primaryField}</code> do catálogo.`;
    root.getElementById("target-verification").textContent = target.verification;
  }

  life.listen(root.querySelector("[data-copy=prompt]"), "click", copyPrompt);
  tabs.forEach((tab, index) => {
    life.listen(tab, "click", () => selectTarget(tab.dataset.target));
    life.listen(tab, "keydown", (event) => {
      if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      selectTarget(tabs[next].dataset.target, true);
    });
  });

  window.AgentFlixMetrics?.record('reading_mode', null, {mode:'agent'});
  const ready = fetch("/para-agente/manifest.json", { cache: "no-cache", signal: life.signal })
    .then((response) => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
    .then((manifest) => {
      if (life.signal.aborted) return;
      targets = Object.fromEntries(manifest.targets.map((target) => [target.id, target]));
      selectTarget("codex");
    })
    .catch(() => {
      if (life.signal.aborted) return;
      status.textContent = "O manifesto não carregou. O prompt continua disponível nesta página.";
    });
  return { ready, dispose: () => life.dispose() };
}
window.AgentFlixMountAgent = AgentFlixMountAgent;
if (!window.AgentFlixShellEntry && !window.AgentFlixProductShell && document.getElementById('agent-prompt')) AgentFlixMountAgent();
