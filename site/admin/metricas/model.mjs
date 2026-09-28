/* Modelo puro do painel: nenhuma autenticação, armazenamento ou dado pessoal. */
export const METRIC_KEYS = Object.freeze([
  "active_visits", "skill_copies", "reading_opens", "video_starts", "video_engaged", "video_completions",
]);
export const PERIODS = Object.freeze([7, 30, 90]);
export const READING_MODES = Object.freeze({ human: "Para o humano", skill: "Skill", agent: "Para o agente" });
export const APPEARANCES = Object.freeze({ dark: "Escuro", paper: "Papel" });
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const timestamp = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));

export function normalizeMetrics(value) {
  if (!value || !timestamp(value.generated_at) || !value.window || !PERIODS.includes(value.window.days)) {
    throw new TypeError("Resposta de métricas inválida");
  }
  for (const key of ["start", "end", "previous_start", "previous_end"]) {
    if (!timestamp(value.window[key])) throw new TypeError("Período indisponível");
  }
  if (value.collection_started_at !== null && !timestamp(value.collection_started_at)) throw new TypeError("Coleta indisponível");
  for (const key of ["current_complete", "previous_complete"]) {
    if (typeof value.coverage?.[key] !== "boolean") throw new TypeError("Cobertura indisponível");
  }
  const counters = (input) => Object.fromEntries(METRIC_KEYS.map((key) => {
    if (!integer(input?.[key])) throw new TypeError("Contagem indisponível");
    return [key, input[key]];
  }));
  const rankings = {};
  for (const key of ["skills", "readings", "reading_modes", "appearances", "lessons"]) {
    if (!Array.isArray(value.rankings?.[key])) throw new TypeError("Ranking indisponível");
    rankings[key] = value.rankings[key].map((row) => {
      if (!row || typeof row.content_id !== "string" || !row.content_id || !integer(row.events) || !integer(row.visits)) {
        throw new TypeError("Linha de ranking inválida");
      }
      const item = { content_id: row.content_id, events: row.events, visits: row.visits };
      if (key === "lessons") {
        if (!integer(row.engaged) || !integer(row.completions)) throw new TypeError("Aula indisponível");
        item.engaged = row.engaged;
        item.completions = row.completions;
      }
      return item;
    }).sort((a, b) => b.events - a.events || a.content_id.localeCompare(b.content_id, "pt-BR"));
  }
  if (!Array.isArray(value.daily)) throw new TypeError("Histórico indisponível");
  const daily = value.daily.map((row) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row?.date || "") || !timestamp(row.date) || new Date(row.date).toISOString().slice(0, 10) !== row.date) throw new TypeError("Dia inválido");
    const item = { date: row.date };
    for (const key of ["skill_copies", "reading_opens", "video_starts"]) {
      if (!integer(row[key])) throw new TypeError("Histórico inválido");
      item[key] = row[key];
    }
    return item;
  }).sort((a, b) => a.date.localeCompare(b.date));
  return {
    generated_at: value.generated_at, collection_started_at: value.collection_started_at,
    window: { ...value.window }, coverage: { ...value.coverage },
    summary: counters(value.summary), previous: counters(value.previous), rankings, daily,
  };
}

export function comparison(current, previous, coverage) {
  if (!integer(current) || !integer(previous) || !coverage?.current_complete || !coverage?.previous_complete) return { kind: "incomplete", percent: null };
  if (previous === 0) return { kind: current === 0 ? "unchanged" : "new", percent: null };
  const percent = Math.round((current - previous) / previous * 100);
  return { kind: percent > 0 ? "up" : percent < 0 ? "down" : "unchanged", percent };
}

export function percentage(part, whole) {
  return integer(part) && integer(whole) && whole > 0 && part <= whole ? Math.round(part / whole * 100) : null;
}

export function buildTitleMaps(catalog = {}, manifest = {}, series = {}) {
  const skills = {}, readings = {}, lessons = {};
  for (const item of Array.isArray(catalog?.skills) ? catalog.skills : []) {
    const id = item.name || item.slug;
    if (id) skills[id] = item.title || item.name || id;
  }
  for (const item of Array.isArray(manifest?.readings) ? manifest.readings : []) {
    if (item.slug) readings[item.slug] = item.fallback?.title || item.title || skills[item.slug] || item.slug;
  }
  for (const item of Array.isArray(series?.series) ? series.series : []) {
    for (const season of Array.isArray(item.seasons) ? item.seasons : []) {
      for (const [index, episode] of (Array.isArray(season.eps) ? season.eps : []).entries()) {
        const number = episode.n ?? index + 1;
        lessons[`${item.slug}:t${season.n}:e${number}`] = {
          title: episode.t || `Episódio ${number}`, context: `${item.name || item.slug} · T${season.n}:E${number}`,
        };
      }
    }
  }
  return { skills, readings, lessons };
}

export function contentTitle(kind, id, maps) {
  if (kind === "reading_modes") return READING_MODES[id] || id;
  if (kind === "appearances") return APPEARANCES[id] || id;
  if (kind === "lessons") return maps?.lessons?.[id]?.title || id;
  return maps?.[kind]?.[id] || maps?.skills?.[id] || id;
}

export function observations(metrics, maps = {}) {
  const items = [];
  const topSkill = metrics.rankings.skills[0];
  if (topSkill?.events) items.push({ title: "Onde aprofundar as skills", text: `${contentTitle("skills", topSkill.content_id, maps)} lidera os comandos copiados no período. Revise essa experiência e os pedidos que ela atende antes de ampliar o acervo.` });
  const topMode = metrics.rankings.reading_modes[0];
  if (topMode?.events) items.push({ title: "Como o conteúdo é acessado", text: `${contentTitle("reading_modes", topMode.content_id, maps)} concentra o maior volume de acessos aos modos de leitura, incluindo trocas durante a visita. Use esse recorte para priorizar a revisão do formato.` });
  const topLesson = metrics.rankings.lessons[0];
  if (topLesson?.events) items.push({ title: "Onde observar a continuidade", text: `${contentTitle("lessons", topLesson.content_id, maps)} lidera as reproduções iniciadas. Compare inícios, engajamento e conclusões da aula antes de decidir uma mudança.` });
  const change = comparison(metrics.summary.active_visits, metrics.previous.active_visits, metrics.coverage);
  if (change.kind === "up" || change.kind === "down") {
    items.push({ title: "Movimento de visitas", text: `As visitas com atividade ${change.kind === "up" ? "cresceram" : "diminuíram"} ${Math.abs(change.percent)}% em relação aos ${metrics.window.days} dias anteriores. Investigue origem e contexto desse movimento.` });
  }
  return items.slice(0, 3);
}
