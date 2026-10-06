/* Aulas públicas são explícitas; direitos do acervo ficam no Supabase e tokens no servidor. */
function AgentFlixMountWatchAccess(options) {
  "use strict";
  const { root = document, life = window.AgentFlixRouteLife?.create() || { signal: new AbortController().signal, onDispose() {} }, routeURL = new URL(location.href) } = options || {};

  const CATALOG_PRODUCT_ID = "assistir";
  const SERIES_PRODUCT_PREFIX = `${CATALOG_PRODUCT_ID}:`;
  const tokenCache = new Map();
  const accessScope = { catalog: false, series: new Set() };
  let client = null;
  let session = null;
  let publicLessons = [];
  let publicSeries = [];
  let publicOnly = false;

  const pendingStyle = document.createElement("style");
  pendingStyle.textContent = "html.watch-access-pending body{visibility:hidden}";
  if (root === document) { document.documentElement.classList.add("watch-access-pending"); document.head.append(pendingStyle); }

  function withBody(callback) {
    if (document.body) callback();
    else document.addEventListener("DOMContentLoaded", callback, { once: true });
  }

  function loadSupabase() {
    if (window.supabase?.createClient) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/dist/umd/supabase.min.js";
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });
  }

  function loadMemory() {
    if (window.AgentFlixMemory?.connect) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/memory.js";
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });
  }

  async function config() {
    const response = await fetch("/api/config", {
      cache: "no-store", signal: life.signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error("config unavailable");
    const value = await response.json();
    if (!value?.supabaseUrl || !value?.supabaseAnonKey) throw new Error("auth unavailable");
    return value;
  }

  function nextPath() {
    const path = `${routeURL.pathname}${routeURL.search}${routeURL.hash}`;
    return path.startsWith("/") ? path : "/assistir/";
  }

  function requestedSeriesSlug() {
    const url = routeURL;
    const fromQuery = url.pathname.replace(/\/$/, "") === "/assistir" ? url.searchParams.get("s") : null;
    const fromPath = /^\/(?:assistir|aulas)\/([a-z0-9]+(?:-[a-z0-9]+)*)\//.exec(url.pathname)?.[1];
    const slug = fromQuery || fromPath;
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug || "") ? slug : null;
  }

  function allowsSeries(slug) {
    return publicOnly
      ? publicSeries.includes(slug) || publicLessons.some((lesson) => lesson.series === slug)
      : accessScope.catalog || accessScope.series.has(slug);
  }

  function allowsEpisode(slug, season, episode, uid) {
    return publicOnly
      ? publicSeries.includes(slug) || publicLessons.some((lesson) => lesson.series === slug && lesson.season === season
        && lesson.episode === episode && lesson.uid === uid)
      : allowsSeries(slug);
  }

  async function isPublicLessonRoute() {
    try {
      const response = await fetch("/assistir/public-lessons.json", {
        cache: "no-store", signal: life.signal,
      });
      if (!response.ok) return false;
      const value = await response.json();
      if (!Array.isArray(value?.lessons)) return false;
      publicLessons = value.lessons.filter((lesson) => /^[a-f0-9]{32}$/.test(lesson?.uid));
      publicSeries = (Array.isArray(value.series) ? value.series : [])
        .filter((slug) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug));
      if (publicSeries.includes(requestedSeriesSlug())) return true;
      return publicLessons.some((lesson) =>
        routeURL.pathname.replace(/\/$/, "") === lesson.path.replace(/\/$/, "")
        || (routeURL.pathname.replace(/\/$/, "") === "/assistir"
          && routeURL.searchParams.get("s") === lesson.series
          && routeURL.hash === `#t${lesson.season}e${lesson.episode}`),
      );
    } catch {
      return false;
    }
  }

  async function resolveAccessScope() {
    const { data: catalogAllowed, error: catalogError } = await client.rpc("has_access", {
      p_product_id: CATALOG_PRODUCT_ID,
    });
    if (catalogError) throw catalogError;
    accessScope.catalog = catalogAllowed === true;
    if (accessScope.catalog) return true;

    const { data: rights, error: rightsError } = await client.rpc("my_access");
    if (rightsError) throw rightsError;
    for (const right of rights || []) {
      if (typeof right?.product_id === "string" && right.product_id.startsWith(SERIES_PRODUCT_PREFIX)) {
        accessScope.series.add(right.product_id.slice(SERIES_PRODUCT_PREFIX.length));
      }
    }
    return accessScope.series.size > 0;
  }

  function hideWatchSurface() {
    root.getElementById("title-page")?.setAttribute("hidden", "");
    root.getElementById("player")?.setAttribute("hidden", "");
    const tools = root.querySelector(".watch-tools");
    if (tools) tools.hidden = true;
  }

  function showState(title, message, action) {
    if (life.signal.aborted) return;
    withBody(() => {
      hideWatchSurface();
      const catalog = root.getElementById("watch-catalog");
      const state = `<section class="watch-state watch-access-state"><p class="watch-kicker">AgentFlix · Assistir</p><h1>${title}</h1><p>${message}</p>${action || ""}</section>`;
      if (catalog) {
        catalog.hidden = false;
        catalog.innerHTML = state;
      } else {
        document.body.innerHTML = `<main style="max-width:680px;margin:0 auto;padding:72px 24px;font-family:Archivo,Arial,sans-serif;line-height:1.5;background:#141414;color:#f5f5f5;min-height:100vh">${state}</main>`;
      }
      document.documentElement.classList.remove("watch-access-pending");
      pendingStyle.remove();
    });
  }

  async function authorize() {
    try {
      if (await isPublicLessonRoute()) {
        await loadMemory();
        if (life.signal.aborted) return false;
        publicOnly = true;
        document.documentElement.classList.remove("watch-access-pending");
        pendingStyle.remove();
        return true;
      }
      await Promise.all([loadSupabase(), loadMemory()]);
      const publicConfig = await config();
      client = window.supabase.createClient(publicConfig.supabaseUrl, publicConfig.supabaseAnonKey);
      life.onDispose(() => { session = null; tokenCache.clear(); client.auth.stopAutoRefresh?.(); });
      const result = await client.auth.getSession();
      if (life.signal.aborted) return false;
      session = result.data?.session || null;
      if (!session?.user) {
        window.AgentFlixMemory.clearSignedOut();
        const login = `/entrar/?next=${encodeURIComponent(nextPath())}`;
        showState(
          "Entre para assistir",
          "As séries e materiais do AgentFlix ficam disponíveis para alunos com acesso liberado.",
          `<a class="watch-button primary" href="${login}">Entrar na AgentFlix</a>`,
        );
        return false;
      }
      const memory = await window.AgentFlixMemory.connect(client, session.user);
      if (life.signal.aborted) return false;
      const subscription = client.auth.onAuthStateChange((_event, next) => {
        if (next?.user?.id === session?.user?.id) return;
        session = null; tokenCache.clear(); accessScope.catalog = false; accessScope.series.clear();
        root.getElementById('video')?.pause();
        showState('Entre novamente para assistir', 'Sua sessão mudou. Confirme a conta antes de continuar.', '<a class="watch-button primary" href="/entrar/">Entrar</a>');
      });
      life.onDispose(() => { session = null; tokenCache.clear(); subscription.data?.subscription?.unsubscribe(); client.auth.stopAutoRefresh?.(); });
      const reloadKey = `agentflix-memory-reload:${session.user.id}:${location.pathname}`;
      if (memory.changed && !root.getElementById("watch-catalog")) {
        let reloading = false;
        try {
          reloading = sessionStorage.getItem(reloadKey) === "1";
          if (!reloading) sessionStorage.setItem(reloadKey, "1");
        } catch {
          // Sem sessionStorage, a página continua com o estado local e sincroniza no próximo acesso.
        }
        if (!reloading) {
          location.reload();
          return await new Promise(() => {});
        }
      } else {
        try {
          sessionStorage.removeItem(reloadKey);
        } catch {
          // Nada a limpar quando o navegador bloqueia sessionStorage.
        }
      }
      if (!(await resolveAccessScope())) {
        showState(
          "Seu acesso ainda não está liberado",
          "Se você já é aluno, entre com o mesmo e-mail usado na compra. Para ajuda, fale com o suporte.",
          '<a class="watch-button secondary" href="/conta/">Ir para minha conta</a>',
        );
        return false;
      }
      if (life.signal.aborted) return false;
      if (!allowsSeries(requestedSeriesSlug()) && requestedSeriesSlug()) {
        showState(
          "Esta série ainda não está liberada",
          "Seu acesso atual não inclui esta série. Para ajuda, fale com o suporte.",
          '<a class="watch-button secondary" href="/assistir/">Ver minhas séries</a>',
        );
        return false;
      }
      document.documentElement.classList.remove("watch-access-pending");
      pendingStyle.remove();
      return true;
    } catch {
      showState(
        "Não foi possível confirmar seu acesso",
        "Atualize a página. Se continuar acontecendo, tente novamente em alguns minutos.",
        '<button class="watch-button secondary" type="button" onclick="location.reload()">Tentar novamente</button>',
      );
      return false;
    }
  }

  async function tokenFor(uid) {
    // Para séries inteiras, o servidor confirma série, produto e mídia ativa por UID.
    const publicVideo = publicOnly && (publicSeries.includes(requestedSeriesSlug())
      || publicLessons.some((lesson) => lesson.uid === uid));
    if (!/^[a-f0-9]{32}$/.test(uid) || (!publicVideo && !session?.access_token)) throw new Error("invalid stream request");
    const now = Math.floor(Date.now() / 1000);
    const cached = tokenCache.get(uid);
    if (cached && cached.expires_at > now + 30) return cached.token;
    if (cached?.pending) return cached.pending;

    const pending = fetch(`/api/stream-token?uid=${encodeURIComponent(uid)}`, {
      cache: "no-store", signal: life.signal,
      headers: {
        accept: "application/json",
        ...(session?.access_token ? { authorization: `Bearer ${session.access_token}` } : {}),
      },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`stream token ${response.status}`);
        const value = await response.json();
        if (typeof value?.token !== "string" || !Number.isInteger(value.expires_at)) throw new Error("invalid stream token");
        tokenCache.set(uid, value);
        return value.token;
      })
      .catch((error) => {
        tokenCache.delete(uid);
        throw error;
      });
    tokenCache.set(uid, { pending });
    return pending;
  }

  async function prefetch(uids) {
    const unique = [...new Set(uids)].filter((uid) => /^[a-f0-9]{32}$/.test(uid));
    // Uma mídia indisponível não impede o aluno de abrir o acervo.
    // A reprodução ainda exige tokenFor(), que aplica a autorização individual.
    await Promise.allSettled(unique.map(tokenFor));
  }

  const access = Object.freeze({
    ready: authorize(),
    allowsSeries,
    allowsEpisode,
    prefetch,
    cachedToken: (uid) => tokenCache.get(uid)?.token || null,
    tokenFor,
  });
  return access;
}
window.AgentFlixMountWatchAccess = AgentFlixMountWatchAccess;
if (!window.AgentFlixShellEntry && !window.AgentFlixProductShell) window.AgentFlixWatchAccess = AgentFlixMountWatchAccess();
