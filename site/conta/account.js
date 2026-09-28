import { profileErrorMessage, validateProfile } from "./profile-utils.mjs";

const byId = (id) => document.getElementById(id);
const states = ["loading", "signed-out", "account", "unavailable"];
let client = null;
let currentUser = null;
let loadSequence = 0;

function show(name) {
  states.forEach((state) => { byId(`${state}-state`).hidden = state !== name; });
}

function setStatus(message = "", tone = "error") {
  const status = byId("form-status");
  status.textContent = message;
  status.dataset.tone = message ? tone : "";
}

function fillProfile(profile, user) {
  byId("email").value = profile.email || user.email || "";
  byId("name").value = profile.name || "";
  byId("phone").value = profile.phone || "";
  byId("admin-access-link").hidden = profile.role !== "admin";
  byId("admin-metrics-link").hidden = profile.role !== "admin";
  setStatus();
}

function setAccessStatus(message = "", tone = "") {
  const status = byId("access-status");
  status.textContent = message;
  status.dataset.tone = tone;
}

function accessMeta(grant) {
  if (!grant.expires_at) return "Acesso ativo";
  const date = new Date(grant.expires_at);
  if (Number.isNaN(date.getTime())) return "Acesso ativo";
  return `Válido até ${new Intl.DateTimeFormat("pt-BR").format(date)}`;
}

function renderAccesses(grants, products) {
  const list = byId("access-list");
  list.replaceChildren();
  const grantByProduct = new Map();
  grants.forEach((grant) => {
    if (!grantByProduct.has(grant.product_id)) grantByProduct.set(grant.product_id, grant);
  });

  products.forEach((product) => {
    const card = document.createElement("article");
    card.className = "access-card";
    const copy = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = product.title;
    const meta = document.createElement("p");
    meta.textContent = accessMeta(grantByProduct.get(product.id) || {});
    const link = document.createElement("a");
    link.className = "access-open";
    link.href = product.kind === "pass"
      ? "/"
      : product.id === "assistir"
        ? "/assistir/"
        : `/acesso/?produto=${encodeURIComponent(product.id)}`;
    link.textContent = product.kind === "pass" ? "Ver catálogo" : product.id === "assistir" ? "Abrir Assistir" : "Abrir conteúdo";
    copy.append(title, meta);
    card.append(copy, link);
    list.append(card);
  });

  list.hidden = products.length === 0;
  setAccessStatus(products.length ? "" : "Você ainda não tem conteúdos liberados nesta conta.");
}

async function loadAccesses() {
  byId("access-list").hidden = true;
  byId("access-retry-button").hidden = true;
  setAccessStatus("Carregando seus acessos…");
  try {
    const { data: grants, error: grantsError } = await client.rpc("my_access");
    if (grantsError) throw grantsError;
    const productIds = [...new Set((grants || []).map((grant) => grant.product_id).filter(Boolean))];
    if (productIds.length === 0) {
      renderAccesses([], []);
      return;
    }

    const { data: products, error: productsError } = await client
      .from("products")
      .select("id,title,kind,active")
      .in("id", productIds)
      .eq("active", true);
    if (productsError) throw productsError;
    const order = new Map(productIds.map((id, index) => [id, index]));
    renderAccesses(grants || [], (products || []).sort((a, b) => order.get(a.id) - order.get(b.id)));
  } catch (error) {
    console.warn("AgentFlix access list unavailable", error);
    setAccessStatus("Não foi possível carregar seus acessos.", "error");
    byId("access-retry-button").hidden = false;
  }
}

async function loadProfile(session) {
  const sequence = ++loadSequence;
  currentUser = session.user;
  show("loading");

  const { data, error } = await client
    .from("profiles")
    .select("name,email,phone,role")
    .eq("id", session.user.id)
    .single();

  if (sequence !== loadSequence) return;
  if (error || !data) {
    console.warn("AgentFlix profile unavailable", error);
    show("unavailable");
    return;
  }

  fillProfile(data, session.user);
  show("account");
  await Promise.all([loadAccesses(), window.AgentFlixMemory.connect(client, session.user)]);
}

async function loadConfig() {
  const response = await fetch("/api/config", { cache: "no-store", headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("config unavailable");
  const config = await response.json();
  if (!config?.supabaseUrl || !config?.supabaseAnonKey || !window.supabase?.createClient) {
    throw new Error("auth unavailable");
  }
  return config;
}

async function initialize() {
  show("loading");
  try {
    const config = await loadConfig();
    client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session?.user) {
        loadSequence += 1;
        currentUser = null;
        show("signed-out");
        window.AgentFlixMemory.clearSignedOut();
      } else if (event === "SIGNED_IN" && session.user.id !== currentUser?.id) {
        loadProfile(session);
      }
    });

    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (data?.session?.user) await loadProfile(data.session);
    else show("signed-out");
  } catch (error) {
    console.warn("AgentFlix account unavailable", error);
    show("unavailable");
  }
}

