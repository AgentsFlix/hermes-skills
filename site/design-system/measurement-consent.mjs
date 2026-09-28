// Transporte oficial Image Tag: payload pequeno e explícito, sem SDK ou leitura de campos.
export const CONSENT_KEY = 'agentflix-openai-ads-consent-v1';
const PENDING_KEY = 'agentflix-openai-order-v1';
const CLICK_COOKIE = 'agentflix_ads_click';
const TYPES = {page_viewed:'contents',contents_viewed:'contents',checkout_started:'contents',order_created:'contents',subscription_created:'plan_enrollment'};
const PUBLIC_CONTENT = /^[a-z0-9][a-z0-9-]{0,100}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const storage = (root, key) => { try { return root.localStorage.getItem(key); } catch { return null; } };

export function createMeasurement(root, config) {
  const production = ['agentsflix.ai','www.agentsflix.ai'].includes(root.location.hostname);
  const ads = config?.openaiAds;
  const active = production && ads?.enabled === true && /^[A-Za-z0-9_-]{8,128}$/.test(ads.pixelId || '');
  const excluded = () => !active || new URLSearchParams(root.location.search).get('qa') === '1' || storage(root,'agentflix-qa') === '1';
  const permitted = () => !excluded() && storage(root,CONSENT_KEY) === 'granted';
  const pendingImages = new Set();
  const originalFetch = root.fetch.bind(root);
  let viewed = false, checking = false, authClient = null;
  const publicPage = () => root.location.pathname === '/';
  const clearPending = () => { try { root.sessionStorage.removeItem(PENDING_KEY); } catch {} };
  function clearAttribution() {
    root.document.cookie = `${CLICK_COOKIE}=; Max-Age=0; Path=/; Secure; SameSite=Lax`;
    clearPending();
  }
  function captureClick() {
    if (!permitted()) return;
    const click = new URLSearchParams(root.location.search).get('oppref');
    if (click && /^[A-Za-z0-9_=-]{1,2048}$/.test(click)) {
      root.document.cookie = `${CLICK_COOKIE}=${encodeURIComponent(click)}; Max-Age=2592000; Path=/; Secure; SameSite=Lax`;
    }
  }
  function clickReference() {
    const entry = root.document.cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith(`${CLICK_COOKIE}=`));
    try { return entry ? decodeURIComponent(entry.slice(CLICK_COOKIE.length+1)) : null; } catch { return null; }
  }
  function measure(name, data = {}, eventId = root.crypto.randomUUID()) {
    if (!permitted() || !publicPage() || !TYPES[name] || !UUID.test(eventId)) return Promise.resolve(false);
    if (data.amount !== undefined && (!Number.isSafeInteger(data.amount) || data.amount < 0 || !/^[A-Z]{3}$/.test(data.currency || ''))) return Promise.resolve(false);
    const url = new URL('https://bzr.openai.com/v1/sdk/events');
    url.searchParams.set('pid',ads.pixelId);
    url.searchParams.set('event',name);
    url.searchParams.set('event_id',eventId);
    url.searchParams.set('data[type]',TYPES[name]);
    const click = clickReference();
    if (click && /^[A-Za-z0-9_=-]{1,2048}$/.test(click)) url.searchParams.set('oppref',click);
    if (data.contentId && PUBLIC_CONTENT.test(data.contentId)) url.searchParams.set('data[contents]',JSON.stringify([{id:data.contentId,content_type:'product'}]));
    if (data.plan_id && PUBLIC_CONTENT.test(data.plan_id)) url.searchParams.set('data[plan_id]',data.plan_id);
    if (data.amount !== undefined) {
      url.searchParams.set('data[amount]',String(data.amount));
      url.searchParams.set('data[currency]',data.currency);
    }
    if (url.href.length > 4096) return Promise.resolve(false);
    return new Promise(resolve => {
      const img = new root.Image(1,1);
      pendingImages.add(img);
      const finish = result => { root.clearTimeout(timer); pendingImages.delete(img); resolve(result); };
      const timer = root.setTimeout(()=>finish(false),10000);
      img.onload = () => finish(true);
      img.onerror = () => finish(false);
      img.referrerPolicy = 'origin';
      img.src = url.href;
    });
  }
  function pageViewed() {
    if (viewed || !permitted() || !publicPage()) return;
    captureClick(); viewed = true;
    void measure('page_viewed');
  }
  function choose(value) {
    try { root.localStorage.setItem(CONSENT_KEY,value === 'granted' ? 'granted' : 'denied'); } catch {}
    if (!permitted()) clearAttribution();
    else { pageViewed(); void checkOrder(); }
    root.dispatchEvent(new root.CustomEvent('agentflix-ads-consent'));
  }
  function reset() {
    choose('denied');
    try { root.localStorage.removeItem(CONSENT_KEY); } catch {}
    root.dispatchEvent(new root.CustomEvent('agentflix-ads-consent'));
  }
  async function observeCheckout(response) {
    if (!permitted() || !publicPage() || !response.ok) return;
    try {
      const payload = await response.clone().json(), value = payload.measurement;
      if (!payload.url || !UUID.test(value?.eventId || '') || !/^cs_(test|live)_[A-Za-z0-9]{8,200}$/.test(value?.sessionId || '')) return;
      root.sessionStorage.setItem(PENDING_KEY,JSON.stringify({sessionId:value.sessionId,eventId:value.eventId,at:Date.now()}));
      void measure('checkout_started',{contentId:value.productId,amount:value.amount,currency:value.currency});
    } catch {} // A observação nunca impede ou modifica o checkout.
  }
  function installCheckoutObserver() {
    if (excluded() || !publicPage()) return;
    root.fetch = async function(input, options) {
      const response = await originalFetch(input,options);
      try {
        const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url,root.location.href);
        const method = (options?.method || input?.method || 'GET').toUpperCase();
        if (url.origin === root.location.origin && url.pathname === '/api/checkout' && method === 'POST') await observeCheckout(response);
      } catch {}
      return response;
    };
  }
  async function checkOrder() {
    if (checking || !permitted() || !publicPage() || !config.storeEnabled) return;
    let pending;
    try { pending = JSON.parse(root.sessionStorage.getItem(PENDING_KEY)); } catch { return; }
    if (!pending || !UUID.test(pending.eventId || '') || !Number.isFinite(pending.at) || Date.now()-pending.at > 172800000) { clearPending(); return; }
    checking = true;
    try {
      // O SDK de autenticação já usado pela loja lê a sessão local; o token não é persistido aqui.
      if (!root.supabase?.createClient) return;
      if (!authClient) authClient = root.supabase.createClient(config.supabaseUrl,config.supabaseAnonKey,{auth:{autoRefreshToken:false}});
      const {data} = await authClient.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) return;
      const response = await originalFetch('/api/measurement-order',{
        method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},
        body:JSON.stringify({sessionId:pending.sessionId}),
      });
      if (!permitted()) return;
      if (response.status === 404 || response.status === 400) { clearPending(); return; }
      if (!response.ok || response.status === 202) return;
      const event = await response.json();
      if (event.ineligible) { clearPending(); return; }
      if (event.eventId !== pending.eventId || !['order_created','subscription_created'].includes(event.name)) return;
      if (await measure(event.name,event.data,event.eventId)) clearPending();
    } catch {} finally { checking = false; }
  }
  root.addEventListener('storage',event => {
    if (event.key === CONSENT_KEY || event.key === null) {
      if (!permitted()) clearAttribution(); else pageViewed();
      root.dispatchEvent(new root.CustomEvent('agentflix-ads-consent'));
    }
  });
  if (!permitted()) clearAttribution();
  installCheckoutObserver();
  pageViewed();
  const api = {active:!excluded(),permitted,choose,reset,checkOrder,
    contentViewed(id) { if (typeof id === 'string' && PUBLIC_CONTENT.test(id)) void measure('contents_viewed',{contentId:id}); },
    measure};
  root.AgentFlixAds = api;
  return api;
}

