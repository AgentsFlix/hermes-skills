/* Native adapters for the approved shell. Existing page HTML remains the content source.
 * CSS is scoped in a ShadowRoot; controllers mount explicitly, never replay document scripts.
 * Only finite public documents/styles are cached in memory. Auth, tokens and results are not.
 */
import { mountNavigation, bounded } from './navigation.mjs';
import { isPreviewVisual, isDormantRouteVisual, mountPreviewVisuals } from './preview-visuals.mjs';
import { mountLiveVisuals } from './live-visuals.mjs';
window.AgentFlixProductShell = true;
const $ = id => document.getElementById(id);
const header = $('shell-header'), home = $('page');
home.before(header); // The same node survives every content transition.
const parked = document.createElement('div'); parked.hidden = true; home.before(parked);
const homeView = document.createElement('div');
homeView.append(home, $('modal'), $('preview'), $('auth'), $('toast'), $('intro'));
const viewport = document.createElement('div'); viewport.id = 'viewport'; viewport.className = 'af-shell-viewport';
const screen = document.createElement('div'); screen.id = 'screen'; screen.tabIndex = -1; screen.hidden = true;
const loader = document.createElement('div'); loader.id = 'shell-loader'; loader.className = 'af-shell-loader'; loader.setAttribute('role', 'status');
loader.innerHTML = '<video muted loop playsinline preload="none" aria-hidden="true"></video><div class="af-shell-loading-content"><img src="/brand/simbolo-branco.svg" width="44" height="44" alt=""><p>Carregando sua seleção</p></div>';
const error = document.createElement('section'); error.className = 'af-shell-error af-panel'; error.id = 'shell-error'; error.hidden = true;
error.innerHTML = '<h1 tabindex="-1">Não foi possível abrir esta tela</h1><p>A seleção continua guardada. Tente novamente.</p><button class="af-button af-button--primary" id="shell-retry" type="button">Tentar novamente</button>';
viewport.append(loader, error, screen); header.after(viewport); parked.append(homeView);
$('app-loading').hidden = true; $('app-loading').querySelector('video').pause(); document.body.removeAttribute('aria-busy');

