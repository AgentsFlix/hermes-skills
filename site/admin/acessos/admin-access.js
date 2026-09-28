const byId = (id) => document.getElementById(id);
const states = ["loading", "signed-out", "forbidden", "mfa", "admin", "unavailable"];
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
let client = null;
let currentUser = null;
let selectedUser = null;
let products = [];
let entitlements = [];
let users = [];
let mfaFactorId = null;

function productKindLabel(product) {
  if (product.product_id.startsWith("assistir:")) return "Série";
  return ({ pass: "Passe", content: "Acervo" }[product.kind] || "Skill");
}

function show(name) {
  states.forEach((state) => { byId(`${state}-state`).hidden = state !== name; });
}

function showSignedOut() {
  currentUser = null;
  show("signed-out");
}

function isMissingSession(error) {
  return error?.name === "AuthSessionMissingError";
}

function setStatus(id, message = "", tone = "") {
  const element = byId(id);
  element.textContent = message;
  element.dataset.tone = message ? tone : "";
}

function button(label, className, handler) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = className;
  element.textContent = label;
  element.addEventListener("click", handler);
  return element;
}

function formatDate(value) {
  if (!value) return "sem vencimento";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "data indisponível" : dateTime.format(date);
}

function toLocalInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function isActive(entitlement) {
  if (entitlement.revoked_at) return false;
  return !entitlement.expires_at || new Date(entitlement.expires_at).getTime() > Date.now();
}

function sourceLabel(source) {
  return { grant: "concessão manual", purchase: "compra", subscription: "assinatura" }[source] || source;
}

function empty(message) {
  const element = document.createElement("p");
  element.className = "empty-panel";
  element.textContent = message;
  return element;
}

function revokeButton(product) {
  const element = button("Revogar manual", "revoke-button", () => {
    if (element.dataset.confirm !== "true") {
      element.dataset.confirm = "true";
      element.textContent = "Confirmar revogação";
      setStatus("action-status", `Confirme a revogação manual de ${product.title}.`);
      window.setTimeout(() => {
        if (element.isConnected && element.dataset.confirm === "true") {
          element.dataset.confirm = "";
          element.textContent = "Revogar manual";
          if (byId("action-status").textContent === `Confirme a revogação manual de ${product.title}.`) {
            setStatus("action-status");
          }
        }
      }, 6000);
      return;
    }
    revokeAccess(product);
  });
  return element;
}

function renderUsers(nextUsers) {
  users = nextUsers;
  const results = byId("user-results");
  results.replaceChildren();
  nextUsers.forEach((user) => {
    const item = button("", "user-result", () => selectUser(user));
    item.setAttribute("aria-current", String(selectedUser?.user_id === user.user_id));
    const copy = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = user.name || "Sem nome cadastrado";
    const email = document.createElement("small");
    email.textContent = user.email;
    const count = document.createElement("span");
    count.className = "access-count";
    count.textContent = `${user.active_accesses || 0} ativo${Number(user.active_accesses) === 1 ? "" : "s"}`;
    copy.append(name, email);
    item.append(copy, count);
    results.append(item);
  });
  if (!nextUsers.length) results.append(empty("Nenhuma conta encontrada."));
}

async function searchUsers(query = "") {
  const submit = byId("search-button");
  submit.disabled = true;
  setStatus("search-status", "Buscando contas…");
  try {
    const { data, error } = await client.rpc("admin_search_access_users", { search_query: query || null });
    if (error) throw error;
    renderUsers(data || []);
    setStatus("search-status", `${(data || []).length} conta${data?.length === 1 ? "" : "s"} encontrada${data?.length === 1 ? "" : "s"}.`);
  } catch (error) {
    console.warn("AgentFlix admin user search failed", error);
    setStatus("search-status", "Não foi possível buscar as contas.", "error");
  } finally {
    submit.disabled = false;
  }
}

function renderProducts() {
  const list = byId("product-list");
  list.replaceChildren();
  if (!products.length) {
    list.append(empty("Nenhum produto ativo está disponível para concessão."));
    return;
  }

  products.forEach((product) => {
    const related = entitlements.filter((item) => item.product_id === product.product_id);
    const active = related.filter(isActive);
    const manual = active.find((item) => item.source === "grant" && item.source_id === "manual");
    const card = document.createElement("article");
    card.className = "product-card";

    const meta = document.createElement("div");
    meta.className = "product-meta";
    const copy = document.createElement("div");
    const title = document.createElement("h4");
    title.textContent = product.title;
    const detail = document.createElement("p");
    detail.textContent = active.length
      ? active.map((item) => `${sourceLabel(item.source)} · ${formatDate(item.expires_at)}`).join(" | ")
      : `${productKindLabel(product)} · sem acesso direto ativo`;
    const badge = document.createElement("span");
    badge.className = "access-badge";
    badge.dataset.active = String(active.length > 0);
    badge.textContent = active.length ? "Ativo" : "Sem acesso";
    copy.append(title, detail);
    meta.append(copy, badge);

    const actions = document.createElement("div");
    actions.className = "product-actions";
    const field = document.createElement("div");
    field.className = "expiry-field";
    const inputId = `expires-${product.product_id}`;
    const label = document.createElement("label");
    label.htmlFor = inputId;
    label.textContent = "Validade opcional";
    const input = document.createElement("input");
    input.id = inputId;
    input.type = "datetime-local";
    input.value = toLocalInput(manual?.expires_at);
    field.append(label, input);
    actions.append(field);
    actions.append(button(manual ? "Atualizar" : "Conceder", "grant-button", () => grantAccess(product, input)));
    if (manual) actions.append(revokeButton(product));

    card.append(meta, actions);
    list.append(card);
  });
}

