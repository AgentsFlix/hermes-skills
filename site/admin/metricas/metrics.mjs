import { normalizeClarity, renderClarity, renderClarityUnavailable } from "./clarity.mjs";
import { normalizeMetrics, comparison, buildTitleMaps, contentTitle, observations, READING_MODES, APPEARANCES } from "./model.mjs";

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
  byId("clarity-dashboard").replaceChildren();
  byId("native-status").textContent = "";
  byId("native-window-label").textContent = "";
  for (const id of ["metric-cards", "skills-ranking", "readings-ranking", "reading-modes-ranking", "appearances-ranking", "lessons-ranking", "daily-chart", "daily-table", "observations", "video-outcomes"]) byId(id).replaceChildren();
  for (const id of ["window-label", "coverage-label", "coverage-text", "collection-meta", "query-status", "chart-description"]) byId(id).textContent = "";
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
function icon(name) {
  const node = element("af-icon");
  node.setAttribute("name", name);
  node.setAttribute("aria-hidden", "true");
  return node;
}
function svgNode(tag, attributes = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}
function compactChange(change) {
  if (change.kind === "new") return "Primeiros registros";
  if (change.kind === "unchanged") return "Mesmo volume";
  return `${change.percent > 0 ? "+" : ""}${numberFormat.format(change.percent)}%`;
}
function renderCards(metrics) {
  const definitions = [
    ["active_visits", "Visitas com atividade", "activity", "visits"],
    ["skill_copies", "Comandos copiados", "copy", "copies"],
    ["reading_opens", "Leituras abertas", "guide", "readings"],
    ["video_starts", "Reproduções iniciadas", "duration", "videos"],
  ];
  const total = chartKeys.reduce((sum, key) => sum + metrics.summary[key], 0);
  const cards = definitions.map(([key, label, name, tone]) => {
    const card = element("article", `af-card metric-card metric-card--${tone}`);
    const top = element("div", "metric-topline");
    top.append(icon(name), element("h2", "af-type-context", label));
    const body = element("div", "metric-body");
    body.append(element("p", "metric-value af-type-context", numberFormat.format(metrics.summary[key])));
    const change = comparison(metrics.summary[key], metrics.previous[key], metrics.coverage);
    if (change.kind !== "incomplete") {
      const note = element("p", "metric-comparison af-type-caption", compactChange(change));
      note.dataset.kind = change.kind;
      note.setAttribute("aria-label", comparisonText(change, metrics.window.days));
      note.title = comparisonText(change, metrics.window.days);
      body.append(note);
    }
    card.append(top, body);
    if (key === "active_visits") card.append(element("p", "metric-footnote af-type-caption", "Sessões de navegação"));
    else {
      const meter = element("div", "metric-meter");
      meter.setAttribute("aria-hidden", "true");
      const fill = element("span", tone);
      fill.style.width = `${total ? metrics.summary[key] / total * 100 : 0}%`;
      meter.append(fill);
      card.append(meter, element("p", "metric-footnote af-type-caption", total ? `${Math.round(metrics.summary[key] / total * 100)}% das três atividades` : "Sem registros desta atividade"));
    }
    return card;
  });
  const mix = element("div", "activity-mix");
  const intro = element("div", "mix-heading");
  intro.append(element("p", "af-type-context", "Onde está a atividade"), element("p", "af-type-caption", total ? `${numberFormat.format(total)} cópias, aberturas e inícios` : "Sem cópias, leituras ou inícios no período"));
  const track = element("div", "activity-track");
  track.setAttribute("role", "img");
  track.setAttribute("aria-label", total ? definitions.slice(1).map(([key, label]) => `${label}: ${Math.round(metrics.summary[key] / total * 100)}%`).join(". ") : "Sem registros entre cópias, aberturas e inícios.");
  definitions.slice(1).forEach(([key, label, , tone]) => {
    if (!metrics.summary[key]) return;
    const segment = element("span", tone);
    segment.style.width = `${metrics.summary[key] / total * 100}%`;
    segment.title = `${label}: ${numberFormat.format(metrics.summary[key])}`;
    if (metrics.summary[key] / total >= .1) segment.append(element("span", "af-type-context", `${Math.round(metrics.summary[key] / total * 100)}%`));
    track.append(segment);
  });
  mix.append(intro, track);
  byId("metric-cards").replaceChildren(...cards, mix);
}
function rankingTable(kind, entries, maps, labels) {
  const detail = element("details", "metric-details ranking-detail");
  detail.append(element("summary", "", "Ver contagens e visitas"));
  const scroll = element("div", "table-scroll");
  scroll.tabIndex = 0;
  scroll.setAttribute("role", "region");
  scroll.setAttribute("aria-label", `Contagens e visitas: ${kind === "lessons" ? "aulas" : kind === "skills" ? "skills" : "leituras"}`);
  const table = element("table");
  const caption = element("caption", "sr-only", "Contagens por conteúdo no período observado");
  const head = element("thead"), headRow = element("tr");
  const headings = kind === "lessons" ? ["Aula", "Inícios", "Engajadas", "Concluídas", "Visitas"] : ["Conteúdo", ...labels];
  headings.forEach((label) => { const cell = element("th", "", label); cell.scope = "col"; headRow.append(cell); });
  head.append(headRow);
  const body = element("tbody");
  entries.forEach((row) => {
    const line = element("tr");
    const title = element("th", "", contentTitle(kind, row.content_id, maps)); title.scope = "row"; line.append(title);
    const values = kind === "lessons" ? [row.events, row.engaged, row.completions, row.visits] : [row.events, row.visits];
    values.forEach((value) => line.append(element("td", "", numberFormat.format(value))));
    body.append(line);
  });
  table.append(caption, head, body); scroll.append(table); detail.append(scroll);
  return detail;
}
function renderRanking(id, kind, entries, maps, labels = ["Cópias", "Visitas"]) {
  const host = byId(id);
  host.replaceChildren();
  host.dataset.tone = kind === "skills" ? "copies" : kind === "readings" ? "readings" : "videos";
  if (!entries.length) {
    const empty = element("div", "rank-empty");
    const tracks = element("div", "empty-tracks"); tracks.setAttribute("aria-hidden", "true");
    for (const width of [100, 100, 100]) { const track = element("span"); track.style.width = `${width}%`; tracks.append(track); }
    empty.append(tracks, element("p", "af-type-caption", "Nenhuma atividade registrada neste período."));
    host.append(empty);
    return;
  }
  const isLesson = kind === "lessons";
  const list = element("ol", "af-list rank-list");
  const peak = Math.max(...entries.map((row) => row.events), 1);
  const lessonPeak = isLesson ? Math.max(...entries.flatMap((row) => [row.events, row.engaged, row.completions]), 1) : 1;
  entries.forEach((row, index) => {
    const line = element("li", `af-list-row rank-row${isLesson ? " lesson-row" : ""}`);
    if (index >= 5) line.hidden = true;
    const position = element("span", "rank-position", String(index + 1).padStart(2, "0"));
    position.setAttribute("aria-hidden", "true");
    const copy = element("div", "rank-copy");
    const title = element("p", "rank-title af-type-context", contentTitle(kind, row.content_id, maps));
    const top = element("div", "rank-top");
    const count = element("p", "rank-number af-type-context", numberFormat.format(row.events));
    count.setAttribute("aria-label", `${numberFormat.format(row.events)} ${isLesson ? "inícios" : labels[0].toLocaleLowerCase("pt-BR")}`);
    top.append(title, count); copy.append(top);
    if (isLesson) {
      if (maps.lessons?.[row.content_id]?.context) copy.append(element("p", "rank-context af-type-caption", maps.lessons[row.content_id].context));
      const tracks = element("div", "lesson-tracks");
      [["Inícios", row.events, "videos"], ["Engajadas", row.engaged, "readings"], ["Concluídas", row.completions, "copies"]].forEach(([label, value, tone]) => {
        const trackRow = element("div", "lesson-track-row");
        const labelNode = element("span", "af-type-caption", label);
        const track = element("div", "rank-meter"); track.setAttribute("aria-hidden", "true");
        const fill = element("span", tone); fill.style.width = `${value / lessonPeak * 100}%`; track.append(fill);
        trackRow.append(labelNode, track, element("span", "track-value", numberFormat.format(value)));
        tracks.append(trackRow);
      });
      copy.append(tracks);
      // A contagem de inícios aparece junto à respectiva barra.
      count.hidden = true;
    } else {
      const meter = element("div", "rank-meter"); meter.setAttribute("aria-hidden", "true");
      const fill = element("span"); fill.style.width = `${row.events / peak * 100}%`; meter.append(fill); copy.append(meter);
    }
    line.append(position, copy); list.append(line);
  });
  host.append(list, element("p", "ranking-scale af-type-caption", isLesson ? "Mesma escala para os eventos das aulas exibidas" : "Comprimento das barras comparado ao líder"));
  if (entries.length > 5) {
    const more = element("button", "af-button af-button--text ranking-more", `Ver todos os ${entries.length} itens`);
    more.type = "button";
    more.setAttribute("aria-expanded", "false");
    more.addEventListener("click", () => {
      const expand = more.getAttribute("aria-expanded") !== "true";
      [...list.children].forEach((row, index) => { row.hidden = !expand && index >= 5; });
      more.setAttribute("aria-expanded", String(expand));
      more.textContent = expand ? "Mostrar os primeiros 5" : `Ver todos os ${entries.length} itens`;
    });
    host.append(more);
  }
  host.append(rankingTable(kind, entries, maps, labels));
}
function renderPreference(id, kind, entries) {
  const host = byId(id);
  const known = kind === "reading_modes" ? READING_MODES : APPEARANCES;
  const ordered = [...entries, ...Object.keys(known).filter((key) => !entries.some((row) => row.content_id === key)).map((content_id) => ({ content_id, events: 0, visits: 0 }))];
  const total = entries.reduce((sum, row) => sum + row.events, 0);
  const tones = kind === "reading_modes" ? { human: "readings", skill: "copies", agent: "videos" } : { dark: "videos", paper: "readings" };
  const visual = element("div", "preference-visual");
  const donut = element("div", "preference-donut");
  const svg = svgNode("svg", { viewBox: "0 0 180 180", "aria-hidden": "true" });
  const circumference = 2 * Math.PI * 70;
  svg.append(svgNode("circle", { cx: 90, cy: 90, r: 70, class: "donut-base" }));
  let offset = 0;
  ordered.forEach((row) => {
    if (!total || !row.events) return;
    const length = row.events / total * circumference;
    const gap = ordered.filter((item) => item.events > 0).length > 1 ? Math.min(3, length / 5) : 0;
    svg.append(svgNode("circle", { cx: 90, cy: 90, r: 70, class: `donut-segment ${tones[row.content_id] || "copies"}`, "stroke-dasharray": `${length - gap} ${circumference - length + gap}`, "stroke-dashoffset": -offset, transform: "rotate(-90 90 90)" }));
    offset += length;
  });
  const center = element("div", "donut-center");
  const top = ordered[0];
  center.append(element("strong", "af-type-context", total ? `${Math.round(top.events / total * 100)}%` : "—"), element("span", "af-type-caption", total ? contentTitle(kind, top.content_id) : "Sem acessos"));
  donut.append(svg, center);
  const legend = element("ul", "preference-legend");
  ordered.forEach((row) => {
    const item = element("li");
    const label = element("div", "preference-label");
    const swatch = element("span", `legend-key ${tones[row.content_id] || "copies"}`); swatch.setAttribute("aria-hidden", "true");
    label.append(swatch, element("span", "af-type-context", contentTitle(kind, row.content_id)));
    const stats = element("div", "preference-stats");
    stats.append(element("strong", "af-type-context", total ? `${Math.round(row.events / total * 100)}%` : "—"), element("span", "af-type-caption", `${numberFormat.format(row.events)} ${row.events === 1 ? "acesso" : "acessos"}`));
    item.append(label, stats); legend.append(item);
  });
  visual.append(donut, legend);
  const totalNote = element("p", "preference-total af-type-caption", `${numberFormat.format(total)} ${total === 1 ? "acesso observado" : "acessos observados"}`);
  const detail = element("details", "preference-visits metric-details");
  detail.append(element("summary", "", "Ver visitas por preferência"));
  ordered.forEach((row) => detail.append(element("p", "af-type-caption", `${contentTitle(kind, row.content_id)}: ${numberFormat.format(row.visits)} ${row.visits === 1 ? "visita" : "visitas"}`)));
  host.replaceChildren(visual, totalNote, detail);
}
function renderDaily(metrics) {
  const chart = byId("daily-chart");
  const table = byId("daily-table");
  chart.replaceChildren(); table.replaceChildren();
  chart.style.minWidth = "0";
  if (!metrics.daily.length) {
    byId("chart-note").hidden = true;
    chart.append(element("p", "chart-empty af-type-caption", "Nenhum dia disponível para o período."));
    byId("chart-description").textContent = "Nenhum dia disponível para o período.";
    return;
  }
  const collectionParts = metrics.collection_started_at ? collectionDayFormat.formatToParts(new Date(metrics.collection_started_at)) : [];
  const part = (name) => collectionParts.find((item) => item.type === name)?.value;
  const collectionDay = collectionParts.length ? `${part("year")}-${part("month")}-${part("day")}` : null;
  const isCollected = (row) => !collectionDay || row.date >= collectionDay;
  byId("chart-note").hidden = metrics.daily.every(isCollected);
  const actualMax = Math.max(0, ...metrics.daily.filter(isCollected).flatMap((row) => chartKeys.map((key) => row[key])));
  const max = Math.max(1, actualMax);
  const dateInterval = Math.max(1, Math.ceil(metrics.daily.length / 5));
  chartKeys.forEach((key, keyIndex) => {
    const tone = ["copies", "readings", "videos"][keyIndex];
    const row = element("div", "daily-track");
    const label = element("div", "daily-track-label");
    label.append(element("span", `legend-key ${tone}`), element("span", "af-type-context", ["Comandos copiados", "Leituras abertas", "Reproduções iniciadas"][keyIndex]));
    const svg = svgNode("svg", { viewBox: "0 0 900 88", preserveAspectRatio: "none", class: `daily-track-chart ${tone}` });
    const defs = svgNode("defs");
    const hatch = svgNode("pattern", { id: `uncollected-${key}`, width: 8, height: 8, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" });
    hatch.append(svgNode("rect", { width: 8, height: 8, class: "hatch-base" }), svgNode("line", { x1: 0, x2: 0, y1: 0, y2: 8, class: "hatch-line" }));
    defs.append(hatch); svg.append(defs);
    const barWidth = 900 / metrics.daily.length;
    metrics.daily.forEach((day, index) => {
      if (!isCollected(day)) {
        // Cada trilha marca os mesmos dias anteriores à coleta, sem tratá-los como zero.
        svg.append(svgNode("rect", { x: index * barWidth, y: 0, width: barWidth, height: 88, class: "uncollected-day", fill: `url(#uncollected-${key})` }));
        return;
      }
      const height = day[key] / max * 74;
      if (height > 0) {
        const bar = svgNode("rect", { x: index * barWidth + barWidth * .15, y: 84 - height, width: barWidth * .7, height, rx: Math.min(3, barWidth / 5), class: "daily-value-bar" });
        const title = svgNode("title"); title.textContent = `${date(day.date)}: ${numberFormat.format(day[key])}`; bar.append(title); svg.append(bar);
      }
    });
    [0, 37, 74].forEach((height) => svg.append(svgNode("line", { x1: 0, x2: 900, y1: 84 - height, y2: 84 - height, class: "chart-gridline" })));
    row.append(label, svg, element("span", "daily-scale af-type-caption", `0–${numberFormat.format(actualMax)}`));
    chart.append(row);
  });
  const axis = element("div", "chart-axis");
  metrics.daily.forEach((row, index) => {
    const last = metrics.daily.length - 1;
    const farFromLast = last - index >= Math.max(2, Math.ceil(dateInterval / 2));
    if (index === 0 || index === last || (index % dateInterval === 0 && farFromLast)) {
      const label = element("span", "chart-label", date(row.date));
      label.style.left = `${(index + .5) / metrics.daily.length * 100}%`;
      if (index === 0) label.dataset.edge = "start";
      if (index === metrics.daily.length - 1) label.dataset.edge = "end";
      axis.append(label);
    }
    const tableRow = element("tr");
    const day = element("th", "", date(row.date)); day.scope = "row"; tableRow.append(day);
    chartKeys.forEach((key) => tableRow.append(element("td", "", isCollected(row) ? numberFormat.format(row[key]) : "Sem coleta")));
    table.append(tableRow);
  });
  chart.append(axis);
  const observedDays = metrics.daily.filter(isCollected).length;
  if (!actualMax) chart.append(element("p", "chart-zero af-type-caption", "Os dias com coleta ainda não registraram cópias, aberturas ou inícios."));
  else if (observedDays < 2) chart.append(element("p", "chart-zero af-type-caption", "Primeiro dia com registros. O ritmo aparece com os próximos dias de coleta."));
  byId("chart-description").textContent = `Três trilhas de barras diárias, na mesma escala, mostram comandos copiados, leituras abertas e reproduções iniciadas em ${metrics.daily.length} dias. Escala de zero a ${numberFormat.format(actualMax)}. Dias anteriores à coleta aparecem hachurados; não representam zero eventos. Todas as contagens estão disponíveis na tabela abaixo.`;
}
function renderOutcomes(metrics) {
  const summary = metrics.summary;
  const entries = [
    ["Inícios", summary.video_starts, "videos", "Reproduções iniciadas"],
    ["Engajadas", summary.video_engaged, "readings", "Reproduções engajadas"],
    ["Concluídas", summary.video_completions, "copies", "Reproduções concluídas"],
  ];
  const peak = Math.max(...entries.map(([, value]) => value), 1);
  byId("video-outcomes").replaceChildren(...entries.map(([label, value, tone, fullLabel]) => {
    const item = element("div", "outcome");
    const top = element("div", "outcome-heading");
    const count = element("span", "outcome-value af-type-context", numberFormat.format(value));
    count.setAttribute("aria-label", `${numberFormat.format(value)} ${fullLabel.toLocaleLowerCase("pt-BR")}`);
    top.append(element("p", "af-type-context", label), count);
    const track = element("div", "outcome-track"); track.setAttribute("aria-hidden", "true");
    const fill = element("span", tone); fill.style.width = `${value / peak * 100}%`; track.append(fill);
    item.append(top, track);
    return item;
  }));
}
function render(metrics) {
  byId("native-window-label").textContent = `${metrics.window.days} dias · ${dateTime(metrics.window.start)} a ${dateTime(metrics.window.end)} · Horário de Brasília`;
  const complete = metrics.coverage.current_complete && metrics.coverage.previous_complete;
  byId("coverage-note").dataset.incomplete = String(!complete);
  byId("coverage-label").textContent = !metrics.coverage.current_complete ? "Coleta parcial · Comparação em formação" : !metrics.coverage.previous_complete ? "Período coberto · Comparação em formação" : "Dois períodos cobertos · Comparação disponível";
  byId("coverage-text").textContent = !metrics.coverage.current_complete
    ? "A coleta começou dentro deste período. O volume é parcial e a comparação aguarda dois períodos completos."
    : !metrics.coverage.previous_complete
      ? "Este período está coberto. A comparação aguarda a cobertura completa do período anterior."
      : `Comparação com os ${metrics.window.days} dias anteriores. Os dois períodos têm cobertura de coleta.`;
  renderCards(metrics);
  renderDaily(metrics);
  renderRanking("skills-ranking", "skills", metrics.rankings.skills, titleMaps);
  renderRanking("readings-ranking", "readings", metrics.rankings.readings, titleMaps, ["Aberturas", "Visitas"]);
  renderPreference("reading-modes-ranking", "reading_modes", metrics.rankings.reading_modes);
  renderPreference("appearances-ranking", "appearances", metrics.rankings.appearances);
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
    const nativeDays = days === 396 ? 90 : days;
    const responses = await Promise.allSettled([
      client.rpc("admin_usage_metrics", { p_days: nativeDays }),
      client.rpc("admin_clarity_metrics", { p_days: days }),
      client.rpc("admin_clarity_metrics", { p_days: 3 }),
    ]);
    if (requestRevision !== revision || currentUser?.id !== requestUser) return;
    const errors = responses.map((result) => result.status === "rejected" ? result.reason : result.value.error).filter(Boolean);
    const accessError = errors.find((error) => error?.name === "AuthSessionMissingError" || ["PGRST301", "42501"].includes(error?.code));
    if (accessError) throw accessError;
    const parse = (index, normalize) => {
      const result = responses[index];
      if (result.status !== "fulfilled" || result.value.error) return null;
      try { return normalize(result.value.data); } catch { return null; }
    };
    const native = parse(0, normalizeMetrics);
    const history = parse(1, normalizeClarity);
    const recent = parse(2, normalizeClarity);
    if (native && native.window.days !== nativeDays) throw new Error("Unexpected native period");
    if (history && history.requested_days !== days) throw new Error("Unexpected Clarity period");
    if (recent && recent.requested_days !== 3) throw new Error("Unexpected recent period");
    clearMetrics();
    if (!native && !history) throw new Error("Metrics unavailable");
    byId("native-content").hidden = !native;
    byId("native-status").textContent = native ? "" : "A coleta detalhada não carregou. Use Atualizar para tentar novamente.";
    if (native) render(native);
    if (history) renderClarity(byId("clarity-dashboard"), history, recent);
    else renderClarityUnavailable(byId("clarity-dashboard"));
    byId("window-label").textContent = history ? "Microsoft Clarity · Período da importação indicado abaixo" : "Histórico Clarity indisponível · Coleta do produto abaixo";
    byId("query-status").textContent = "Consulta atualizada. A data de importação do Clarity aparece junto aos gráficos.";
    rendered = true;
    show("dashboard");
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