function mountConsent(root, api) {
  if (!api.active) return;
  if (!root.document.querySelector('link[href="/design-system/tokens.css"]')) {
    const tokens = root.document.createElement('link'); tokens.rel='stylesheet'; tokens.href='/design-system/tokens.css'; root.document.head.append(tokens);
  }
  const host = root.document.createElement('div');
  host.id = 'agentflix-ads-consent';
  const shadow = host.attachShadow({mode:'open'});
  shadow.innerHTML = `<link rel="stylesheet" href="/design-system/primitives.css">
    <style>
      :host{position:fixed;bottom:var(--af-space-6);right:var(--af-space-6);left:var(--af-space-6);z-index:1000;display:block;pointer-events:none}
      :host([hidden]){display:none}
      section{pointer-events:auto;max-width:680px;margin-left:auto;padding:var(--af-space-6);border-radius:var(--af-radius-dialog);background:var(--af-panel);color:var(--af-text);box-shadow:var(--af-shadow);font:400 var(--af-text-sm)/var(--af-line-height) var(--af-sans)}
      h2{margin:0 0 var(--af-space-2);font:600 var(--af-text-md)/var(--af-line-height) var(--af-sans)}
      p{margin:0 0 var(--af-space-4);color:var(--af-muted)}
      a{color:var(--af-link)}
      .actions{display:flex;flex-wrap:wrap;gap:var(--af-space-2)}
      @media(max-width:480px){:host{bottom:var(--af-space-3);left:var(--af-space-3);right:var(--af-space-3)}section{padding:var(--af-space-5)}}
    </style>
    <section role="region" aria-labelledby="ads-consent-title">
      <h2 id="ads-consent-title">Medição de anúncios</h2>
      <p>Podemos enviar à OpenAI visitas à vitrine, itens abertos e compras confirmadas para medir anúncios no ChatGPT? A escolha é opcional e separada do Clarity. <a href="/privacidade.html#anuncios">Saiba mais</a></p>
      <div class="actions"><button class="af-button" data-choice="granted">Permitir medição</button><button class="af-button af-button--secondary" data-choice="denied">Agora não</button></div>
    </section>`;
  host.hidden = true;
  root.document.body.append(host);
  function update() {
    const clarity = root.document.getElementById('consent');
    host.hidden = root.location.pathname !== '/' || storage(root,CONSENT_KEY) !== null || (clarity && !clarity.hidden);
  }
  shadow.addEventListener('click',event => {
    const choice = event.target.closest('button[data-choice]');
    if (choice) { api.choose(choice.dataset.choice); update(); }
  });
  root.addEventListener('agentflix-ads-consent',update);
  const clarity = root.document.getElementById('consent');
  if (clarity) new root.MutationObserver(update).observe(clarity,{attributes:true,attributeFilter:['hidden']});
  update();
}

export async function startMeasurement(root = window) {
  if (!['agentsflix.ai','www.agentsflix.ai'].includes(root.location.hostname)) return null;
  try {
    const response = await root.fetch('/api/config',{cache:'no-store'});
    if (!response.ok) return null;
    const api = createMeasurement(root,await response.json());
    if (root.document.readyState === 'loading') await new Promise(resolve=>root.document.addEventListener('DOMContentLoaded',resolve,{once:true}));
    mountConsent(root,api);
    // A confirmação pode chegar depois do retorno do navegador; repetir sempre com o mesmo ID.
    for (const delay of [0,2000,5000,10000,30000,60000]) root.setTimeout(()=>void api.checkOrder(),delay);
    return api;
  } catch { return null; }
}