const sectionPaths = { inicio: '/', assistir: '/assistir/', ler: '/#ler', aprofundamento: '/aprofundamento-humano/' };
function parseURL(url) {
  if (url.origin !== location.origin) return null;
  if (url.pathname === '/') return { audience: 'humano', section: url.hash === '#ler' ? 'ler' : 'inicio', url: url.pathname + url.search + url.hash };
  if (/^\/compartilhar\/[a-z0-9-]+\/$/.test(url.pathname)) return { audience: 'humano', section: 'ler', url: url.pathname + url.search + url.hash, shared: true };
  if (url.pathname === '/para-agente/') return { audience: 'agente', section: 'inicio', url: url.pathname + url.search + url.hash };
  if (url.pathname === '/aprofundamento-humano/') return { audience: 'humano', section: 'aprofundamento', url: url.pathname + url.search + url.hash };
  if (url.pathname === '/assistir/' || url.pathname === '/aprender/' || /^\/aulas\/[a-z0-9-]+\/t[1-9]\d*\/e[1-9]\d*\/$/.test(url.pathname)) return { audience: 'humano', section: 'assistir', learn: url.pathname === '/aprender/', url: url.pathname + url.search + url.hash };
  return null; // OAuth, account and tools retain their own native contracts.
}
function resolve(value) {
  return value && ['humano','agente'].includes(value.audience) && Object.hasOwn(sectionPaths, value.section) ? value : null;
}
function urlFor(value) {
  const same = value.url && parseURL(new URL(value.url, location.origin));
  if (same && same.audience === value.audience && same.section === value.section && Boolean(same.learn) === Boolean(value.learn)) return value.url;
  if (value.audience === 'agente') return '/para-agente/';
  return value.section === 'assistir' && value.learn ? '/aprender/' : sectionPaths[value.section];
}
const incoming = new URL(location.href).searchParams.get('af-route');
let initial = incoming && parseURL(new URL(incoming, location.origin)) || parseURL(new URL(location.href));
if (incoming && initial) history.replaceState(null, '', initial.url);
else { initial = parseURL(new URL(location.href)); initial.url = initial.url.replace(/([?&])af-route=[^&#]*&?/, '$1').replace(/[?&]$/, ''); }
// Root-relative assets remain stable after pushState thanks to the host's <base href="/">.
const publicText = new Map(), imported = new Map();
let hlsReady;
function loadHls() {
  if (window.Hls) return Promise.resolve();
  if (hlsReady) return hlsReady;
  hlsReady = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.20/dist/hls.min.js';
    script.integrity = 'sha384-V5ruNBgmYcC3SJRUQeNykAAAgde5gOFq/Hu0CZj7bygDP0yRIhkvX8+w0u/7mRvr';
    script.crossOrigin = 'anonymous';
    script.onload = resolve; script.onerror = () => { hlsReady = null; script.remove(); reject(Error('Player dependency unavailable')); };
    document.head.append(script);
  });
  return hlsReady;
}
async function text(url, signal) {
  if (publicText.has(url)) return publicText.get(url);
  const response = await fetch(url, { signal, cache: 'no-cache' });
  if (!response.ok) throw Error('Page asset unavailable');
  const value = await response.text();
  if (!signal.aborted) publicText.set(url, value);
  return value;
}
async function modules(urls) {
  for (const url of urls) {
    if (!imported.has(url)) imported.set(url, import(url).catch(error => { imported.delete(url); throw error; }));
    await imported.get(url);
  }
}
function absoluteAssets(node, base) {
  for (const el of [node, ...node.querySelectorAll('*')]) {
    for (const attr of ['src','href','poster','action']) {
      const value = el.getAttribute(attr);
      if (value) el.setAttribute(attr, new URL(value, base).href);
    }
    if (el.hasAttribute('srcset')) el.setAttribute('srcset', el.getAttribute('srcset').split(',').map(item => {
      const [url, ...descriptor] = item.trim().split(/\s+/); return new URL(url, base).href + ' ' + descriptor.join(' ');
    }).join(', '));
  }
}
async function scopedCSS(url, signal, chain = []) {
  if (chain.includes(url)) throw Error('Circular stylesheet import');
  let css = await text(url, signal);
  const imports = [...css.matchAll(/@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?\s*;/g)];
  for (const match of imports) css = css.replace(match[0], await scopedCSS(new URL(match[1], new URL(url, location.origin)).pathname, signal, [...chain, url]));
  css = css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g, (all, quote, path) => path.startsWith('data:') || path.startsWith('#') ? all : `url("${new URL(path, new URL(url, location.origin)).href}")`);
  const sheet = new CSSStyleSheet(); sheet.replaceSync(css);
  function scope(rules) {
    for (const rule of rules) {
      if (rule.selectorText) rule.selectorText = rule.selectorText.replace(/:root\b/g, ':host').replace(/(^|[\s,>+~])body(?=[\s.#:[>+~]|$)/g, '$1[data-route-body]').replace(/(^|[\s,>+~])html(?=[\s.#:[>+~]|$)/g, '$1:host');
      if (rule.cssRules) scope(rule.cssRules);
    }
  }
  scope(sheet.cssRules);
  return [...sheet.cssRules].map(rule => rule.cssText).join('\n');
}
const definitions = {
  agent: { path: '/para-agente/', selectors: ['main','footer'], css: ['/para-agente/styles.css'], scripts: ['/para-agente/app.js'] },
  learn: { path: '/aprender/', selectors: ['main','footer'], css: ['/aprender/styles.css'], scripts: [] },
  assessment: { path: '/aprofundamento-humano/', selectors: ['main','footer','#agent-prompt-dialog'], css: ['/design-system/icons.css','/aprofundamento-humano/styles.css','/design-system/approved.css'], scripts: ['icons','agent-prompt','agent-prompt-ui','disc-data','disc-model','catalog','learning-data','assessments-data','assessments-model','results-store','results','disc','assessments'].map(name => name === 'icons' ? '/design-system/icons.js' : `/aprofundamento-humano/${name}.js`) },
  watch: { path: '/assistir/', selectors: ['.watch-tools','#watch-catalog','#watch-status','#title-page','#player'], css: ['/assistir/player.css','/assistir/catalog.css','/assistir/series-covers.css'], scripts: ['/clipboard.js','/assistir/access.js','/assistir/catalog-model.js','/assistir/catalog.js','/assistir/player.js'] },
};
let shell, activeSearch, rememberedHuman = initial.audience === 'humano' ? initial : { audience: 'humano', section: 'inicio' };
function bodyImages(root) {
  const extra = [];
  for (const el of root.querySelectorAll('*')) {
    if (isPreviewVisual(el)) continue;
    const sources = [...getComputedStyle(el).backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(match => match[1]);
    if (el.tagName === 'VIDEO' && el.poster) sources.push(el.poster);
    for (const src of sources) { const image = new Image(); image.src = src; extra.push(image); }
  }
  return extra;
}
function observeVisuals(root, life, stage) {
  mountPreviewVisuals(root.querySelector('#preview'), life);
  let revealed = false;
  // Capture failures before legacy fallback handlers remove a required image.
  const failed = new Set();
  life.listen(root, 'error', event => {
    if (revealed || event.target.tagName !== 'IMG' || isPreviewVisual(event.target) || isDormantRouteVisual(event.target, root)) return;
    failed.add(event.target);
  }, true);
  stage.beforeReady = () => {
    if ([...failed].some(image => image.getAttribute('src'))) throw Error('Required image failed');
  };
  stage.afterReady = () => {
    if (!revealed) { revealed = true; mountLiveVisuals(root, life); }
    stage.reveal?.();
  };
}
async function routeStage(target, signal) {
  const life = window.AgentFlixRouteLife.create(signal);
  try {
    if (target.audience === 'humano' && ['inicio','ler'].includes(target.section)) {
      await bounded(() => window.AgentFlixHome.ready, signal, 25000);
      const stage = { element: homeView, title: 'AgentFlix', visualRoot: homeView, images: [],
        reveal() { window.AgentFlixHome.presented(); },
        mount() { home.hidden = false; if (target.shared) window.AgentFlixHome.shared(target.url.split('/')[2]); else window.AgentFlixHome.show(target.section === 'ler' ? 'reading' : 'catalog'); activeSearch = () => window.AgentFlixHome.search(); stage.images = bodyImages(homeView); },
        dispose() { life.dispose(); window.AgentFlixHome.leave(); parked.append(homeView); activeSearch = null; },
      };
      observeVisuals(homeView, life, stage); return stage;
    }
    const kind = target.audience === 'agente' ? 'agent' : target.section === 'aprofundamento' ? 'assessment' : target.learn ? 'learn' : 'watch';
    const definition = definitions[kind];
    const [markup, styles] = await Promise.all([text(definition.path + 'index.html', signal), Promise.all([...new Set(['/design-system/tokens.css','/design-system/primitives.css','/design-system/approved.css', ...definition.css])].map(url => scopedCSS(url, signal)))]);
    await modules(definition.scripts);
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const doc = new DOMParser().parseFromString(markup, 'text/html');
    const host = document.createElement('div'); host.className = 'af-shell-route';
    const root = host.attachShadow({ mode: 'open' }), body = document.createElement('div'); body.setAttribute('data-route-body', '');
    const style = document.createElement('style'); style.textContent = styles.join('\n'); root.append(style, body);
    for (const selector of definition.selectors) {
      const original = doc.querySelector(selector); if (!original) throw Error('Page content missing');
      const node = document.importNode(original, true); node.querySelectorAll('script').forEach(script => script.remove());
      absoluteAssets(node, new URL(definition.path, location.origin)); body.append(node);
    }
    const stage = { element: host, visualRoot: root, images: [], title: doc.title,
      async mount() {
        const options = { root, life, header, routeURL: new URL(urlFor(target), location.origin) };
        if (kind === 'agent') await window.AgentFlixMountAgent(options).ready;
        if (kind === 'assessment') {
          window.AgentFlixMountAgentPrompt(options); window.AgentFlixMountAssessmentGallery(options);
          window.AgentFlixMountAssessmentResults(options);
          const disc = window.AgentFlixMountDisc(options), assessments = window.AgentFlixMountAssessments(options);
          await Promise.all([disc.ready, assessments.ready]);
        }
        if (kind === 'watch') {
          await bounded(loadHls, signal);
          options.visible = new Promise(resolve => { stage.reveal = resolve; });
          window.AgentFlixWatchAccess = window.AgentFlixMountWatchAccess(options);
          const player = window.AgentFlixMountPlayer(options); await player.ready; activeSearch = player.search;
        }
        if (kind === 'watch' || kind === 'learn') {
          const group = document.createElement('nav'); group.className = 'af-shell-nav af-shell-subnav af-type-context'; group.setAttribute('aria-label', 'Conteúdo de Assistir');
          for (const [label, learn] of [['Séries', false], ['Aprender', true]]) {
            const link = document.createElement('a'); link.textContent = label;
            link.href = learn ? '/aprender/' : '/assistir/'; if (kind === (learn ? 'learn' : 'watch')) link.setAttribute('aria-current', 'page'); group.append(link);
          }
          body.prepend(group);
        }
        stage.images = bodyImages(root);
        const focus = root.querySelector('h1'); if (focus) { focus.tabIndex = -1; stage.focus = focus; }
      },
      dispose() { life.dispose(); activeSearch = null; },
    };
    observeVisuals(root, life, stage); return stage;
  } catch (error) { life.dispose(); throw error; }
}
shell = mountNavigation({ header, viewport, screen, loader, error, retry: $('shell-retry'), marker: $('selection'), initial, resolve, parseURL, urlFor, prepare: (value, { signal }) => routeStage(value, signal), onRetry: target => { if (target.audience === 'humano' && ['inicio','ler'].includes(target.section)) window.AgentFlixHome.retry(); }, timeout: 30000 });
window.AgentFlixNavigation = shell;
// Native anchors remain useful without JS, for new tabs and for unregistered routes.
document.addEventListener('click', event => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.composedPath().find(node => node?.matches?.('a[href]'));
  if (!link || header.contains(link) || link.target && link.target !== '_self' || link.hasAttribute('download') || link.getAttribute('href').startsWith('#')) return;
  if (link.pathname.startsWith('/compartilhar/') && link.pathname !== location.pathname) return;
  const target = parseURL(new URL(link.href)); if (!target) return;
  event.preventDefault(); void shell.navigate(target);
});
header.querySelector('[data-audience="humano"]').addEventListener('click', event => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  // Capture runs before the shared shell; return to the last human destination.
  event.preventDefault(); void shell.navigate(rememberedHuman);
}, { capture: true });
new MutationObserver(() => { if (viewport.dataset.state === 'ready' && shell.current.audience === 'humano') rememberedHuman = shell.current; }).observe(viewport, { attributes: true, attributeFilter: ['data-state'] });
header.querySelector('[data-shell-search]').addEventListener('click', async () => {
  if (activeSearch) activeSearch();
  else if (await shell.navigate({ audience: 'humano', section: 'inicio' })) window.AgentFlixHome.search();
});
window.addEventListener('pagehide', () => shell.dispose(), { once: true });