function renderHistory(history) {
  const list = byId("history-list");
  list.replaceChildren();
  if (!history.length) {
    list.append(empty("Ainda não há ações manuais registradas para esta conta."));
    return;
  }
  history.forEach((event) => {
    const item = document.createElement("article");
    item.className = "history-item";
    const mark = document.createElement("span");
    mark.className = "history-mark";
    mark.dataset.action = event.action;
    mark.setAttribute("aria-hidden", "true");
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = `${event.action === "grant" ? "Acesso concedido" : "Acesso revogado"} · ${event.product_title}`;
    const meta = document.createElement("p");
    const validity = event.action === "grant" ? ` · ${formatDate(event.expires_at)}` : "";
    meta.textContent = `${formatDate(event.created_at)} · ${event.actor_email || "administrador removido"}${validity}`;
    copy.append(title, meta);
    item.append(mark, copy);
    list.append(item);
  });
}

async function loadSelectedUser({ preserveStatus = false } = {}) {
  if (!selectedUser) return;
  byId("product-list").replaceChildren(empty("Carregando acessos…"));
  byId("history-list").replaceChildren(empty("Carregando histórico…"));
  if (!preserveStatus) setStatus("action-status");
  try {
    const [accessResult, historyResult] = await Promise.all([
      client.rpc("admin_user_entitlements", { requested_user_id: selectedUser.user_id }),
      client.rpc("admin_access_history", { requested_user_id: selectedUser.user_id }),
    ]);
    if (accessResult.error) throw accessResult.error;
    if (historyResult.error) throw historyResult.error;
    entitlements = accessResult.data || [];
    renderProducts();
    renderHistory(historyResult.data || []);
  } catch (error) {
    console.warn("AgentFlix admin access detail failed", error);
    byId("product-list").replaceChildren(empty("Não foi possível carregar os acessos."));
    byId("history-list").replaceChildren(empty("Não foi possível carregar o histórico."));
  }
}

async function selectUser(user) {
  selectedUser = user;
  renderUsers(users);
  byId("selected-user-name").textContent = user.name || "Sem nome cadastrado";
  byId("selected-user-email").textContent = user.email;
  byId("selected-user-role").textContent = user.role === "admin" ? "Administrador" : "Usuário";
  byId("user-detail").hidden = false;
  await loadSelectedUser();
  byId("user-detail").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function grantAccess(product, input) {
  if (!selectedUser) return;
  let expiresAt = null;
  if (input.value) {
    const date = new Date(input.value);
    if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
      setStatus("action-status", "Escolha uma validade futura ou deixe o campo vazio.", "error");
      input.focus();
      return;
    }
    expiresAt = date.toISOString();
  }
  setStatus("action-status", `Salvando acesso a ${product.title}…`);
  try {
    const { error } = await client.rpc("grant_product_access", {
      target_user_id: selectedUser.user_id,
      target_product_id: product.product_id,
      target_expires_at: expiresAt,
    });
    if (error) throw error;
    setStatus("action-status", `Acesso a ${product.title} concedido.`, "success");
    await loadSelectedUser({ preserveStatus: true });
    await searchUsers(byId("user-search").value.trim());
  } catch (error) {
    console.warn("AgentFlix admin grant failed", error);
    setStatus("action-status", "Não foi possível conceder o acesso.", "error");
  }
}

async function revokeAccess(product) {
  if (!selectedUser) return;
  setStatus("action-status", `Revogando concessão manual de ${product.title}…`);
  try {
    const { error } = await client.rpc("revoke_product_access", {
      target_user_id: selectedUser.user_id,
      target_product_id: product.product_id,
    });
    if (error) throw error;
    setStatus("action-status", `Concessão manual de ${product.title} revogada.`, "success");
    await loadSelectedUser({ preserveStatus: true });
    await searchUsers(byId("user-search").value.trim());
  } catch (error) {
    console.warn("AgentFlix admin revoke failed", error);
    setStatus("action-status", "Não foi possível revogar a concessão manual.", "error");
  }
}

