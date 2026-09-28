/* Reprodução, paradas e ficha da série. Entrada do acervo em catalog.js. */
(() => {
  "use strict";
  // ---------- utilidades ----------
  const $ = (id) => document.getElementById(id);
  const fmt = (s) => {
    s = Math.max(0, Math.round(s || 0));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  };
  const fmtDur = (s) => {
    s = Math.round(s || 0);
    return s < 60 ? `${s}s` : `${Math.round(s / 60)}min`;
  };
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );
  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem(k);
        return v === null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (e) {}
    },
  };
  const SELO =
    "LINK DE INDICAÇÃO · você paga o mesmo, o AgentFlix recebe comissão";

  // ---------- dados ----------
  let SERIES = [],
    SERIE = null;
  const state = {
    season: 0,
    ep: 0,
    hls: null,
    playingUid: null,
    uiTimer: null,
    drawer: false,
    pop: false,
    dseason: 0,
    ppTimer: null,
    seasonMenu: false,
    allSeasons: false,
    toastTimer: null,
    lastSave: 0,
    lastChapter: -1,
    checkout: null,
    stopped: {},
    preSeen: {},
    periodo: {},
    pselOpen: null,
    escolha: false,
    escolhaTimer: null,
    escolhaVista: {},
    pausou: {},
    miniVideo: null,
    miniResumeAt: null,
    checkoutPreview: false,
    checkoutResumeAt: null,
    streamRequest: 0,
  };
  const video = $("video");
  const curEp = () => SERIE.seasons[state.season].eps[state.ep];
  // uid conserva o progresso; stream_uid permite substituir a mídia da mesma edição.
  const mediaUid = (uid) => SERIE.seasons.flatMap(s => s.eps || []).find(e => e.uid === uid)?.stream_uid || uid;
  const base = (uid) => {
    const token = window.AgentFlixWatchAccess?.cachedToken(mediaUid(uid));
    return token ? `https://${SERIE.customer}.cloudflarestream.com/${token}` : "";
  };
  const thumb = (uid, h = 270, t) => {
    const streamBase = base(uid);
    return streamBase
      ? `${streamBase}/thumbnails/thumbnail.jpg?height=${h}${t !== undefined ? `&time=${Math.max(0, Math.floor(t))}s` : ""}`
      : (SERIE.cover_wide || SERIE.cover || "");
  };
  const progKey = (uid) => `agentflix-prog-${uid}`;
  const prog = (e) => {
    const p = store.get(progKey(e.uid), null);
    return p && e.d ? Math.min(1, p.t / e.d) : 0;
  };
  const isWatched = (e) => e.partes?.length
    ? store.get(`agentflix-finished-${e.uid}`, false) === true
    : prog(e) >= 0.95;
  const doneKey = (uid, k) => `${uid}-${k}`;
  const isDone = (uid, k) => !!store.get("agentflix-done", {})[doneKey(uid, k)];
  const markDoneStore = (uid, k) => {
    const d = store.get("agentflix-done", {});
    d[doneKey(uid, k)] = Date.now();
    store.set("agentflix-done", d);
  };
  const nextSeasonWithEps = (after) =>
    SERIE.seasons.findIndex(
      (x, i) => i > after && x.eps && x.eps.length && !x.caminho,
    ); // temporada de caminho só se entra pela escolha
  const seasonIdxByN = (n) => SERIE.seasons.findIndex((x) => +x.n === +n);
  const sN = (si) => {
    const x = SERIE.seasons[si];
    return x && x.n !== undefined ? x.n : si + 1;
  }; // número real da temporada, não a posição
  const caminhoKey = () => `agentflix-caminho-${SERIE.slug}`;
  const rootEscolha = () => {
    for (let si = 0; si < SERIE.seasons.length; si++) {
      const ei = SERIE.seasons[si].eps.findIndex((e) => e.escolha);
      if (ei >= 0) return { season: si, ep: ei };
    }
    return null;
  };
  const depoisDe = (s) => {
    if (!s.caminho) return -1;
    if (s.depois === undefined) return -1;
    const di = seasonIdxByN(s.depois);
    return di >= 0 && SERIE.seasons[di].eps.length ? di : -1;
  };
  const nextEp = () => {
    if (curEp().escolha) return null;
    const s = SERIE.seasons[state.season];
    if (state.ep + 1 < s.eps.length)
      return { season: state.season, ep: state.ep + 1 };
    if (s.caminho) {
      const di = depoisDe(s);
      return di >= 0 ? { season: di, ep: 0 } : null;
    }
    const ns = nextSeasonWithEps(state.season);
    return ns >= 0 ? { season: ns, ep: 0 } : null;
  };
  function resumeEp() {
    return AgentFlixWatchModel.resume(SERIE, store.get);
  }

  const eN = (si, ei) => AgentFlixWatchModel.episodeNumber(SERIE.seasons[si].eps[ei], ei);
  const chapters = (e) => e.ch || [];
  const extraIdx = (e) =>
    chapters(e).findIndex(
      (c) => c.acao?.tipo === "videos" && c.acao?.encerrar === true,
    );
  const chapterAt = (e, t) => {
    let k = -1;
    chapters(e).forEach((c, i) => {
      if (t >= c.t) k = i;
    });
    return k;
  };
  const buyIdx = (e) => {
    const cs = chapters(e);
    const t = video.currentTime || 0;
    let k = -1,
      first = -1;
    cs.forEach((c, i) => {
      if (
        c.acao &&
        ["link", "comando", "passo", "videos"].includes(c.acao.tipo) &&
        c.acao.parar
      ) {
        if (first < 0) first = i;
        if (c.t <= t) k = i;
      }
    });
    return k >= 0 ? k : first;
  };
  const optDefault = (a) =>
    (a.opcoes || []).find((o) => o.padrao) || (a.opcoes || [])[0];
  const optChosen = (a, uid, k) => {
    const i = state.periodo[doneKey(uid, k)];
    return i === undefined ? optDefault(a) : a.opcoes[i];
  };

  // ---------- página do título ----------
  function renderTitle() {
    const r = resumeEp();
    const re = SERIE.seasons[r.season].eps[r.ep];
    const p = !re || r.fresh ? 0 : prog(re);
    const nEps = SERIE.seasons.reduce((a, s) => a + s.eps.length, 0);
    const nChapters = SERIE.seasons.reduce((a, s) => a + (s.atividades?.length || 0), 0);
    document.title = `${SERIE.name} · AgentFlix`;
    const editorialCover = SERIE.cover_layout === "editorial-wide";
    const responsiveCover = !editorialCover && Boolean(SERIE.cover_mobile);
    $("tp-hero").closest(".tp-panel").classList.toggle("has-editorial-cover", editorialCover);
    $("tp-hero")
      .closest(".tp-panel")
      .classList.toggle("has-responsive-cover", responsiveCover);
    $("tp-hero").style.backgroundImage = (responsiveCover || editorialCover)
      ? "none"
      : `url(${SERIE.cover})`;
    $("tp-cover").classList.toggle("art-with-title", Boolean(SERIE.cover_has_title));
    $("tp-cover").hidden = !(responsiveCover || editorialCover);
    $("tp-cover").innerHTML = editorialCover
      ? `<img src="${esc(SERIE.cover)}" alt="" width="1672" height="941" fetchpriority="high">`
      : responsiveCover
      ? `<source media="(max-width: 600px)" srcset="${esc(SERIE.cover_mobile)}" width="1024" height="1536"><img src="${esc(SERIE.cover)}" alt="" width="1536" height="1024" fetchpriority="high">`
      : "";
    $("tp-kick").textContent =
      nChapters ? `${SERIE.ano} · Temporada 1 · ${nChapters} ${nChapters === 1 ? 'capítulo interativo' : 'capítulos interativos'}` : SERIE.em_breve ? `${SERIE.ano} · Temporada 1 · Em breve` : `${SERIE.badge} · ${SERIE.ano} · ${SERIE.seasons.length} temporadas disponíveis · ${nEps} episódios · HD`;
    $("tp-name").innerHTML =
      `${esc(SERIE.name)} <span>${esc(SERIE.sub)}</span>`;
    $("tp-resume-label").textContent =
      !nEps ? "Em breve" : p > 0
        ? `Continuar T${sN(r.season)}:E${eN(r.season, r.ep)}`
        : r.season || r.ep
          ? `Assistir T${sN(r.season)}:E${eN(r.season, r.ep)}`
          : "Assistir";
    const hasMaterials = SERIE.seasons.some(s => s.atividades?.length);
    document.querySelector('[data-act="resume"]').hidden = hasMaterials && !nEps;
    document.querySelector('[data-act="resume"]').disabled = !nEps;
    document.querySelector('[data-act="restart"]').hidden = !nEps;
    $("tp-resume").hidden = !(p > 0);
    $("tp-bar").style.width = Math.round(p * 100) + "%";
    $("tp-resume-text").textContent =
      re ? `T${sN(r.season)}:E${eN(r.season, r.ep)} · ${re.t} · ${fmt(re.d * (1 - p))} restantes` : "";
    $("tp-syn").textContent = SERIE.syn;
    $("tp-about").textContent = SERIE.syn;
    const cam = rootEscolha() ? store.get(caminhoKey(), null) : null;
    const cast = SERIE.cast || [];
    const castDetails = cast.length > 3
      ? `<p><span>Elenco:</span> ${esc(cast[0])}</p><details class="tp-cast"><summary>Ver elenco completo (${cast.length})</summary><ul>${cast.map(name => `<li>${esc(name)}</li>`).join("")}</ul></details>`
      : cast.length ? `<p><span>Elenco:</span> ${cast.map(esc).join(", ")}</p>` : "";
    $("tp-side").innerHTML =
      `${castDetails}<p><span>Gêneros:</span> ${SERIE.gen.map(esc).join(", ")}</p>${SERIE.traits.length ? `<p><span>Esta série é:</span> ${SERIE.traits.map(esc).join(", ")}</p>` : ""}${cam ? `<p><span>Seu caminho:</span> ${esc(cam.label)} · <button class="lnk" data-act="trocar-caminho">trocar</button></p>` : ""}`;
    if (!nEps) $("tp-side").innerHTML = "";
    renderSeasonSel();
    renderEps();
    renderMaterials();
    selectTitleTab("eps");
    requestAnimationFrame(measureDescriptions);
  }
  function selectTitleTab(tab) {
    document.querySelectorAll('.tp-tabs [role="tab"]').forEach(button => {
      const selected = button.dataset.tab === tab;
      button.classList.toggle("on", selected);
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
      $(button.getAttribute("aria-controls")).hidden = !selected;
    });
  }
  function renderMaterials() {
    const seasons = SERIE.seasons.filter(s => s.atividades?.length);
    $("tp-materials").innerHTML = seasons.length
      ? seasons.map(s => `<section class="material-season"><h3>Temporada ${s.n}</h3><ul class="material-list">${s.atividades.map(e => `<li><a class="material-card" href="${esc(AgentFlixWatchModel.assetUrl(e.url))}"><svg class="material-folder" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><path d="M3 9h18"/></svg><span class="material-copy"><span class="material-kicker">Capítulo ${e.n}${e.partes ? ` · ${e.partes} partes` : ""}</span><strong>${esc(e.t)}</strong><span class="material-description">${esc(e.desc)}</span></span><svg class="material-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-7-7 7 7-7 7"/></svg></a></li>`).join("")}</ul></section>`).join("")
      : '<p class="materials-empty">Os materiais desta série ainda não estão disponíveis.</p>';
  }
  function renderSeasonSel() {
    const s = SERIE.seasons[state.season];
    const el = $("season-sel");
    el.classList.toggle("open", state.seasonMenu);
    el.innerHTML =
      `<button data-act="season-menu" aria-haspopup="listbox" aria-expanded="${state.seasonMenu}">${state.allSeasons ? "Todos os episódios" : `Temporada ${s.n}`} <svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg></button>` +
      (state.seasonMenu
        ? `<div class="menu" role="listbox">${SERIE.seasons.map((x, i) => `<button class="${!state.allSeasons && i === state.season ? "on" : ""}" data-act="season" data-i="${i}">Temporada ${x.n}${x.caminho ? ` · Caminho: ${esc(x.caminho)}` : ""} <span>(${x.eps.length} ${x.eps.length === 1 ? "episódio" : "episódios"})</span></button>`).join("")}<hr><button class="${state.allSeasons ? "on" : ""}" data-act="season-all">Ver todos os episódios</button></div>`
        : "");
    $("eps-title").textContent = state.allSeasons
      ? "Todos os episódios"
      : `Temporada ${s.n}${s.caminho ? ` · Caminho: ${s.caminho}` : ""}`;
  }
  function epRow(e, si, ei, n, cur) {
    const p = prog(e);
    return `<li class="ep ${cur ? "cur" : ""}" data-act="open-ep" data-s="${si}" data-e="${ei}">
    <div class="n">${n}</div>
    <button class="th" data-act="open-ep" data-s="${si}" data-e="${ei}" aria-label="Assistir ${esc(e.t)}"><img src="${thumb(e.uid)}" alt="" loading="lazy"><span class="play"><i><svg viewBox="0 0 24 24"><path d="M6 4l14 8-14 8z"/></svg></i></span>${p > 0 ? `<span class="prog"><i style="width:${Math.round(p * 100)}%"></i></span>` : ""}</button>
    <div class="tx"><div class="tt"><button class="ep-title" data-act="open-ep" data-s="${si}" data-e="${ei}">${esc(e.t)}</button><span class="dur">${fmtDur(e.d)}</span></div><div class="ep-description"><p class="ds" id="desc-${si}-${ei}">${esc(e.desc)}</p><button class="desc-toggle" data-act="stop" aria-expanded="false" aria-controls="desc-${si}-${ei}" hidden>Ver descrição completa</button></div></div>
  </li>`;
  }
  function renderEps() {
    if (!SERIE.seasons.some(s => s.eps.length) && SERIE.seasons.some(s => s.atividades?.length)) {
      $("eps").innerHTML = '<p class="materials-empty">Os episódios em vídeo ainda não estão disponíveis. As atividades estão na aba Materiais.</p>';
      return;
    }
    if (SERIE.em_breve && !SERIE.seasons.some(s => s.eps.length)) {
      $("eps").innerHTML = `<div class="upcoming-season"><p>Em breve</p><h3>${esc(SERIE.sub)}</h3><p>Os episódios da temporada 1 ainda não estão disponíveis.</p></div>`;
      return;
    }
    const r = resumeEp();
    const cur = (si, ei) => si === r.season && ei === r.ep;
    if (state.allSeasons) {
      $("eps").innerHTML = SERIE.seasons
        .map(
          (s, si) =>
            `<h3 class="season-h">Temporada ${s.n} · ${esc(s.title)}</h3><ol class="eps">${s.eps.map((e, ei) => epRow(e, si, ei, eN(si, ei), cur(si, ei))).join("")}</ol>`,
        )
        .join("");
    } else {
      const s = SERIE.seasons[state.season];
      $("eps").innerHTML =
        `<ol class="eps">${s.eps.map((e, ei) => epRow(e, state.season, ei, eN(state.season, ei), cur(state.season, ei))).join("")}</ol>`;
    }
  }

  // ---------- player ----------
  async function attach(uid, startAt, autoplay) {
    const requestId = ++state.streamRequest;
    state.playingUid = uid;
    if (state.hls) {
      state.hls.destroy();
      state.hls = null;
    }
    $("err").hidden = true;
    $("spin").hidden = !autoplay;
    let token;
    try {
      token = await window.AgentFlixWatchAccess.tokenFor(mediaUid(uid));
    } catch (error) {
      const localSigningUnavailable = ["127.0.0.1", "localhost"].includes(location.hostname)
        && String(error?.message || "").includes("stream token 503");
      if (requestId === state.streamRequest)
        showErr(localSigningUnavailable
          ? "Esta prévia local não tem a chave de assinatura do vídeo. A reprodução será verificada no site publicado."
          : "Não foi possível liberar este vídeo agora. Recarregue a página; se continuar, avise o Zé com o número do episódio.");
      return;
    }
    if (requestId !== state.streamRequest) return;
    const src = `https://${SERIE.customer}.cloudflarestream.com/${token}/manifest/video.m3u8`;
    const onReady = () => {
      if (startAt > 0 && startAt < (video.duration || Infinity) - 3)
        video.currentTime = startAt;
      if (autoplay) video.play().catch(() => {});
    };
    if (window.Hls && Hls.isSupported()) {
      const hls = new Hls({ startPosition: -1 });
      state.hls = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, onReady);
      hls.on(Hls.Events.ERROR, (ev, data) => {
        if (data.fatal)
          showErr(
            "O vídeo não carregou. Recarregue a página; se continuar, avise o Zé com o número do episódio.",
          );
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.addEventListener("loadedmetadata", onReady, { once: true });
    } else
      showErr(
        window.Hls
          ? "Este navegador não toca o vídeo. Use Chrome, Safari, Edge ou Firefox atualizados."
          : "O componente de vídeo não carregou (rede ou bloqueador). Recarregue a página ou tente outra rede.",
      );
  }
  function showErr(msg) {
    $("spin").hidden = true;
    $("err").textContent = msg;
    $("err").hidden = false;
  }
  function resetOverlays() {
    $("postplay").hidden = true;
    $("preplay").hidden = true;
    closeCheckout({ restoreMini: false });
    fecharEscolha();
    $("player").classList.remove("pp", "pre");
    clearInterval(state.ppTimer);
    $("toast").hidden = true;
  }
  const usagePlayback = window.AgentFlixMetrics?.createPlaybackTracker();
  function loadEp(season, ep, { from } = {}) {
    state.season = season;
    state.ep = ep;
    const e = curEp();
    usagePlayback?.reset(`${SERIE.slug}:t${sN(season)}:e${eN(season, ep)}`, e.d);
    state.lastChapter = -1;
    $("lesson-share").hidden = !e.share_url;
    $("lesson-share").textContent = "Copiar link da aula";
    $("lesson-share-status").textContent = "";
    window.clar?.("assistiu", {
      serie: SERIE.slug,
      episodio: `T${sN(season)}E${eN(season, ep)}`,
    });
    resetOverlays();
    $("ctl-title").textContent = SERIE.name;
    $("ctl-ep").textContent = `T${sN(season)}:E${eN(season, ep)} ${e.t}`;
    $("mtitle").innerHTML =
      `<b>${esc(SERIE.name)}</b> · T${sN(season)}:E${eN(season, ep)} ${esc(e.t)}`;
    $("pi-title").textContent = SERIE.name;
    $("pi-ep").textContent = `T${sN(season)}:E${eN(season, ep)} · ${e.t}`;
    $("pi-desc").textContent = e.desc;
    $("btn-next").style.visibility = nextEp() ? "visible" : "hidden";
    $("btn-extra").hidden = extraIdx(e) < 0;
    const bi = buyIdx(e);
    $("btn-buy").hidden = bi < 0;
    if (bi >= 0)
      $("btn-buy").querySelector(".lab").textContent =
        { comando: "Prompt (P)", passo: "Passo (P)", videos: "Vídeos (P)" }[
          chapters(e)[bi].acao.tipo
        ] || (chapters(e)[bi].acao.indicacao ? "Planos da VPS (P)" : "Exercícios (P)");
    video.poster = thumb(e.uid, 720);
    const saved = store.get(progKey(e.uid), null);
    const startAt =
      from !== undefined ? from : saved && !isWatched(e) ? saved.t : 0;
    history.replaceState(null, "", AgentFlixWatchModel.lessonUrl(SERIE, season, ep)); // uma entrada de histórico por visita: Voltar não empilha episódio
    paintMarks();
    renderDrawer();
    paint();
    showUI(true);
    // antes de começar: só informação, quando o episódio pede algo de fora e ainda não foi marcado como feito
    const pk = `${e.uid}`;
    const needs = e.preplay && e.preplay.req.some((r) => r.need);
    if (needs && !state.preSeen[pk]) {
      state.preSeen[pk] = true;
      attach(e.uid, startAt, false);
      showPreplay();
      return;
    }
    attach(e.uid, startAt, true);
  }
  function showPreplay() {
    const e = curEp();
    const ch = chapters(e);
    const list = e.preplay.req
      .map((r) => {
        const temAcao = r.acao !== undefined && r.acao !== null;
        const d = temAcao && isDone(e.uid, r.acao);
        const c = temAcao ? ch[r.acao] : null;
        const oque =
          c && c.acao
            ? {
                comando: "o prompt",
                passo: "o passo",
                videos: "os vídeos",
                link: c.acao.indicacao ? "a compra" : "o link",
              }[c.acao.tipo] || "a ajuda"
            : "";
        return `<li class="${r.need && !d ? "need" : ""}"><i>${d ? "✓" : r.need ? "!" : "·"}</i><div>${esc(r.t)}${r.need && !d && c ? `<small>Ainda não tem? Sem problema: em ${fmt(c.t)} o vídeo para e abre ${oque} do lado.</small>` : ""}</div></li>`;
      })
      .join("");
    $("preplay").innerHTML =
      `<div class="pre-card"><div class="k">ANTES DE COMEÇAR · T${sN(state.season)}:E${eN(state.season, state.ep)}</div><h3>${esc(e.t)}</h3><div class="lbl">VOCÊ VAI PRECISAR DE</div><ul>${list}</ul><div class="tp-actions" style="margin-top:0"><button class="btn primary" data-act="pre-go">Começar</button></div></div>`;
    $("preplay").hidden = false;
    $("player").classList.add("pre");
  }
  function paintMarks() {
    const e = curEp();
    const d = e.d || 1;
    $("marks").innerHTML = chapters(e)
      .map((c, k) =>
        c.acao
          ? `<div class="mk ${c.acao.humano ? "human" : ""} ${isDone(e.uid, k) ? "done" : ""}" data-act="mark" data-k="${k}" style="left:${(c.t / d) * 100}%" title="${esc(c.acao.label || c.n)}"></div>`
          : "",
      )
      .join("");
  }
  function periodSel(a, uid, k) {
    const kk = doneKey(uid, k);
    const cur = optChosen(a, uid, k);
    const open = state.pselOpen === kk;
    const menu = open
      ? `<div class="psel-menu">${a.opcoes.map((o, i) => `<button class="${o === cur ? "on" : ""}" data-act="psel-pick" data-key="${kk}" data-i="${i}">${esc(o.label)}</button>`).join("")}</div>`
      : "";
    return `<div class="psel-lbl">PERÍODO</div><div class="psel-row"><div class="psel ${open ? "open" : ""}" data-psel="${kk}"><button class="psel-btn" data-act="psel-toggle" data-key="${kk}">${esc(cur.label)}<svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg></button>${menu}</div><button class="btn primary" data-act="ext" data-url="${esc(cur.url)}" data-k="${k}">${esc(a.cta || a.label)} · ${esc(cur.label)} ↗</button></div>`;
  }
  function openCheckout(k, { pausar = true, preview = false } = {}) {
    window.clar?.("parada_compra", { serie: SERIE.slug });
    const e = curEp();
    const c = chapters(e)[k];
    const a = c.acao;
    state.checkoutPreview = preview;
    state.checkoutResumeAt = preview
      ? Math.min(video.currentTime || 0, e.d || Infinity)
      : null;
    if (pausar) video.pause();
    openDrawer(false);
    openPop(false);
    $("toast").hidden = true;
    state.checkout = k;
    $("player").classList.add("checkout");
    const acao =
      a.tipo === "comando"
        ? "Copie o prompt"
        : a.tipo === "passo"
          ? "Faça o passo"
          : a.tipo === "videos"
            ? "Escolha um mini episódio"
            : a.tipo === "link" && !a.indicacao
              ? "Abra o link ao lado"
              : "Escolha o plano";
    $("vidcap").innerHTML = pausar
      ? `<i></i><span><b>Pausado.</b> ${acao} e a gente continua.</span>`
      : `<i></i><span>${acao} quando quiser${a.pausar_em !== undefined ? `; o vídeo pausa em ${fmt(a.pausar_em)}` : ""}.</span>`;
    $("vidcap").hidden = false;
    if (a.tipo === "videos") {
      renderVideoCheckout(k);
      $("checkout").hidden = false;
      return;
    }
    if (a.tipo === "passo") {
      $("checkout").innerHTML =
        `<div class="k">T${sN(state.season)}:E${eN(state.season, state.ep)} · ${fmt(c.t)} · PASSO</div><h3>${esc(a.titulo || c.n)}</h3><p>${esc(a.nota || "")}</p>
      ${a.depois ? `<div class="steps"><div class="lbl">${esc(a.depois_lbl || "O QUE FAZER")}</div><ol>${a.depois.map((x) => `<li>${esc(x)}</li>`).join("")}</ol></div>` : ""}
      <div class="psel-row" style="margin-top:18px"><button class="btn continuar" data-act="passo-feito" data-k="${k}">${esc(a.cta || "Feito, continuar o vídeo")} ▶</button></div>
      <button class="skipbtn" data-act="checkout-skip">${esc(a.pular || "Pular este passo")} ▶</button>`;
      $("checkout").hidden = false;
      return;
    }
    if (a.tipo === "comando") {
      $("vidcap").innerHTML =
        `<i></i><span><b>Pausado.</b> Copie o prompt e a gente continua.</span>`;
      $("checkout").innerHTML =
        `<div class="k">T${sN(state.season)}:E${eN(state.season, state.ep)} · ${fmt(c.t)} · PROMPT</div><h3>${esc(a.titulo || "Copie este prompt")}</h3><p>${esc(a.nota || "")}</p>
      <div class="cmdbox ${isDone(e.uid, k) ? "copied" : ""}" role="button" tabindex="0" aria-label="Copiar prompt" data-act="copiar-prompt" data-k="${k}"><span class="inner"><code>${esc(a.texto || "")}</code><span class="copybtn" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/></svg><span class="cta-lbl">${isDone(e.uid, k) ? "Copiado ✓" : "Copiar"}</span></span></span></div>
      ${a.depois ? `<div class="steps"><div class="lbl">DEPOIS DE COLAR</div><ol>${a.depois.map((x) => `<li>${esc(x)}</li>`).join("")}</ol></div>` : ""}
      <div class="cont-row">${isDone(e.uid, k) ? continuarHtml(k) : ""}</div>
      ${isDone(e.uid, k) ? "" : `<button class="skipbtn" data-act="checkout-skip">${esc(a.pular || "Já copiei, continuar o vídeo")} ▶</button>`}`;
      $("checkout").hidden = false;
      return;
    }
    $("checkout").innerHTML =
      `<div class="k">T${sN(state.season)}:E${eN(state.season, state.ep)} · ${fmt(c.t)} · ${a.indicacao ? "COMPRA" : "LINK"}</div><h3>${esc(a.titulo || (a.indicacao ? "Escolha o seu plano" : "Abra o link"))}</h3><p>${esc(a.nota || "")}</p>
    ${a.opcoes && a.opcoes.length > 1 ? periodSel(a, e.uid, k) : `<div class="psel-row"><button class="btn primary" data-act="ext" data-url="${esc(optDefault(a).url)}" data-k="${k}">${esc(a.cta || a.label)} ↗</button></div>`}
    ${a.indicacao ? `<div class="selo">${SELO}<br>Abre em nova aba. O vídeo fica pausado esperando você voltar.</div>` : ""}
    ${a.depois ? `<div class="steps"><div class="lbl">${esc(a.depois_lbl || "NA HOSTINGER, DEPOIS DO CARRINHO")}</div><ol>${a.depois.map((x) => `<li>${esc(x)}</li>`).join("")}</ol></div>` : ""}
    <div class="cont-row">${isDone(e.uid, k) ? continuarHtml(k) : ""}</div>
    ${isDone(e.uid, k) ? "" : `<button class="skipbtn" data-act="checkout-skip">${esc(a.pular || "Já tenho, continuar o vídeo")} ▶</button>`}`;
    $("checkout").hidden = false;
  }
  const continuationLabel = (k) => chapters(curEp())[k]?.acao?.encerrar ? "Concluir episódio" : "Continuar o vídeo";
  const continuarHtml = (k) =>
    `<p class="cont-hint">Quando terminar por lá, volte aqui:</p><button class="btn continuar" data-act="checkout-continuar" data-k="${k}">${continuationLabel(k)} ▶</button>`;
  // depois da ação (copiar, abrir o link) o vídeo continua pausado: só o botão terracota retoma
  function mostrarContinuar(k, msg) {
    const row = $("checkout").querySelector(".cont-row");
    if (row) row.innerHTML = continuarHtml(k);
    const skip = $("checkout").querySelector(".skipbtn");
    if (skip) skip.remove();
    $("vidcap").innerHTML = `<i></i><span><b>Pausado.</b> ${msg}</span>`;
    $("vidcap").hidden = false;
  }
  function clearMiniMode() {
    state.miniVideo = null;
    state.miniResumeAt = null;
    $("player").classList.remove("mini-playing");
  }
  function restoreEpisodeVideo(startAt, autoplay = false) {
    const e = curEp();
    clearMiniMode();
    $("ctl-title").textContent = SERIE.name;
    $("ctl-ep").textContent = `T${sN(state.season)}:E${eN(state.season, state.ep)} ${e.t}`;
    $("mtitle").innerHTML =
      `<b>${esc(SERIE.name)}</b> · T${sN(state.season)}:E${eN(state.season, state.ep)} ${esc(e.t)}`;
    video.poster = thumb(e.uid, 720);
    paintMarks();
    attach(e.uid, startAt, autoplay);
  }
  function renderVideoCheckout(k) {
    const e = curEp();
    const c = chapters(e)[k];
    const a = c.acao;
    const vids = (a.videos || [])
      .map((v, i) => {
        const active = state.miniVideo?.index === i;
        const label = v.label || `Mini episódio ${i + 1}`;
        return `<button type="button" class="mini ${active ? "on" : ""}" data-act="mini-video" data-i="${i}" aria-pressed="${active}" aria-label="Reproduzir ${i + 1}. ${esc(label)} no player principal"><span class="mini-number">${i + 1}</span><span class="mini-thumb"><img src="${thumb(v.uid, 360)}" alt="" loading="lazy"><i aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 4l14 8-14 8z"/></svg></i></span><span class="mini-copy"><b>${esc(label)}</b><small>${active ? "Reproduzindo no player" : "Mini episódio"}</small></span></button>`;
      })
      .join("");
    const footer = state.checkoutPreview
      ? `<div class="psel-row extra-return"><button class="btn continuar" data-act="extra-close">Voltar ao episódio ▶</button></div>`
      : `<div class="psel-row" style="margin-top:18px"><button class="btn continuar" data-act="passo-feito" data-k="${k}">${esc(a.cta || "Feito, continuar o vídeo")} ▶</button></div>
    <button class="skipbtn" data-act="checkout-skip">${esc(a.pular || "Pular este passo")} ▶</button>`;
    $("checkout").innerHTML =
      `<div class="k">${state.checkoutPreview ? "CONTEÚDO EXTRA · " : ""}T${sN(state.season)}:E${eN(state.season, state.ep)} · ${fmt(c.t)} · VÍDEOS</div><h3>${esc(a.titulo || c.n)}</h3><p>${esc(a.nota || "")}</p><div class="minis">${vids}</div>
    ${a.depois ? `<div class="steps"><div class="lbl">${esc(a.depois_lbl || "O QUE FAZER")}</div><ol>${a.depois.map((x) => `<li>${esc(x)}</li>`).join("")}</ol></div>` : ""}
    ${footer}`;
  }
  function playMiniVideo(i) {
    const k = state.checkout;
    const a = k === null ? null : chapters(curEp())[k]?.acao;
    const item = a?.tipo === "videos" ? a.videos?.[i] : null;
    if (!item) return;
    if (!state.miniVideo)
      state.miniResumeAt = Math.min(video.currentTime || 0, curEp().d || Infinity);
    state.miniVideo = {
      uid: item.uid,
      label: item.label || `Mini episódio ${i + 1}`,
      index: i,
    };
    $("player").classList.add("mini-playing", "ui");
    $("ctl-title").textContent = a.titulo || "Perguntas e respostas da turma";
    $("ctl-ep").textContent = `${i + 1}. ${state.miniVideo.label}`;
    $("mtitle").innerHTML = `<b>${esc(a.titulo || "Perguntas e respostas da turma")}</b> · ${i + 1}. ${esc(state.miniVideo.label)}`;
    $("marks").innerHTML = "";
    video.poster = thumb(item.uid, 720);
    $("vidcap").innerHTML = `<i></i><span><b>Reproduzindo.</b> ${esc(state.miniVideo.label)} no player principal.</span>`;
    $("vidcap").hidden = false;
    renderVideoCheckout(k);
    attach(item.uid, 0, true);
    showUI(true);
  }
  function continueCheckout() {
    const a = chapters(curEp())[state.checkout]?.acao;
    const resumeAt = Number.isFinite(a?.continuar_em)
      ? a.continuar_em
      : state.miniResumeAt;
    const wasMini = !!state.miniVideo;
    closeCheckout({ restoreMini: false });
    if (a?.encerrar) {
      endOfEpisode(true);
      return;
    }
    if (wasMini) restoreEpisodeVideo(resumeAt || 0, true);
    else {
      if (Number.isFinite(a?.continuar_em)) video.currentTime = a.continuar_em;
      video.play().catch(() => {});
    }
  }
  function openExtra() {
    const k = extraIdx(curEp());
    if (k < 0 || !$("preplay").hidden) return;
    openCheckout(k, { preview: true });
  }
  function closeExtra() {
    const resumeAt = Number.isFinite(state.checkoutResumeAt)
      ? state.checkoutResumeAt
      : state.miniResumeAt || 0;
    const wasMini = !!state.miniVideo;
    closeCheckout({ restoreMini: false });
    if (wasMini) restoreEpisodeVideo(resumeAt, true);
    else {
      video.currentTime = resumeAt;
      video.play().catch(() => {});
    }
  }
  function closeCheckout({ restoreMini = true } = {}) {
    const wasMini = !!state.miniVideo;
    const resumeAt = state.miniResumeAt;
    state.checkout = null;
    state.checkoutPreview = false;
    state.checkoutResumeAt = null;
    $("player").classList.remove("checkout");
    $("checkout").hidden = true;
    $("vidcap").hidden = true;
    if (wasMini && restoreMini) restoreEpisodeVideo(resumeAt || 0, false);
    else if (wasMini) clearMiniMode();
  }
  async function copiarPrompt(k) {
    const e = curEp();
    const a = chapters(e)[k] && chapters(e)[k].acao;
    if (!a) return;
    const texto = a.texto || "";
    const box = $("checkout").querySelector(".cmdbox");
    const lbl = box && box.querySelector(".cta-lbl");
    const done = () => {
      markDoneStore(e.uid, k);
      paintMarks();
      window.clar?.("prompt_copiado", { serie: SERIE.slug });
      if (box) {
        box.classList.add("copied");
        if (lbl) lbl.textContent = "Copiado ✓";
      }
      if (state.checkout === k)
        mostrarContinuar(
          k,
          esc(
            a.apos_copiar ||
              "Cole no Codex e dê Enter. Quando terminar, clique em Continuar o vídeo.",
          ),
        );
    };
    window.clar?.("copia_tentada", {
      serie: SERIE.slug,
      tipo: "prompt_player",
    });
    if (await window.agentflixCopy?.(texto)) done();
    else {
      window.clar?.("copia_falhou", {
        serie: SERIE.slug,
        tipo: "prompt_player",
      });
      if (box) box.classList.remove("copied");
      if (lbl) lbl.textContent = "Não foi possível copiar. Selecione o texto.";
    }
  }
  function goExternal(url, k) {
    window.clar?.("comprar_clicado", { serie: SERIE.slug });
    try {
      window.open(url, "_blank", "noopener");
    } catch (err) {}
    const e = curEp();
    const a = chapters(e)[k] && chapters(e)[k].acao;
    if (!a) return;
    markDoneStore(e.uid, k);
    paintMarks();
    if (!video.paused) video.pause();
    state.pausou[doneKey(e.uid, k)] = true; // a pausa agendada não precisa mais disparar
    if (state.checkout === k)
      mostrarContinuar(
        k,
        `Quando terminar por lá, volte e clique em ${continuationLabel(k)}.`,
      );
  }
  function setPaused(p) {
    $("player").classList.toggle("paused", p);
    $("ic-play").hidden = !p;
    $("ic-pause").hidden = p;
  }
  function toggle() {
    if (video.paused) video.play().catch(() => {});
    else video.pause();
    flash();
  }
  function flash() {
    const f = $("flash");
    f.innerHTML = video.paused
      ? '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M6 4l14 8-14 8z"/></svg>';
    f.classList.remove("go");
    void f.offsetWidth;
    f.classList.add("go");
  }
  function showUI(hold) {
    $("player").classList.add("ui");
    clearTimeout(state.uiTimer);
    if (!hold && !video.paused && !state.drawer && !state.pop)
      state.uiTimer = setTimeout(
        () => $("player").classList.remove("ui"),
        2800,
      );
  }
  const bumpUI = () => showUI(false);
  function seek(d) {
    video.currentTime = Math.min(
      video.duration || curEp().d,
      Math.max(0, video.currentTime + d),
    );
    bumpUI();
  }
  function paint() {
    const d = video.duration || curEp().d || 1;
    const t = video.currentTime || 0;
    const p = Math.min(1, t / d);
    $("fill").style.width = p * 100 + "%";
    $("knob").style.left = p * 100 + "%";
    $("remain").textContent = fmt(d - t);
    try {
      const b = video.buffered;
      if (b.length)
        $("buf").style.width =
          Math.min(100, (b.end(b.length - 1) / d) * 100) + "%";
    } catch (e) {}
  }
  function onChapter() {
    const e = curEp();
    const k = chapterAt(e, video.currentTime);
    if (k === state.lastChapter) return;
    state.lastChapter = k;
    if (k < 0) return;
    const c = chapters(e)[k];
    const a = c.acao;
    if (c.parte) $("ctl-ep").textContent = `T${sN(state.season)}:E${eN(state.season, state.ep)} · Parte ${c.parte} de ${e.partes.length} · ${e.partes[c.parte - 1].titulo}`;
    // a parada abre uma vez por carregamento da página (state.stopped); o "feito" gravado no navegador só marca check e rótulos, não suprime a pausa: Cmd+R rearma tudo
    if (a && a.parar && !state.stopped[doneKey(e.uid, k)] && !video.paused) {
      state.stopped[doneKey(e.uid, k)] = true;
      if (a.fim_parte) {
        video.pause();
        video.currentTime = Math.max(0, c.t - 0.04);
      }
      openCheckout(k, { pausar: a.pausar_em === undefined });
      return;
    }
    if (a) {
      // quem já passou por esta parada neste carregamento vê só o aviso, clicável, sem pausa
      if (state.checkout === k) return;
      const t = $("toast");
      t.className = "toast" + (a.humano ? " human" : "");
      t.dataset.act = a.parar ? "buy" : "";
      if (!a.parar) delete t.dataset.act;
      t.dataset.k = k;
      const rot = a.parar
        ? a.tipo === "comando"
          ? isDone(e.uid, k)
            ? "PROMPT COPIADO · VER DE NOVO"
            : "COPIAR O PROMPT"
          : a.tipo === "passo"
            ? isDone(e.uid, k)
              ? "PASSO FEITO · VER DE NOVO"
              : "PASSO"
            : a.tipo === "videos"
              ? isDone(e.uid, k)
                ? "VÍDEOS VISTOS · VER DE NOVO"
                : "VÍDEOS"
              : a.tipo === "link" && !a.indicacao
                ? isDone(e.uid, k)
                  ? "LINK ABERTO · VER DE NOVO"
                  : "ABRIR O LINK"
                : isDone(e.uid, k)
                  ? "COMPRA FEITA · VER OS PLANOS"
                  : "PLANOS DA VPS"
        : a.humano
          ? "REQUER VOCÊ"
          : "AÇÃO";
      t.innerHTML = `<b>${rot} →</b>${esc(a.label || c.n)}`;
      t.hidden = false;
      clearTimeout(state.toastTimer);
      state.toastTimer = setTimeout(() => {
        t.hidden = true;
      }, 5000);
      showUI(false);
    }
  }
  function saveProgress(force) {
    if (
      !SERIE ||
      state.miniVideo ||
      (state.playingUid && state.playingUid !== curEp().uid)
    )
      return;
    const now = Date.now();
    if (!force && now - state.lastSave < 4000) return;
    state.lastSave = now;
    const e = curEp();
    if (e && video.currentTime > 2)
      store.set(progKey(e.uid), { t: video.currentTime, at: now });
  }
  function endOfEpisode(confirmed = false) {
    const e = curEp();
    const finalStep = chapters(e).findIndex((c) => c.acao?.encerrar);
    if (finalStep >= 0 && confirmed !== true) {
      state.stopped[doneKey(e.uid, finalStep)] = true;
      openCheckout(finalStep);
      return;
    }
    if (e.partes?.length && confirmed === true) store.set(`agentflix-finished-${e.uid}`, true);
    store.set(progKey(e.uid), {
      t: confirmed === true ? e.d : video.duration || e.d,
      at: Date.now(),
    });
    if (e.escolha && e.escolha.t === undefined) {
      abrirEscolha(e);
      return;
    } // aula ramificada: a raiz termina e a pessoa escolhe o caminho
    const nx = nextEp();
    $("player").classList.add("pp");
    $("pp-this").textContent = `T${sN(state.season)}:E${eN(state.season, state.ep)} · ${e.t}`;
    if (!nx) {
      $("pp-card").innerHTML =
        `<div class="k">FIM DA SÉRIE</div><div class="box"><img src="${SERIE.cover_wide}" alt=""><div><h4>${esc(SERIE.name)}</h4><p>Você chegou ao fim dos episódios abertos. Volte à vitrine ou reveja um episódio.</p></div></div><button class="go pass" data-act="close-player"><span>Voltar para a série</span></button>`;
      $("postplay").hidden = false;
      return;
    }
    const ne = SERIE.seasons[nx.season].eps[nx.ep];
    $("pp-card").innerHTML =
      `<div class="k">PRÓXIMO EPISÓDIO · T${sN(nx.season)}:E${eN(nx.season, nx.ep)}</div><div class="box"><img src="${thumb(ne.uid)}" alt=""><div><h4>${esc(ne.t)}</h4><p>${esc(ne.desc)}</p></div></div><button class="go" data-act="next"><i id="pp-wipe"></i><span>▶ Reproduzindo em <em id="pp-n">5</em></span></button><button class="stay" data-act="stay">Ficar neste episódio</button>`;
    $("postplay").hidden = false;
    let n = 5;
    const w = $("pp-wipe");
    w.style.transition = "width 5s linear";
    requestAnimationFrame(() => {
      w.style.width = "100%";
    });
    state.ppTimer = setInterval(() => {
      n--;
      if ($("pp-n")) $("pp-n").textContent = n;
      if (n <= 0) {
        clearInterval(state.ppTimer);
        loadEp(nx.season, nx.ep, { from: 0 });
      }
    }, 1000);
  }
  // ---------- aula ramificada ----------
  function onPausaAgendada() {
    if (state.checkout === null) return;
    const e = curEp();
    const c = chapters(e)[state.checkout];
    const a = c && c.acao;
    if (!a || a.pausar_em === undefined) return;
    const kk = doneKey(e.uid, state.checkout);
    if (state.pausou[kk] || video.paused || video.currentTime < a.pausar_em)
      return;
    state.pausou[kk] = true;
    video.pause();
    const acao =
      a.tipo === "comando"
        ? "Copie o prompt"
        : a.tipo === "passo"
          ? "Faça o passo"
          : a.tipo === "videos"
            ? "Veja os vídeos ao lado"
            : a.tipo === "link" && !a.indicacao
              ? "Abra o link ao lado"
              : "Escolha o plano";
    $("vidcap").innerHTML =
      `<i></i><span><b>Pausado.</b> ${acao} e a gente continua.</span>`;
  }
  function onEscolha() {
    const e = curEp();
    const ch = e.escolha;
    if (
      !ch ||
      ch.t === undefined ||
      state.escolha ||
      state.escolhaVista[e.uid] ||
      video.paused
    )
      return;
    if (video.currentTime >= ch.t) {
      state.escolhaVista[e.uid] = true;
      video.pause();
      abrirEscolha(e);
    }
  }
  function abrirEscolha(e) {
    const ch = e.escolha;
    state.escolha = true;
    clearInterval(state.ppTimer);
    $("postplay").hidden = true;
    $("player").classList.remove("pp");
    closeCheckout();
    $("player").classList.add("escolha");
    const ops = ch.opcoes
      .map((o, i) => {
        if (o.em_breve)
          return `<button class="op breve" disabled aria-disabled="true"><span class="k">${i + 1}</span><span class="badge">EM BREVE</span><span class="semcapa"></span><span class="t"><b>${esc(o.label)}</b><span>${esc(o.desc || "")}</span></span></button>`;
        const target = AgentFlixWatchModel.choiceTarget(SERIE, o);
        const f = target && SERIE.seasons[target.season].eps[target.ep];
        return `<button class="op" data-act="escolher" data-i="${i}"><span class="k">${i + 1}</span><img src="${f ? thumb(f.uid, 300) : SERIE.cover_wide}" alt=""><span class="t"><b>${esc(o.label)}</b><span>${esc(o.desc || "")}</span></span></button>`;
      })
      .join("");
    const dica = ch.tempo
      ? `Escolha com o clique ou com as teclas 1, 2 e 3. Sem escolha, segue o caminho padrão.`
      : `Sem pressa: leia, compare e escolha com o clique ou com as teclas 1, 2 e 3. O vídeo espera.`;
    $("escolha").innerHTML =
      `<div class="pergunta">${esc(ch.pergunta)}<small>${dica}</small></div><div class="opcoes">${ops}</div>${ch.tempo ? `<div class="relogio"><span  id="esc-n">${ch.tempo}s</span><div class="bar"><i id="esc-bar"></i></div><span>caminho padrão em</span></div>` : ""}`;
    $("escolha").hidden = false;
    showUI(true);
    // Aquece o episódio de destino de cada opção enquanto a pessoa lê.
    ch.opcoes.forEach((o) => {
      if (o.em_breve) return;
      const target = AgentFlixWatchModel.choiceTarget(SERIE, o);
      const f = target && SERIE.seasons[target.season].eps[target.ep];
      if (f)
        fetch(`${base(f.uid)}/manifest/video.m3u8`, { mode: "cors" }).catch(
          () => {},
        );
    });
    clearInterval(state.escolhaTimer);
    if (ch.tempo) {
      const t0 = performance.now();
      state.escolhaTimer = setInterval(() => {
        const r = Math.max(0, ch.tempo - (performance.now() - t0) / 1000);
        const n = $("esc-n"),
          b = $("esc-bar");
        if (n) n.textContent = Math.ceil(r) + "s";
        if (b) b.style.width = (r / ch.tempo) * 100 + "%";
        if (r <= 0)
          escolher(
            Math.max(
              0,
              ch.opcoes.findIndex((o) => o.padrao),
            ),
          );
      }, 100);
    }
  }
  function fecharEscolha() {
    state.escolha = false;
    clearInterval(state.escolhaTimer);
    $("escolha").hidden = true;
    $("player").classList.remove("escolha");
  }
  function escolher(i) {
    const e = curEp();
    const ch = e.escolha;
    if (!ch || !state.escolha) return;
    const o = ch.opcoes[i];
    if (!o || o.em_breve) return;
    const target = AgentFlixWatchModel.choiceTarget(SERIE, o);
    if (!target) return;
    store.set(caminhoKey(), {
      temporada: o.temporada,
      episodio: o.episodio ?? 1,
      label: o.label,
      at: Date.now(),
    });
    window.clar?.("escolheu_caminho", { serie: SERIE.slug, caminho: o.label });
    fecharEscolha();
    loadEp(target.season, target.ep, { from: 0 });
    const t = $("toast");
    t.className = "toast";
    delete t.dataset.act;
    t.innerHTML = `<b>VOCÊ ESCOLHEU →</b>${esc(o.label)}`;
    t.hidden = false;
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => {
      t.hidden = true;
    }, 3500);
  }
  function trocarCaminho() {
    const r = rootEscolha();
    if (!r) return;
    store.set(caminhoKey(), null);
    state.escolhaVista = {};
    const e = SERIE.seasons[r.season].eps[r.ep];
    const from =
      e.escolha.t !== undefined
        ? Math.max(0, e.escolha.t - 1)
        : Math.max(0, (e.d || 0) - 4);
    openPlayer(r.season, r.ep, { from });
  }

  function renderDrawer() {
    $("stabs").innerHTML = SERIE.seasons
      .map(
        (s, i) =>
          `<button class="${i === state.dseason ? "on" : ""}" data-act="dseason" data-i="${i}">T${s.n} · ${esc(s.title)}</button>`,
      )
      .join("");
    const s = SERIE.seasons[state.dseason];
    $("dl").innerHTML = s.eps
      .map((e, i) => {
        const p = prog(e);
        return `<div class="dep ${state.dseason === state.season && i === state.ep ? "cur" : ""}" data-act="open-ep" data-s="${state.dseason}" data-e="${i}"><div class="n">${eN(state.dseason, i)}</div><div class="th"><img src="${thumb(e.uid, 180)}" alt="" loading="lazy">${p > 0 ? `<span class="prog"><i style="width:${Math.round(p * 100)}%"></i></span>` : ""}</div><div><div class="tt">${esc(e.t)}</div><div class="dur">${fmtDur(e.d)}</div></div></div>`;
      })
      .join("");
  }
  function openDrawer(force) {
    state.drawer = force === undefined ? !state.drawer : force;
    if (state.drawer) {
      state.dseason = state.season;
      renderDrawer();
    }
    $("drawer").hidden = !state.drawer;
    $("btn-eps").classList.toggle("on", state.drawer);
    showUI(state.drawer);
  }
  function openPop(force) {
    state.pop = force === undefined ? !state.pop : force;
    $("pop-speed").hidden = !state.pop;
    showUI(state.pop);
  }
  function toggleFs() {
    const p = $("player");
    if (document.fullscreenElement) document.exitFullscreen();
    else if (p.requestFullscreen) p.requestFullscreen();
    else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
  }

  // ---------- telas ----------
  function show(screen) {
    $("watch-catalog").hidden = true;
    document.querySelector("header.top").inert = screen === "player";
    $("title-page").hidden = screen !== "title";
    $("player").hidden = screen !== "player";
    document.body.style.overflow = screen === "player" ? "hidden" : "";
    if (screen === "title") {
      saveProgress(true);
      video.pause();
      resetOverlays();
      if (state.hls) {
        state.hls.destroy();
        state.hls = null;
      }
      video.removeAttribute("src");
      video.load();
      history.replaceState(null, "", seriesUrl(SERIE.slug));
      renderTitle();
      $("tp-name").tabIndex = -1;
      $("tp-name").focus({ preventScroll: true });
    }
  }
  function openPlayer(season, ep, opts) {
    if (!SERIE.seasons[season]?.eps[ep]) return;
    show("player");
    loadEp(season, ep, opts);
    $("player")
      .querySelector('[data-act="close-player"]')
      .focus({ preventScroll: true });
  }

  // ---------- eventos do vídeo ----------
  video.addEventListener("play", () => {
    setPaused(false);
    $("spin").hidden = true;
    bumpUI();
  });
  video.addEventListener("pause", () => {
    setPaused(true);
    saveProgress(true);
    showUI(true);
  });
  video.addEventListener("waiting", () => {
    if (!$("player").classList.contains("pre")) $("spin").hidden = false;
  });
  video.addEventListener("playing", () => {
    if (SERIE && !state.miniVideo) usagePlayback?.playing(video.currentTime);
    $("spin").hidden = true;
  });
  video.addEventListener("seeking", () => {
    if (!state.miniVideo) usagePlayback?.tick(video.currentTime, {seeking:true});
  });
  video.addEventListener("timeupdate", () => {
    paint();
    if (state.miniVideo) return;
    usagePlayback?.tick(video.currentTime, {paused:video.paused,seeking:video.seeking,rate:video.playbackRate});
    saveProgress(false);
    onChapter();
    onPausaAgendada();
    onEscolha();
  });
  // Check lesson boundaries for every displayed frame, including between timeupdate events.
  if (video.requestVideoFrameCallback) {
    const watchFrame = () => {
      if (
        SERIE &&
        !state.miniVideo &&
        curEp()?.ch?.some((c) => c.acao?.fim_parte) &&
        !video.paused
      )
        onChapter();
      video.requestVideoFrameCallback(watchFrame);
    };
    video.requestVideoFrameCallback(watchFrame);
  }
  video.addEventListener("progress", paint);
  video.addEventListener("ended", () => {
    if (state.miniVideo) {
      setPaused(true);
      showUI(true);
      return;
    }
    endOfEpisode();
  });
  video.addEventListener("volumechange", () => {
    $("btn-mute").style.opacity = video.muted || video.volume === 0 ? 0.5 : 1;
  });
  $("vol").addEventListener("input", (ev) => {
    video.volume = ev.target.value / 100;
    video.muted = video.volume === 0;
  });

  $("lesson-share").addEventListener("click", async () => {
    const url = curEp()?.share_url;
    if (!url) return;
    const fullUrl = new URL(url, window.location.origin).href;
    if (await window.agentflixCopy(fullUrl)) {
      $("lesson-share").textContent = "Link copiado ✓";
      $("lesson-share-status").textContent = "Link copiado. Cole na conversa do WhatsApp.";
    } else {
      $("lesson-share-url").value = fullUrl;
      $("lesson-share-dialog").showModal();
      $("lesson-share-url").focus();
      $("lesson-share-url").select();
    }
  });

  // ---------- cliques ----------
  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-act], [data-speed]");
    if (!el) return;
    if (el.dataset.speed) {
      video.playbackRate = parseFloat(el.dataset.speed);
      $("btn-speed").firstChild.textContent = el.dataset.speed + "x";
      document
        .querySelectorAll("[data-speed]")
        .forEach((b) => b.classList.toggle("on", b === el));
      openPop(false);
      return;
    }
    const a = el.dataset.act;
    if (a === "tab") {
      selectTitleTab(el.dataset.tab);
    } else if (a === "season-menu") {
      state.seasonMenu = !state.seasonMenu;
      renderSeasonSel();
    } else if (a === "season") {
      state.season = +el.dataset.i;
      state.allSeasons = false;
      state.seasonMenu = false;
      renderSeasonSel();
      renderEps();
    } else if (a === "season-all") {
      state.allSeasons = true;
      state.seasonMenu = false;
      renderSeasonSel();
      renderEps();
    } else if (a === "resume") {
      const r = resumeEp();
      openPlayer(r.season, r.ep);
    } else if (a === "restart") {
      openPlayer(0, 0, { from: 0 });
    } else if (a === "open-ep") {
      openDrawer(false);
      openPlayer(+el.dataset.s, +el.dataset.e);
    } else if (a === "toggle") {
      if (state.pop) {
        openPop(false);
        return;
      }
      if (state.drawer) {
        openDrawer(false);
        return;
      }
      if ((state.checkout !== null && !state.miniVideo) || !$("preplay").hidden) return;
      toggle();
    } else if (a === "seek") seek(+el.dataset.d);
    else if (a === "mute") {
      video.muted = !video.muted;
    } else if (a === "next") {
      const nx = nextEp();
      if (nx) loadEp(nx.season, nx.ep, { from: 0 });
    } else if (a === "stay") {
      $("postplay").hidden = true;
      $("player").classList.remove("pp");
      clearInterval(state.ppTimer);
      video.currentTime = 0;
      state.lastChapter = -1;
      video.play().catch(() => {});
    } else if (a === "drawer") openDrawer();
    else if (a === "extra") openExtra();
    else if (a === "extra-close") closeExtra();
    else if (a === "dseason") {
      state.dseason = +el.dataset.i;
      renderDrawer();
    } else if (a === "pop") openPop();
    else if (a === "fs") toggleFs();
    else if (a === "pre-go") {
      $("preplay").hidden = true;
      $("player").classList.remove("pre");
      video.play().catch(() => {});
    } else if (a === "psel-toggle") {
      state.pselOpen =
        state.pselOpen === el.dataset.key ? null : el.dataset.key;
      if (state.checkout !== null) openCheckout(state.checkout);
    } else if (a === "psel-pick") {
      state.periodo[el.dataset.key] = +el.dataset.i;
      state.pselOpen = null;
      if (state.checkout !== null) openCheckout(state.checkout);
    } else if (a === "ext") goExternal(el.dataset.url, +el.dataset.k);
    else if (a === "copiar-prompt") copiarPrompt(+el.dataset.k);
    else if (a === "mini-video") playMiniVideo(+el.dataset.i);
    else if (a === "passo-feito") {
      const e = curEp();
      markDoneStore(e.uid, +el.dataset.k);
      paintMarks();
      window.clar?.("passo_feito", { serie: SERIE.slug });
      continueCheckout();
    } else if (a === "checkout-skip") {
      continueCheckout();
    } else if (a === "checkout-continuar") {
      window.clar?.("continuar_clicado", { serie: SERIE.slug });
      continueCheckout();
    } else if (a === "buy") {
      if (!$("preplay").hidden) return;
      const k = el.dataset.k !== undefined ? +el.dataset.k : buyIdx(curEp());
      if (k >= 0) {
        if (state.checkout !== null) {
          if (chapters(curEp())[state.checkout]?.acao?.fim_parte) return;
          closeCheckout();
          video.play().catch(() => {});
        } else openCheckout(k);
      }
    } else if (a === "mark") {
      ev.stopPropagation();
      const k = +el.dataset.k;
      const c = chapters(curEp())[k];
      video.currentTime = c.t;
      state.lastChapter = k;
      paint();
      if (c.acao && c.acao.parar) {
        state.stopped[doneKey(curEp().uid, k)] = true;
        openCheckout(k);
      }
    } else if (a === "close-player") {
      clearInterval(state.ppTimer);
      show("title");
    } else if (a === "escolher") escolher(+el.dataset.i);
    else if (a === "trocar-caminho") trocarCaminho();
  });
  document.addEventListener("click", (ev) => {
    if (
      state.seasonMenu &&
      !ev.target.closest("#season-sel") &&
      !ev.target.closest('[data-act="season-menu"]')
    ) {
      state.seasonMenu = false;
      renderSeasonSel();
    }
    if (
      state.pselOpen &&
      !ev.target.closest("[data-psel]") &&
      !ev.target.closest('[data-act="psel-toggle"]') &&
      !ev.target.closest('[data-act="psel-pick"]')
    ) {
      state.pselOpen = null;
      if (state.checkout !== null) openCheckout(state.checkout);
    }
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.target.matches('.tp-tabs [role="tab"]')) {
      const tabs = [...document.querySelectorAll('.tp-tabs [role="tab"]')];
      let index = tabs.indexOf(ev.target);
      if (ev.key === "ArrowRight") index = (index + 1) % tabs.length;
      else if (ev.key === "ArrowLeft") index = (index - 1 + tabs.length) % tabs.length;
      else if (ev.key === "Home") index = 0;
      else if (ev.key === "End") index = tabs.length - 1;
      else return;
      ev.preventDefault();
      selectTitleTab(tabs[index].dataset.tab);
      tabs[index].focus();
      return;
    }
    if ($("player").hidden || ev.target.tagName === "INPUT" || $("lesson-share-dialog").open || ev.target.closest("#lesson-share")) return;
    const k = ev.key.toLowerCase();
    if (state.escolha) {
      if (["1", "2", "3", "4"].includes(ev.key)) escolher(+ev.key - 1);
      else if (ev.key === "Escape") {
        clearInterval(state.ppTimer);
        show("title");
      }
      return;
    }
    if (
      (ev.key === "Enter" || ev.key === " ") &&
      ev.target.matches &&
      ev.target.matches('[data-act="copiar-prompt"]')
    ) {
      ev.preventDefault();
      copiarPrompt(+ev.target.dataset.k);
      return;
    }
    if (ev.key === " ") {
      ev.preventDefault();
      if ((state.checkout !== null && !state.miniVideo) || !$("preplay").hidden) return;
      toggle();
    } else if (ev.key === "ArrowLeft") seek(-10);
    else if (ev.key === "ArrowRight") seek(10);
    else if (k === "e") openDrawer();
    else if (k === "f") toggleFs();
    else if (k === "m") video.muted = !video.muted;
    else if (k === "p") {
      if (!$("preplay").hidden) return;
      const bk = buyIdx(curEp());
      if (bk >= 0) {
        if (state.checkout !== null) {
          if (chapters(curEp())[state.checkout]?.acao?.fim_parte) return;
          closeCheckout();
          video.play().catch(() => {});
        } else openCheckout(bk);
      }
    } else if (ev.key === "Escape") {
      if (state.drawer) openDrawer(false);
      else if (state.pop) openPop(false);
      else {
        clearInterval(state.ppTimer);
        show("title");
      }
    }
  });
  $("player").addEventListener("mousemove", bumpUI);
  $("player").addEventListener("touchstart", () => showUI(false), {
    passive: true,
  });
  // scrubber
  const rail = $("rail");
  const railT = (x) => {
    const r = rail.getBoundingClientRect();
    return (
      Math.min(1, Math.max(0, (x - r.left) / r.width)) *
      (video.duration || curEp().d)
    );
  };
  rail.addEventListener("mousemove", (ev) => {
    const t = railT(ev.clientX);
    $("pv").style.left = (t / (video.duration || curEp().d)) * 100 + "%";
    $("pv-img").src = thumb(state.miniVideo?.uid || curEp().uid, 180, t);
    $("pv-time").textContent = fmt(t);
    if (rail.classList.contains("drag")) {
      video.currentTime = t;
      paint();
    }
  });
  rail.addEventListener("mousedown", (ev) => {
    if (ev.target.closest(".mk")) return;
    rail.classList.add("drag");
    video.currentTime = railT(ev.clientX);
    paint();
  });
  document.addEventListener("mouseup", () => rail.classList.remove("drag"));
  rail.addEventListener("click", (ev) => {
    if (ev.target.closest(".mk")) return;
    video.currentTime = railT(ev.clientX);
    paint();
    bumpUI();
  });
  rail.addEventListener(
    "touchstart",
    (ev) => {
      if (ev.target.closest(".mk")) return;
      video.currentTime = railT(ev.touches[0].clientX);
      paint();
    },
    { passive: true },
  );
  rail.addEventListener(
    "touchmove",
    (ev) => {
      video.currentTime = railT(ev.touches[0].clientX);
      paint();
    },
    { passive: true },
  );
  window.addEventListener("beforeunload", () => {
    if (!$("player").hidden) saveProgress(true);
  });

  // A descrição completa continua acessível sem transformar o texto em ação de reprodução.
  function measureDescriptions() {
    const syn = $("tp-syn"),
      toggle = document.querySelector(".syn-toggle");
    if (syn && toggle && !syn.parentElement.classList.contains("expanded"))
      toggle.hidden = syn.scrollHeight <= syn.clientHeight + 1;
    document.querySelectorAll(".ep-description").forEach((el) => {
      const p = el.querySelector(".ds"),
        b = el.querySelector(".desc-toggle");
      if (!el.classList.contains("expanded"))
        b.hidden = p.scrollHeight <= p.clientHeight + 1;
    });
  }
  new MutationObserver(() =>
    requestAnimationFrame(measureDescriptions),
  ).observe($("eps"), { childList: true });
  window.addEventListener("resize", measureDescriptions);
  document.addEventListener("click", (e) => {
    const syn = e.target.closest(".syn-toggle");
    if (syn) {
      const expanded = syn.parentElement.classList.toggle("expanded");
      syn.setAttribute("aria-expanded", String(expanded));
      syn.textContent = expanded ? "Recolher sinopse" : "Ler sinopse completa";
      return;
    }
    const b = e.target.closest(".desc-toggle");
    if (!b) return;
    const expanded = b.parentElement.classList.toggle("expanded");
    b.setAttribute("aria-expanded", String(expanded));
    b.textContent = expanded ? "Recolher descrição" : "Ver descrição completa";
  });

  // ---------- navegação entre acervo, ficha e player ----------
  let catalog = null;
  function releaseVideo() {
    state.streamRequest += 1;
    saveProgress(true);
    video.pause();
    resetOverlays();
    if (state.hls) {
      state.hls.destroy();
      state.hls = null;
    }
    video.removeAttribute("src");
    video.load();
    openDrawer(false);
    openPop(false);
  }
  function seriesUrl(slug) {
    const url = new URL("/assistir/", location.origin);
    if (slug) url.searchParams.set("s", slug);
    else url.searchParams.delete("s");
    url.hash = "";
    return url;
  }
  function showCatalog({ push = false, focus = false } = {}) {
    if (SERIE) releaseVideo();
    $("player").hidden = true;
    $("title-page").hidden = true;
    $("watch-catalog").hidden = false;
    document.querySelector("header.top").inert = false;
    document.body.style.overflow = "";
    if (push) history.pushState(null, "", seriesUrl(null));
    document.title = "Assistir · AgentFlix";
    catalog.render();
    if (focus) {
      const h = $("watch-catalog").querySelector("h1,h2");
      if (h) {
        h.tabIndex = -1;
        h.focus({ preventScroll: true });
      }
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }
  function selectSeries(slug, play = false, episode = null) {
    const series = SERIES.find((s) => s.slug === slug);
    if (!series) return;
    if (SERIE) releaseVideo();
    SERIE = series;
    state.season = 0;
    state.ep = 0;
    state.allSeasons = false;
    state.seasonMenu = false;
    history.pushState(null, "", seriesUrl(slug));
    if (episode) openPlayer(episode.season, episode.ep);
    else if (play) {
      const r = resumeEp();
      openPlayer(r.season, r.ep);
    } else {
      show("title");
      $("tp-name").tabIndex = -1;
      $("tp-name").focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }
  function route() {
    const lesson = AgentFlixWatchModel.lessonRoute(location.pathname);
    const slug = lesson?.slug || new URLSearchParams(location.search).get("s");
    if (!slug) {
      showCatalog();
      return;
    }
    const series = SERIES.find((s) => s.slug === slug);
    if (SERIE) releaseVideo();
    if (!series) {
      showCatalog();
      catalog.message(
        "Série não encontrada",
        "Volte ao acervo para escolher uma série disponível.",
      );
      return;
    }
    SERIE = series;
    state.season = 0;
    state.ep = 0;
    state.allSeasons = false;
    state.seasonMenu = false;
    const m = lesson ? [null, lesson.season, lesson.episode] : /^#t(\d+)e(\d+)$/.exec(location.hash);
    const si = m ? seasonIdxByN(m[1]) : -1;
    const activity = m && si >= 0 && SERIE.seasons[si].atividades?.find(e => e.n === +m[2]);
    const ei = m && si >= 0 ? SERIE.seasons[si].eps.findIndex((e, i) => eN(si, i) === +m[2]) : -1;
    if (ei >= 0) openPlayer(si, ei);
    else if (activity) { location.assign(activity.url); return; }
    else show("title");
  }
  async function loadCatalog() {
    try {
      const response = await fetch("/assistir/series.json", { cache: "no-store" });
      if (!response.ok) throw Error("Catálogo indisponível");
      const data = await response.json();
      if (!Array.isArray(data.series)) throw Error("Catálogo inválido");
      for (const series of data.series) {
        for (const key of ["cover", "cover_wide", "cover_mobile"])
          if (series[key]) series[key] = AgentFlixWatchModel.assetUrl(series[key]);
      }
      data.series = data.series.filter((series) =>
        window.AgentFlixWatchAccess.allowsSeries(series.slug),
      );
      const streamUids = data.series.flatMap((series) =>
        series.seasons.flatMap((season) =>
          (season.eps || []).flatMap((episode) =>
            [episode.uid, episode.stream_uid].filter(Boolean),
          ),
        ),
      );
      await window.AgentFlixWatchAccess.prefetch(streamUids);
      SERIES = data.series;
      catalog = AgentFlixWatchCatalog.create(data, {
        read: store.get,
        select: selectSeries,
        home: () => showCatalog({ push: true, focus: true }),
      });
      route();
    } catch (error) {
      $("watch-catalog").innerHTML =
        '<div class="watch-state"><h1>Não foi possível carregar as séries</h1><p>Tente novamente em instantes.</p><button class="watch-button primary" id="watch-retry">Tentar novamente</button></div>';
      $("watch-retry").onclick = loadCatalog;
    }
  }
  window.addEventListener("popstate", () => {
    if (catalog) route();
  });
  document.addEventListener("click", (event) => {
    const link = event.target.closest("[data-watch-home]");
    if (
      !link ||
      !catalog ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    catalog.reset();
    showCatalog({ push: true, focus: true });
  });
  async function start() {
    const allowed = await window.AgentFlixWatchAccess?.ready;
    if (allowed) loadCatalog();
  }
  start();
})();
