import { normalizeMetrics, comparison, buildTitleMaps, contentTitle, observations } from "./model.mjs";

const byId = (id) => document.getElementById(id);
const states = ["loading", "signed-out", "forbidden", "mfa", "unavailable", "dashboard"];
const numberFormat = new Intl.NumberFormat("pt-BR");
const dateFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" });
const dayFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });
const collectionDayFormat = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Sao_Paulo" });
const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const chartKeys = ["skill_copies", "reading_opens", "video_starts"];
let client = null;
let currentUser = null;
let days = 30;
let revision = 0;
let titleMaps = { skills: {}, readings: {}, lessons: {} };
let rendered = false;

function element(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text !== undefined) item.textContent = text;
  return item;
}
function show(name) {
  states.forEach((state) => { byId(`${state}-state`).hidden = state !== name; });
}
function clearMetrics() {
  rendered = false;
  for (const id of ["metric-cards", "skills-ranking", "readings-ranking", "reading-modes-ranking", "appearances-ranking", "lessons-ranking", "daily-chart", "daily-table", "observations", "video-outcomes"]) byId(id).replaceChildren();
  for (const id of ["window-label", "coverage-text", "collection-meta", "query-status", "chart-description"]) byId(id).textContent = "";
}
function signedOut() {
  currentUser = null;
  revision += 1;
  clearMetrics();
  show("signed-out");
}
function setBusy(busy) {
  byId("dashboard-state").setAttribute("aria-busy", String(busy));
  document.querySelectorAll('input[name="period"]').forEach((input) => { input.disabled = busy; });
  byId("refresh-button").disabled = busy;
  byId("refresh-button").setAttribute("aria-busy", String(busy));
}
function date(value) { return (/^\d{4}-\d{2}-\d{2}$/.test(value) ? dayFormat : dateFormat).format(new Date(value)); }
function dateTime(value) { return dateTimeFormat.format(new Date(value)); }
function comparisonText(result, period) {
  if (result.kind === "incomplete") return "Comparação aguardando períodos completos";
  if (result.kind === "new") return `Atividade registrada; período anterior sem eventos`;
  if (result.kind === "unchanged") return `Mesmo volume dos ${period} dias anteriores`;
  return `${result.percent > 0 ? "+" : ""}${numberFormat.format(result.percent)}% vs. ${period} dias anteriores`;
}
function renderCards(metrics) {
  const cards = [
    ["active_visits", "Visitas com atividade", "activity"],
    ["skill_copies", "Comandos copiados", "copy"],
    ["reading_opens", "Leituras abertas", "guide"],
    ["video_starts", "Reproduções iniciadas", "duration"],
  ].map(([key, label, icon]) => {
    const card = element("article", "af-card metric-card");
    const top = element("div", "metric-topline");
    const iconNode = element("af-icon");
    iconNode.setAttribute("name", icon);
    iconNode.setAttribute("aria-hidden", "true");
    top.append(element("h2", "af-type-context", label), iconNode);
    const change = comparison(metrics.summary[key], metrics.previous[key], metrics.coverage);
    const note = element("p", "metric-comparison af-type-caption", comparisonText(change, metrics.window.days));
    note.dataset.kind = change.kind;
    card.append(top, element("p", "metric-value", numberFormat.format(metrics.summary[key])), note);
    return card;
  });
  byId("metric-cards").replaceChildren(...cards);
}
function renderRanking(id, kind, entries, maps, labels = ["Cópias", "Visitas"]) {
  const host = byId(id);
  host.replaceChildren();
  if (!entries.length) {
    host.append(element("p", "rank-empty af-type-caption", "Nenhuma atividade registrada neste período."));
    return;
  }
  const isLesson = kind === "lessons";
  const headings = isLesson ? ["Aula", "Inícios", "Engajadas", "Concluídas", "Visitas"] : ["Conteúdo", ...labels];
  const heading = element("div", `ranking-heading af-type-caption${isLesson ? " lesson-heading" : ""}`);
  heading.setAttribute("aria-hidden", "true");
  headings.forEach((text) => heading.append(element("span", "", text)));
  const list = element("ol", "af-list rank-list");
  const peak = Math.max(...entries.map((row) => row.events), 1);
  entries.forEach((row, index) => {
    const line = element("li", `af-list-row rank-row${isLesson ? " lesson-row" : ""}`);
    if (index >= 8) line.hidden = true;
    const copy = element("div", "rank-copy");
    const name = contentTitle(kind, row.content_id, maps);
    const title = element("p", "rank-title");
    const position = element("span", "rank-position", String(index + 1));
    position.setAttribute("aria-hidden", "true");
    title.append(position, element("span", "af-type-context", name));
    copy.append(title);
    if (isLesson && maps.lessons?.[row.content_id]?.context) copy.append(element("p", "rank-context af-type-caption", maps.lessons[row.content_id].context));
    if (!isLesson) {
      const meter = element("div", "rank-meter");
      meter.setAttribute("aria-hidden", "true");
      const fill = element("span"); fill.style.width = `${Math.round(row.events / peak * 100)}%`; meter.append(fill); copy.append(meter);
    }
    line.append(copy);
    const values = isLesson ? [row.events, row.engaged, row.completions, row.visits] : [row.events, row.visits];
    values.forEach((value, valueIndex) => {
      const count = element("p", "rank-number", numberFormat.format(value));
      count.append(element("small", "", headings[valueIndex + 1]));
      count.setAttribute("aria-label", `${numberFormat.format(value)} ${headings[valueIndex + 1].toLocaleLowerCase("pt-BR")}`);
      line.append(count);
    });
    list.append(line);
  });
  host.append(heading, list);
  if (entries.length > 8) {
    const more = element("button", "af-button af-button--text ranking-more", `Ver todos os ${entries.length} itens`);
    more.type = "button";
    more.setAttribute("aria-expanded", "false");
    more.addEventListener("click", () => {
      const expand = more.getAttribute("aria-expanded") !== "true";
      [...list.children].forEach((row, index) => { row.hidden = !expand && index >= 8; });
      more.setAttribute("aria-expanded", String(expand));
      more.textContent = expand ? "Mostrar os primeiros 8" : `Ver todos os ${entries.length} itens`;
    });
    host.append(more);
  }
}
function renderDaily(metrics) {
  const chart = byId("daily-chart");
  const table = byId("daily-table");
  chart.replaceChildren(); table.replaceChildren();
  if (!metrics.daily.length) {
    byId("chart-note").hidden = true;
    chart.append(element("p", "chart-empty af-type-caption", "Nenhum dia disponível para o período."));
    byId("chart-description").textContent = "Nenhum dia disponível para o período.";
    chart.style.gridTemplateColumns = "1fr";
    chart.style.minWidth = "0";
    return;
  }
  const collectionParts = metrics.collection_started_at ? collectionDayFormat.formatToParts(new Date(metrics.collection_started_at)) : [];
  const part = (name) => collectionParts.find((item) => item.type === name)?.value;
  const collectionDay = collectionParts.length ? `${part("year")}-${part("month")}-${part("day")}` : null;
  const isCollected = (row) => !collectionDay || row.date >= collectionDay;
  byId("chart-note").hidden = metrics.daily.every(isCollected);
  const actualMax = Math.max(0, ...metrics.daily.filter(isCollected).flatMap((row) => chartKeys.map((key) => row[key])));
  const max = Math.max(1, actualMax);
  chart.style.gridTemplateColumns = `repeat(${metrics.daily.length}, minmax(0, 1fr))`;
  chart.style.minWidth = `${Math.max(350, metrics.daily.length * 20)}px`;
  const labelInterval = Math.max(1, Math.ceil(metrics.daily.length / 6));
  metrics.daily.forEach((row, index) => {
    const column = element("div", "chart-day");
    const bars = element("div", "chart-bars");
    const collected = isCollected(row);
    bars.dataset.uncollected = String(!collected);
    chartKeys.forEach((key, keyIndex) => {
      const bar = element("span", `chart-bar ${["copies", "readings", "videos"][keyIndex]}`);
      bar.style.height = `${collected ? row[key] / max * 95 : 0}%`;
      bars.append(bar);
    });
    column.append(bars, element("span", "chart-label", index % labelInterval === 0 || index === metrics.daily.length - 1 ? date(row.date) : ""));
    chart.append(column);
    const tableRow = element("tr");
    const day = element("th", "", date(row.date)); day.scope = "row"; tableRow.append(day);
    chartKeys.forEach((key) => tableRow.append(element("td", "", collected ? numberFormat.format(row[key]) : "Sem coleta")));
    table.append(tableRow);
  });
  byId("chart-description").textContent = `Gráfico de comandos copiados, leituras abertas e reproduções iniciadas em ${metrics.daily.length} dias. Maior contagem diária: ${numberFormat.format(actualMax)}. Dias anteriores à coleta aparecem hachurados; não representam zero eventos. Todas as contagens estão disponíveis na tabela abaixo.`;
}
function renderOutcomes(metrics) {
  const summary = metrics.summary;
  const entries = [
    ["Reproduções iniciadas", summary.video_starts, "Primeiro play registrado"],
    ["Reproduções engajadas", summary.video_engaged, "Pelo menos 30s de conteúdo, ou 90% de aula curta"],
    ["Reproduções concluídas", summary.video_completions, "Pelo menos 90% assistidos"],
  ];
  byId("video-outcomes").replaceChildren(...entries.map(([label, value, description]) => {
    const item = element("div");
    item.append(element("p", "af-type-context", label), element("span", "outcome-value", numberFormat.format(value)));
    item.append(element("p", "outcome-detail af-type-caption", description));
    return item;
  }));
}
function render(metrics) {
  byId("window-label").textContent = `${dateTime(metrics.window.start)} a ${dateTime(metrics.window.end)} · Horário de Brasília`;
  const complete = metrics.coverage.current_complete && metrics.coverage.previous_complete;
  byId("coverage-note").dataset.incomplete = String(!complete);
  byId("coverage-text").textContent = !metrics.coverage.current_complete
    ? "A coleta começou dentro deste período. O volume é parcial e a comparação aguarda dois períodos completos."
    : !metrics.coverage.previous_complete
      ? "Este período está coberto. A comparação aguarda a cobertura completa do período anterior."
      : `Comparação com os ${metrics.window.days} dias anteriores. Os dois períodos têm cobertura de coleta.`;
  renderCards(metrics);
  renderDaily(metrics);
  renderRanking("skills-ranking", "skills", metrics.rankings.skills, titleMaps);
  renderRanking("readings-ranking", "readings", metrics.rankings.readings, titleMaps, ["Aberturas", "Visitas"]);
  renderRanking("reading-modes-ranking", "reading_modes", metrics.rankings.reading_modes, titleMaps, ["Acessos", "Visitas"]);
  renderRanking("appearances-ranking", "appearances", metrics.rankings.appearances, titleMaps, ["Acessos", "Visitas"]);
  renderRanking("lessons-ranking", "lessons", metrics.rankings.lessons, titleMaps);
  renderOutcomes(metrics);
  const notes = observations(metrics, titleMaps);
  byId("observations").replaceChildren(...notes.map((note) => {
    const item = element("article", "af-card observation");
    item.append(element("h3", "af-type-context", note.title), element("p", "af-type-caption", note.text));
    return item;
  }));
  if (!notes.length) byId("observations").append(element("p", "rank-empty af-type-caption", "As observações aparecem quando houver volume de uso registrado."));
  byId("empty-note").hidden = Object.values(metrics.summary).some((value) => value > 0);
  byId("collection-meta").textContent = `${metrics.collection_started_at ? `Coleta iniciada em ${dateTime(metrics.collection_started_at)}.` : "Início da coleta ainda indisponível."} Atualizado em ${dateTime(metrics.generated_at)}. Horário de Brasília.`;
  byId("query-status").textContent = `Números atualizados em ${dateTime(metrics.generated_at)} · Horário de Brasília.`;
  rendered = true;
  show("dashboard");
}

