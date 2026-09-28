/* Coleta apenas em produção. ?qa=1 exclui este navegador; ?qa=0 reativa. */
(() => {
  'use strict';
  window.CONSENT_KEY = 'agentflix-consent';
  const qaKey = 'agentflix-qa', qaParam = new URLSearchParams(location.search).get('qa');
  let qa = qaParam === '1', consent = null;
  try {
    if (qaParam === '1') localStorage.setItem(qaKey, '1');
    if (qaParam === '0') localStorage.removeItem(qaKey);
    qa = qa || localStorage.getItem(qaKey) === '1';
    consent = localStorage.getItem(window.CONSENT_KEY);
  } catch {}
  const enabled = ['agentsflix.ai','www.agentsflix.ai'].includes(location.hostname) && !qa;
  window.clarity = enabled ? function () { (window.clarity.q = window.clarity.q || []).push(arguments); } : function () {};
  const keys = new Set(['skill','alvo','chave','serie','episodio','caminho','objetivo','porta','pergunta','opcao','pre_requisito','origem','salvo','tipo']);
  window.clar = function (event, tags) {
    if (!enabled) return;
    try {
      Object.entries(tags || {}).forEach(([key,value]) => { if (keys.has(key) && value != null) window.clarity('set',key,String(value)); });
      if (event) window.clarity('event',event);
    } catch {}
  };
  if (!enabled) return;
  // O consentimento entra na fila antes do carregamento do SDK.
  window.clarity('consentv2',{ad_Storage:'denied',analytics_Storage:consent === 'granted' ? 'granted' : 'denied'});
  window.clarity('set','ambiente','producao');
  window.clarity('set','versao_interface','2026-09-08-navigation-v1');
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.clarity.ms/tag/yenn89e53y';
  document.head.appendChild(script);
})();

/* Métricas próprias: ocorrências tipadas, sem conteúdo pessoal ou vínculo à conta. */
((root) => {
  'use strict';
  const kinds = new Set(['skill_open','skill_copy','reading_open','reading_mode','reading_appearance','video_start','video_engaged','video_complete']);
  const queue = [];
  let running = false, configPromise = null, visit = null, visitAt = 0;
  const production = ['agentsflix.ai','www.agentsflix.ai'].includes(root.location?.hostname);
  const uuid = () => root.crypto?.randomUUID?.();
  function excluded() {
    if (!production || new URLSearchParams(root.location.search).get('qa') === '1') return true;
    try { return root.localStorage.getItem('agentflix-qa') === '1'; } catch { return false; }
  }
  function sessionId() {
    if (visit && Date.now() - visitAt < 86400000) return visit;
    visit = null;
    const key = 'agentflix-metrics-visit-v1', now = Date.now();
    try {
      const stored = JSON.parse(root.sessionStorage.getItem(key));
      if (/^[0-9a-f-]{36}$/i.test(stored?.id || '') && now >= stored.at && now - stored.at < 86400000) { visit = stored.id; visitAt = stored.at; }
    } catch {}
    if (!visit) {
      visit = uuid(); visitAt = now;
      if (visit) try { root.sessionStorage.setItem(key, JSON.stringify({id: visit, at: now})); } catch {}
    }
    return visit;
  }
  async function configuration() {
    if (!configPromise) configPromise = root.fetch('/api/config', {cache:'no-store'})
      .then(async response => {
        if (!response.ok) throw Error('unavailable');
        const config = await response.json();
        if (!config.supabaseAnonKey || !/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(config.supabaseUrl || '')) throw Error('unavailable');
        return config;
      }).catch(error => { configPromise = null; throw error; });
    return configPromise;
  }
  async function drain() {
    if (running) return;
    running = true;
    try {
      const config = await configuration();
      while (queue.length) {
        const event = queue.shift();
        if (excluded()) { queue.length = 0; break; }
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const response = await root.fetch(`${config.supabaseUrl.replace(/\/$/,'')}/rest/v1/rpc/record_product_usage`, {
              method:'POST', keepalive:true,
              headers:{'content-type':'application/json', apikey:config.supabaseAnonKey, authorization:`Bearer ${config.supabaseAnonKey}`},
              body:JSON.stringify(event),
            });
            if (response.ok || (response.status < 500 && response.status !== 429)) break;
          } catch {}
        }
      }
    } catch { queue.length = 0; }
    finally { running = false; }
  }
  function record(kind, content = null, dimensions = {}) {
    if (excluded() || !kinds.has(kind) || queue.length >= 30) return;
    const session = sessionId(), event = uuid();
    if (!session || !event) return;
    queue.push({p_event_id:event,p_session_id:session,p_kind:kind,p_content_id:content,
      p_mode:dimensions.mode || null,p_appearance:dimensions.appearance || null});
    void drain();
  }

  // Mede trechos realmente reproduzidos. Saltos e repetição não acrescentam cobertura.
  function createPlaybackTracker(emit = record, clock = () => root.performance.now()) {
    let id = null, duration = 0, started = false, engaged = false, complete = false;
    let previous = null, wall = 0, ranges = [];
    function reset(nextId, seconds) {
      id = nextId; duration = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
      started = engaged = complete = false; previous = null; ranges = []; wall = clock();
    }
    function playing(time) {
      if (!id || !duration || !Number.isFinite(time)) return;
      previous = time; wall = clock();
      if (!started) { started = true; emit('video_start',id); }
    }
    function tick(time, {paused = false, seeking = false, rate = 1} = {}) {
      const now = clock(), elapsed = (now - wall) / 1000;
      const delta = time - previous;
      if (started && previous !== null && !paused && !seeking && Number.isFinite(time) && delta > 0 && delta <= Math.min(5, elapsed * Math.max(0,rate) + 1)) {
        ranges.push([Math.max(0,previous), Math.min(duration,time)]);
        ranges.sort((a,b) => a[0] - b[0]);
        const merged = [];
        ranges.forEach(range => {
          const last = merged[merged.length - 1];
          if (last && range[0] <= last[1]) last[1] = Math.max(last[1],range[1]); else merged.push(range);
        });
        ranges = merged;
        const watched = ranges.reduce((sum,[from,to]) => sum + Math.max(0,to-from),0);
        if (!engaged && watched >= Math.min(30,duration*.9)) { engaged = true; emit('video_engaged',id); }
        if (!complete && watched >= duration*.9) { complete = true; emit('video_complete',id); }
      }
      previous = Number.isFinite(time) ? time : null; wall = now;
    }
    return {reset,playing,tick};
  }
  root.AgentFlixMetrics = {record,createPlaybackTracker};
})(globalThis);