async function loadAdmin(session) {
  currentUser = session.user;
  show("loading");
  try {
    const { data: profile, error: profileError } = await client.from("profiles")
      .select("role").eq("id", session.user.id).single();
    if (currentUser?.id !== session.user.id) return;
    if (profileError) throw profileError;
    if (profile?.role !== "admin") {
      show("forbidden");
      return;
    }
    const { data: assurance, error: assuranceError } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (currentUser?.id !== session.user.id) return;
    if (assuranceError) throw assuranceError;
    if (assurance.currentLevel !== "aal2") {
      const { data: factors, error: factorsError } = await client.auth.mfa.listFactors();
      if (currentUser?.id !== session.user.id) return;
      if (factorsError) throw factorsError;
      const verified = factors.totp?.find((factor) => factor.status === "verified");
      mfaFactorId = verified?.id || null;
      byId("mfa-enroll-button").hidden = Boolean(verified);
      byId("mfa-setup").hidden = true;
      byId("mfa-qr").removeAttribute("src");
      byId("mfa-form").hidden = !verified;
      setStatus("mfa-status", verified ? "Digite o código do seu aplicativo autenticador." : "Configure o segundo fator para proteger concessões e revogações.");
      show("mfa");
      return;
    }
    const { data: allowed, error: roleError } = await client.rpc("is_profile_admin");
    if (currentUser?.id !== session.user.id) return;
    if (roleError) throw roleError;
    if (allowed !== true) {
      show("forbidden");
      return;
    }
    const { data: catalog, error: catalogError } = await client.rpc("admin_access_products");
    if (currentUser?.id !== session.user.id) return;
    if (catalogError) throw catalogError;
    products = catalog || [];
    show("admin");
    await searchUsers("");
  } catch (error) {
    if (isMissingSession(error) || !currentUser) {
      showSignedOut();
    } else {
      console.warn("AgentFlix admin panel unavailable", error);
      show("unavailable");
    }
  }
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
        showSignedOut();
      } else if (event === "SIGNED_IN" && session.user.id !== currentUser?.id) {
        loadAdmin(session);
      }
    });
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (data?.session?.user) await loadAdmin(data.session);
    else show("signed-out");
  } catch (error) {
    if (isMissingSession(error)) {
      showSignedOut();
    } else {
      console.warn("AgentFlix admin initialization failed", error);
      show("unavailable");
    }
  }
}

byId("search-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  selectedUser = null;
  byId("user-detail").hidden = true;
  await searchUsers(byId("user-search").value.trim());
});
byId("refresh-button").addEventListener("click", () => loadSelectedUser());
byId("retry-button").addEventListener("click", () => window.location.reload());
byId("mfa-enroll-button").addEventListener("click", async () => {
  byId("mfa-enroll-button").disabled = true;
  setStatus("mfa-status", "Preparando o aplicativo autenticador…");
  try {
    const { data, error } = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "AgentFlix Admin" });
    if (error) throw error;
    if (!/^data:image\/(?:svg\+xml|png)(?:;[^,]*)?,/.test(data?.totp?.qr_code || "")) throw new Error("QR code unavailable");
    mfaFactorId = data.id;
    byId("mfa-qr").src = data.totp.qr_code;
    byId("mfa-setup").hidden = false;
    byId("mfa-form").hidden = false;
    byId("mfa-enroll-button").hidden = true;
    setStatus("mfa-status", "Escaneie o QR e digite o código para concluir a configuração.");
  } catch (error) {
    console.warn("AgentFlix MFA enrollment unavailable", error?.name);
    setStatus("mfa-status", "Não foi possível configurar o autenticador. Tente novamente.", "error");
  } finally { byId("mfa-enroll-button").disabled = false; }
});
byId("mfa-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = byId("mfa-code").value.trim();
  if (!mfaFactorId || !/^[0-9]{6}$/.test(code)) return;
  byId("mfa-form").querySelector("button").disabled = true;
  setStatus("mfa-status", "Conferindo código…");
  try {
    const { error } = await client.auth.mfa.challengeAndVerify({ factorId: mfaFactorId, code });
    if (error) throw error;
    byId("mfa-code").value = "";
    byId("mfa-qr").removeAttribute("src");
    const { data: session, error: sessionError } = await client.auth.getSession();
    if (sessionError || !session?.session) throw sessionError || new Error("session unavailable");
    const next = new URLSearchParams(location.search).get("next");
    const { data: admin, error: adminError } = await client.rpc("is_profile_admin");
    if (next === "/admin/metricas/" && admin === true && !adminError) {
      location.assign(next); return;
    }
    await loadAdmin(session.session);
  } catch (error) {
    console.warn("AgentFlix MFA verification unavailable", error?.name);
    setStatus("mfa-status", "Código inválido ou expirado. Confira no aplicativo e tente novamente.", "error");
  } finally { byId("mfa-form").querySelector("button").disabled = false; }
});

initialize();
