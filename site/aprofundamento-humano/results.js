function AgentFlixMountAssessmentResults(options) {
  const { root = document, life = window.AgentFlixRouteLife.create(), header = document.querySelector('header'), routeURL = new URL(location.href) } = options || {};
  "use strict";
  const status = root.getElementById("results-status");
  const actions = root.getElementById("results-actions");
  const list = root.getElementById("results-list");
  const localList = root.getElementById("results-local");
  const states = new Map(), mounts = new Map();
  let client, store, userId = null, rows = [], available = false, more = false, requestVersion = 0;
  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const button = (label, fn, kind = "secondary") => {
    const b = node("button", "af-button af-button--" + kind, label);
    b.type = "button"; life.listen(b, "click", fn); return b;
  };
  function loginLink() {
    const link = node("a", "af-button af-button--primary", "Entrar para salvar");
    link.href = "/entrar/?next=" + encodeURIComponent("/aprofundamento-humano/#meus-resultados");
    link.target = "_blank"; link.rel = "noopener";
    link.setAttribute("aria-label", "Entrar para salvar (abre outra aba)");
    return link;
  }
  function key(base) { return userId ? base + ":user:" + userId : base; }
  function clearOwnedSession() {
    try {
      Object.keys(sessionStorage).filter(k => /^agentflix-(disc-v1|assessment-.*):user:/.test(k)).forEach(k => sessionStorage.removeItem(k));
    } catch (_) { /* O histórico remoto permanece na conta. */ }
  }
  function date(record) {
    if (!record.completed_at) return "Data de conclusão desconhecida";
    const completed = new Date(record.completed_at);
    try { return completed.toLocaleString("pt-BR", { timeZone: record.timezone || undefined }); }
    catch (_) { return completed.toLocaleString("pt-BR"); }
  }
  function renderMount(container, record) {
    container.replaceChildren();
    container.className = "result-save-state";
    container.dataset.clarityMask = "true";
    const label = node("p", "", ""); label.setAttribute("role", "status");
    container.append(label);
    if (!available) {
      label.textContent = "Não foi possível conectar à sua conta. Este resultado continua nesta aba; copie ou baixe antes de sair.";
      container.append(button("Reconectar", () => location.reload())); return;
    }
    if (!userId) {
      label.textContent = "Entre para guardar este resultado na sua conta. Depois do login, volte a esta aba e escolha salvar.";
      container.append(loginLink()); return;
    }
    const state = states.get(record.id);
    label.textContent = state === "saved" ? "Resultado salvo na sua conta. Você pode consultá-lo em outro dispositivo." : state === "saving" ? "Salvando resultado na sua conta…" : state === "error" ? "Não foi possível salvar. Seu resultado continua nesta aba; tente novamente." : "Este resultado está nesta aba. Salve para consultar depois na sua conta.";
    if (state !== "saved") {
      const save = button(state === "error" ? "Tentar salvar novamente" : "Salvar na minha conta", () => saveRecord(record), "primary");
      save.disabled = state === "saving"; container.append(save);
    }
  }
  function updateMounts() {
    for (const [container, record] of mounts) {
      if (!container.isConnected) mounts.delete(container);
      else renderMount(container, record);
    }
  }
  async function saveRecord(record) {
    if (!userId || !store || states.get(record.id) === "saving") return;
    const owner = userId;
    states.set(record.id, "saving"); updateMounts();
    try {
      await store.save(record);
      if (owner !== userId) return;
      states.set(record.id, "saved"); updateMounts();
      await refresh();
    } catch (_) {
      if (owner !== userId) return;
      states.set(record.id, "error"); updateMounts();
    }
  }
  function mount(container, record, completed = false) {
    mounts.set(container, record); renderMount(container, record);
    if (completed && userId && available) void saveRecord(record);
  }
  function card(record, saved) {
    const details = node("details", "result-history-item af-panel");
    const summary = node("summary");
    summary.append(node("strong", "", record.assessment.title), node("span", "af-type-caption", date(record)));
    details.append(summary);
    const content = node("div", "result-history-body");
    content.append(node("p", "result-lede", record.assessment.summary), node("p", "metric-note", record.assessment.metric));
    const scores = node("dl", "result-history-scores");
    record.assessment.dimensions.forEach(d => {
      const row = node("div");
      row.append(node("dt", "", d.label), node("dd", "", d.value.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + (d.unit === "independent_scale_0_100" ? "/100" : "%")), node("dd", "af-type-caption", d.interpretation));
      scores.append(row);
    });
    content.append(scores, node("p", "metric-note", record.assessment.limitations));
    const controls = node("div", "result-history-actions");
    const prompt = button("Levar para meu agente", () => window.AgentFlixAgentPromptUI.open(record, prompt));
    controls.append(prompt);
    if (saved) {
      const remove = button("Excluir resultado", () => { confirm.hidden = false; confirm.querySelector("button").focus(); }, "text");
      const confirm = node("div", "result-delete-confirm"); confirm.hidden = true;
      confirm.append(node("p", "", "Excluir este resultado da sua conta? Essa ação não pode ser desfeita."));
      const confirmButton = button("Confirmar exclusão", async () => {
        const owner = userId; confirmButton.disabled = true;
        try {
          await store.remove(record.id);
          if (owner !== userId) return;
          states.delete(record.id); updateMounts(); await refresh();
          root.getElementById("results-title").focus();
        } catch (_) {
          if (owner !== userId) return;
          confirmButton.disabled = false;
          confirm.querySelector("p").textContent = "Não foi possível excluir. Tente novamente.";
        }
      });
      confirm.append(confirmButton, button("Cancelar", () => { confirm.hidden = true; remove.focus(); }, "text"));
      controls.append(remove); content.append(controls, confirm);
    } else {
      content.append(controls);
      const save = node("div"); content.append(save); mount(save, record);
    }
    details.append(content); return details;
  }
  function localRecords() {
    const records = [];
    // Resultados anônimos/legados só saem desta aba por uma ação explícita de salvar.
    try {
      Object.keys(sessionStorage).filter(k => {
        const base = userId && k.endsWith(":user:" + userId) ? k.slice(0, -(":user:" + userId).length) : k;
        return base === "agentflix-disc-v1" || /^agentflix-assessment-[a-z-]+-v\d+$/.test(base);
      }).forEach(k => {
        try {
          const state = JSON.parse(sessionStorage.getItem(k));
          if (!(state.result || state.screen === "result")) return;
          let record = state.agentRecord;
          if (!record) {
            let descriptor;
            if (k.startsWith("agentflix-disc-v1")) {
              const data = window.AgentFlixDiscData;
              const scores = window.AgentFlixDiscModel.score(data.questions, state.answers, data.weights);
              descriptor = window.AgentFlixAgentPrompt.disc(data, scores);
            } else {
              const id = k.match(/^agentflix-assessment-(.+)-v\d+/)[1];
              const test = window.AgentFlixAssessments[id], model = window.AgentFlixAssessmentModel;
              if (!test || state.version !== test.version) return;
              descriptor = window.AgentFlixAgentPrompt.assessment(test, model.score(test, state.answers), model);
            }
            record = window.AgentFlixAgentPrompt.ensure(state, descriptor, state.answers, false);
            sessionStorage.setItem(k, JSON.stringify(state));
          }
          if (record && states.get(record.id) !== "saved") records.push(window.AgentFlixAssessmentStore.project(record));
        } catch (_) { /* Um registro local inválido não bloqueia o histórico. */ }
      });
    } catch (_) { /* Armazenamento da aba indisponível. */ }
    return records;
  }
  function renderLocals() {
    localList.replaceChildren();
    if (!userId) return;
    const records = localRecords();
    if (!records.length) return;
    localList.append(node("h3", "", "Resultados nesta aba"), node("p", "metric-note", "Confirme quais resultados são seus antes de salvá-los na conta."));
    records.forEach(record => localList.append(card(record, false)));
  }
  async function refresh(append = false) {
    if (!userId || !store) return;
    const owner = userId, version = ++requestVersion; actions.replaceChildren();
    status.textContent = "Carregando seus resultados…";
    try {
      const loaded = await store.list(append ? rows.length : 0);
      if (owner !== userId || version !== requestVersion) return;
      rows = append ? rows.concat(loaded) : loaded;
      more = loaded.length === 20;
      rows.forEach(row => states.set(row.record_id, "saved"));
      list.replaceChildren(...rows.map(row => card(row.result, true)));
      status.textContent = rows.length ? "Resultados privados da sua conta. Abra um item para consultar ou levar ao seu agente." : "Você ainda não tem resultados salvos. Ao concluir um assessment com login, o resultado será salvo aqui.";
      if (more) actions.append(button("Carregar mais resultados", () => refresh(true)));
      updateMounts(); renderLocals();
    } catch (_) {
      if (owner !== userId) return;
      if (version !== requestVersion) return;
      status.textContent = "Não foi possível carregar os resultados salvos. Tente novamente.";
      actions.append(button("Tentar novamente", () => refresh()));
    }
  }
  function loadSupabase() {
    if (window.supabase?.createClient) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/dist/umd/supabase.min.js";
      const timer = life.timeout(() => reject(Error("auth timeout")), 8000);
      script.onload = () => { clearTimeout(timer); resolve(); };
      script.onerror = () => { clearTimeout(timer); reject(Error("auth unavailable")); };
      document.head.append(script);
    });
  }
  async function initialize() {
    try {
      const response = await fetch("/api/config", { cache: "no-store", signal: AbortSignal.any([life.signal, AbortSignal.timeout(8000)]) });
      if (!response.ok) throw Error("config unavailable");
      const config = await response.json();
      if (!config.supabaseUrl || !config.supabaseAnonKey) throw Error("auth unavailable");
      await loadSupabase();
      client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
      life.onDispose(() => client.auth.stopAutoRefresh?.());
      const { data, error } = await client.auth.getSession();
      if (life.signal.aborted) return;
      if (error) throw error;
      userId = data.session?.user?.id || null; available = true;
      store = window.AgentFlixAssessmentStore.create(client, () => userId);
      const subscription = client.auth.onAuthStateChange((_event, session) => {
        const next = session?.user?.id || null;
        if (next === userId) return;
        userId = next;
        clearOwnedSession(); states.clear(); rows = [];
        // Interrompe a exibição e operações da identidade anterior, inclusive em outra aba.
        root.querySelector("#agent-prompt-dialog")?.close();
        root.getElementById("disc").hidden = true;
        root.getElementById("assessment-hub").hidden = true;
        list.replaceChildren(); localList.replaceChildren();
        location.reload();
      });
      life.onDispose(() => { requestVersion++; userId = null; states.clear(); mounts.clear(); rows = []; subscription.data?.subscription?.unsubscribe(); client.auth.stopAutoRefresh?.(); });
      if (userId) void refresh();
      else {
        status.textContent = "Entre para salvar e consultar seus resultados em qualquer dispositivo. Respostas individuais ficam apenas nesta aba.";
        actions.append(loginLink());
      }
    } catch (_) {
      if (life.signal.aborted) return;
      status.textContent = "Não foi possível conectar à conta. Você pode responder e copiar seu resultado nesta aba.";
      actions.append(button("Reconectar", () => location.reload()));
    }
  }
  const ready = initialize();
  window.AgentFlixAssessmentResults = Object.freeze({ ready, key, mount });
  return window.AgentFlixAssessmentResults;
}
window.AgentFlixMountAssessmentResults = AgentFlixMountAssessmentResults;
if (!window.AgentFlixShellEntry && !window.AgentFlixProductShell && document.getElementById('results-list')) AgentFlixMountAssessmentResults();