byId("profile-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!client || !currentUser) {
    show("signed-out");
    return;
  }

  const nameInput = byId("name");
  const phoneInput = byId("phone");
  const result = validateProfile(nameInput.value, phoneInput.value);
  nameInput.setAttribute("aria-invalid", String(result.field === "name"));
  phoneInput.setAttribute("aria-invalid", String(result.field === "phone"));
  if (result.error) {
    setStatus(result.error);
    byId(result.field).focus();
    return;
  }

  const button = byId("save-button");
  button.disabled = true;
  button.textContent = "Salvando…";
  setStatus();
  try {
    const { data, error } = await client
      .from("profiles")
      .update({ name: result.name, phone: result.phone })
      .eq("id", currentUser.id)
      .select("name,email,phone,role")
      .single();
    if (error) throw error;
    fillProfile(data, currentUser);
    setStatus("Alterações salvas.", "success");
  } catch (error) {
    console.warn("AgentFlix profile update failed", error);
    setStatus(profileErrorMessage(error));
  } finally {
    button.disabled = false;
    button.textContent = "Salvar alterações";
  }
});

["name", "phone"].forEach((id) => {
  byId(id).addEventListener("input", () => {
    byId(id).removeAttribute("aria-invalid");
    setStatus();
  });
});

byId("retry-button").addEventListener("click", () => window.location.reload());
byId("access-retry-button").addEventListener("click", loadAccesses);
byId("sign-out-button").addEventListener("click", async () => {
  const button = byId("sign-out-button");
  button.disabled = true;
  try {
    if (!(await window.AgentFlixMemory.signOut())) {
      setStatus("Há dados pendentes ou a conexão falhou. Sincronize ou baixe seus dados antes de tentar sair novamente.");
      return;
    }
    window.location.assign("/entrar/");
  } finally {
    button.disabled = false;
  }
});

window.addEventListener("agentflix:memory-status", (event) => {
  const messages = {
    saved: "Memória sincronizada com sua conta.",
    saving: "Salvando sua memória…",
    pending: "Há alterações pendentes. Mantenha esta página aberta; tentaremos novamente.",
    unavailable: "Não foi possível conectar sua memória. Seus dados locais foram preservados.",
    local: "Dados locais neste navegador.",
    conflict: "Há versões diferentes entre dispositivos. Baixe uma cópia antes de escolher qual manter.",
  };
  byId("memory-status").textContent = messages[event.detail.state] || messages.pending;
  const list = byId("memory-conflicts");
  list.replaceChildren();
  const conflicts = window.AgentFlixMemory.status.conflicts;
  list.hidden = !conflicts.length;
  for (const key of conflicts) {
    const card = document.createElement("article");
    card.className = "access-card";
    const title = document.createElement("p");
    title.textContent = key;
    card.append(title);
    for (const [choice, label] of [["local", "Manter deste navegador"], ["cloud", "Usar versão da conta"]]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "af-button af-button--outline";
      button.textContent = label;
      button.addEventListener("click", async () => {
        button.disabled = true;
        if (!(await window.AgentFlixMemory.resolveConflict(key, choice))) {
          button.disabled = false;
          setStatus("Não foi possível resolver agora. Seus dados continuam preservados.");
        }
      });
      card.append(button);
    }
    list.append(card);
  }
});

byId("memory-versions-button").addEventListener("click", async () => {
  const button = byId("memory-versions-button"), list = byId("memory-versions");
  const status = byId("memory-versions-status");
  button.disabled = true;
  status.textContent = "Carregando versões…";
  try {
    const { data, error } = await window.AgentFlixMemory.versions();
    list.replaceChildren();
    list.hidden = true;
    if (error) { status.textContent = "O histórico não está disponível agora. A memória atual não foi alterada."; return; }
    status.textContent = data?.length ? "Até 100 versões recentes. Restaurar cria uma nova revisão; não apaga a versão atual." : "Ainda não há versões anteriores de exercícios.";
    for (const version of data || []) {
      const card = document.createElement("article");
      card.className = "access-card";
      const text = document.createElement("p");
      text.textContent = `${version.memory_key} · revisão ${version.revision} · ${new Date(version.saved_at).toLocaleString("pt-BR")}`;
      const restore = document.createElement("button");
      restore.type = "button";
      restore.className = "af-button af-button--outline";
      restore.textContent = "Restaurar versão";
      restore.addEventListener("click", async () => {
        restore.disabled = true;
        const ok = await window.AgentFlixMemory.restoreVersion(version.memory_key, version.revision);
        status.textContent = ok ? "Versão restaurada. Reabra o exercício para carregar o conteúdo." : "Não foi possível restaurar. Sincronize ou resolva os conflitos antes de tentar novamente.";
        restore.disabled = false;
      });
      card.append(text, restore);
      list.append(card);
    }
    list.hidden = !data?.length;
  } finally { button.disabled = false; }
});

byId("memory-retry-button").addEventListener("click", async () => {
  const button = byId("memory-retry-button");
  button.disabled = true;
  try { if (currentUser) await window.AgentFlixMemory.connect(client, currentUser); }
  finally { button.disabled = false; }
});

byId("memory-export-button").addEventListener("click", () => {
  if (!currentUser) return;
  const bundle = { ...window.AgentFlixMemory.exportData(), profile: {
    email: byId("email").value, name: byId("name").value, phone: byId("phone").value,
  }};
  const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "agentflix-meus-dados.json";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
});

initialize();