async function fetchTitleMaps() {
  const requests = ["/catalog.json", "/leitura/manifest.json", "/assistir/series.json"].map(async (url) => {
    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error("titles unavailable");
    return response.json();
  });
  const values = await Promise.allSettled(requests);
  titleMaps = buildTitleMaps(...values.map((result) => result.status === "fulfilled" ? result.value : {}));
}
async function loadMetrics() {
  if (!client || !currentUser) return;
  const requestRevision = ++revision;
  const requestUser = currentUser.id;
  setBusy(true);
  if (rendered) byId("query-status").textContent = "Atualizando os números do período…";
  else show("loading");
  try {
    const { data, error } = await client.rpc("admin_usage_metrics", { p_days: days });
    if (requestRevision !== revision || currentUser?.id !== requestUser) return;
    if (error) throw error;
    const metrics = normalizeMetrics(data);
    if (metrics.window.days !== days) throw new Error("Unexpected metrics period");
    render(metrics);
  } catch (error) {
    if (requestRevision !== revision || currentUser?.id !== requestUser) return;
    clearMetrics();
    if (error?.name === "AuthSessionMissingError" || error?.code === "PGRST301") signedOut();
    else if (error?.code === "42501") show("forbidden");
    else show("unavailable");
  } finally {
    if (requestRevision === revision) setBusy(false);
  }
}
async function loadAccess(session) {
  currentUser = session.user;
  const requestRevision = ++revision;
  const isCurrent = () => revision === requestRevision && currentUser?.id === session.user.id;
  show("loading");
  try {
    const { data: profile, error: profileError } = await client.from("profiles").select("role").eq("id", session.user.id).single();
    if (!isCurrent()) return;
    if (profileError) throw profileError;
    if (profile?.role !== "admin") { clearMetrics(); show("forbidden"); return; }
    const { data: assurance, error: assuranceError } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (!isCurrent()) return;
    if (assuranceError) throw assuranceError;
    if (assurance?.currentLevel !== "aal2") { clearMetrics(); show("mfa"); return; }
    const { data: allowed, error: roleError } = await client.rpc("is_profile_admin");
    if (!isCurrent()) return;
    if (roleError) throw roleError;
    if (allowed !== true) { clearMetrics(); show("forbidden"); return; }
    await fetchTitleMaps();
    if (isCurrent()) await loadMetrics();
  } catch (error) {
    if (!isCurrent()) return;
    clearMetrics();
    if (error?.name === "AuthSessionMissingError" || error?.code === "PGRST301") signedOut();
    else show("unavailable");
  }
}
async function initialize() {
  show("loading");
  try {
    const response = await fetch("/api/config", { cache: "no-store", headers: { accept: "application/json" } });
    if (!response.ok) throw new Error("config unavailable");
    const config = await response.json();
    if (!config?.supabaseUrl || !config?.supabaseAnonKey || !window.supabase?.createClient) throw new Error("auth unavailable");
    client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") signedOut();
      else if ((event === "SIGNED_IN" && session?.user.id !== currentUser?.id) || event === "MFA_CHALLENGE_VERIFIED") {
        // Sair do callback evita reentrar no lock interno da biblioteca de auth.
        if (session?.user) window.setTimeout(() => loadAccess(session), 0);
      }
    });
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (data?.session?.user) await loadAccess(data.session);
    else signedOut();
  } catch (error) {
    clearMetrics();
    if (error?.name === "AuthSessionMissingError") signedOut();
    else show("unavailable");
  }
}
document.querySelectorAll('input[name="period"]').forEach((input) => input.addEventListener("change", () => {
  days = Number(input.value);
  loadMetrics();
}));
byId("refresh-button").addEventListener("click", loadMetrics);
byId("retry-button").addEventListener("click", () => window.location.reload());
initialize();
