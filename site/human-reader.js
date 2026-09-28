/* Toda leitura usa a mesma ficha, registrada em leitura/manifest.json. */
(() => {
  let READINGS = Object.create(null);
  let SHARES = Object.create(null);
  let FORMATS = Object.create(null);
  async function catalogSkills(skills) {
    const response = await fetch('leitura/manifest.json', {cache:'no-cache'});
    if(!response.ok) throw Error('Registro de leituras indisponível');
    const manifest = await response.json();
    if(manifest.schemaVersion !== 1 || !Array.isArray(manifest.readings)) throw Error('Registro de leituras inválido');
    READINGS = Object.create(null);
    SHARES = Object.create(null);
    FORMATS = Object.create(null);
    const result = skills.map(s => ({...s}));
    for(const entry of manifest.readings) {
      if(!/^[a-z0-9-]+$/.test(entry.slug) || !/^leitura\/[a-z0-9-]+\.json$/.test(entry.reader) || READINGS[entry.slug]) throw Error('Leitura inválida ou duplicada');
      READINGS[entry.slug] = entry.reader;
      SHARES[entry.slug] = entry.share;
      FORMATS[entry.slug] = entry.format === 'essay' ? 'essay' : 'standard';
      let skill = result.find(s => (s.name || s.slug) === entry.slug);
      if(!skill && entry.fallback) { skill = {...entry.fallback}; result.push(skill); }
      if(!skill) throw Error('Leitura sem skill: ' + entry.slug);
      if(entry.cover) skill.reading_cover = entry.cover;
      if(entry.share) skill.reading_share = entry.share;
    }
    return result;
  }
  const cache = new Map();
  let active = null;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const shell = '<section id="human-reader" role="tabpanel" aria-labelledby="reader-tab-human"><div class="reading-toolbar"><div class="reading-settings"><button type="button" id="hr-reading-toggle" aria-expanded="false" aria-controls="hr-reading-options"><span aria-hidden="true">Aa</span><span>Leitura</span></button><div id="hr-reading-options" role="region" aria-label="Preferências de leitura" hidden><div class="settings-heading"><strong>Conforto de leitura</strong><button type="button" id="hr-reading-dismiss" aria-label="Fechar ajustes de leitura">×</button></div><fieldset><legend>Tamanho do texto</legend><div class="text-size-control"><button type="button" id="hr-text-smaller" aria-label="Diminuir texto">A−</button><output id="hr-text-size" aria-live="polite">Padrão</output><button type="button" id="hr-text-larger" aria-label="Aumentar texto">A+</button></div></fieldset><fieldset><legend>Aparência</legend><div class="theme-options"><button type="button" data-reading-theme="dark" aria-pressed="true"><span class="theme-swatch swatch-dark" aria-hidden="true">Aa</span><span>Escuro</span><span class="theme-check" aria-hidden="true">✓</span></button><button type="button" data-reading-theme="paper" aria-pressed="false"><span class="theme-swatch swatch-paper" aria-hidden="true">Aa</span><span>Papel</span><span class="theme-check" aria-hidden="true">✓</span></button></div></fieldset><p id="hr-reading-storage" role="status" hidden></p></div></div></div><div class="reader-layout"><nav class="chapters" aria-label="Capítulos"><div class="chapters-inner"><span class="eyebrow">GUIA DO MÉTODO</span><div id="hr-nav"></div><p>Leia na ordem ou vá direto à sua dúvida.</p></div></nav><div class="reading"><div class="chapter-meta"><span id="hr-chapter-label"></span><span id="hr-position"></span></div><h2 id="hr-chapter-title" tabindex="-1"></h2><p class="intro" id="hr-intro"></p><div id="hr-blocks"></div><footer><div id="hr-citations"></div><p class="legal">Skill independente, baseada no método publicado. Sem afiliação nem endosso de Alex Hormozi.</p><div class="pagination"><button id="hr-prev">← Anterior</button><button id="hr-next">Próximo →</button></div></footer><p class="reader-status" id="hr-status" role="status"></p></div></div></section>';
  function unmount() { active?.controller.abort(); active?.resize?.disconnect(); active = null; }
  function mount(panel, slug) {
    if (!Object.hasOwn(READINGS, slug)) return;
    const essay = FORMATS[slug] === 'essay';
    const controller = new AbortController(), { signal } = controller;
    const body = panel.querySelector('.body'), scroller = panel.closest('.overlay');
    const sharing = window.AgentFlixReadingShare?.mount(panel, slug, SHARES[slug], signal);
    scroller.classList.add('reader-overlay');
    let tabs = null;
    if (essay) {
      panel.classList.add('editorial-essay');
      body.hidden = true;
      body.insertAdjacentHTML('afterend', '<section id="human-reader" role="region" aria-label="Leitura" aria-busy="true"><p class="reader-message" role="status">Carregando leitura…</p></section>');
    } else {
      tabs = document.createElement('div');
      tabs.className = 'reader-tabs'; tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Conteúdo da skill');
      tabs.innerHTML = '<button id="reader-tab-human" role="tab" aria-selected="true" aria-controls="human-reader">Para o humano</button><button id="reader-tab-skill" role="tab" aria-selected="false" aria-controls="reader-skill" tabindex="-1">Usar a skill</button>';
      body.before(tabs);
      body.id = 'reader-skill'; body.setAttribute('role','tabpanel'); body.setAttribute('aria-labelledby','reader-tab-skill'); body.hidden = true;
      tabs.insertAdjacentHTML('afterend', '<section id="human-reader" role="tabpanel" aria-labelledby="reader-tab-human" aria-busy="true"><p class="reader-message" role="status">Carregando leitura…</p></section>');
    }
    let root = panel.querySelector('#human-reader'), loaded = false, opened = false;
    function recordOpening() {
      if (!loaded || opened || root.hidden) return false;
      opened = true;
      window.AgentFlixMetrics?.record('reading_open', slug, {mode:'human', appearance:root.dataset.readingTheme});
      return true;
    }
    const contentURL = new URL(READINGS[slug], document.baseURI);
    const scrollToReading = () => scroller.scrollBy({ top: root.getBoundingClientRect().top - scroller.getBoundingClientRect().top - (tabs?.offsetHeight || 0), behavior: 'instant' });
    const closePreferences = () => {
      const options = root.querySelector('#hr-reading-options');
      if(options) { options.hidden = true; root.querySelector('#hr-reading-toggle').setAttribute('aria-expanded','false'); }
    };
    function select(name, scroll = true) {
      if(essay) return;
      closePreferences();
      const wasReading = !root.hidden;
      const positions = instance.positions;
      const tabStart = scroller.scrollTop + panel.querySelector('.top').getBoundingClientRect().bottom - scroller.getBoundingClientRect().top;
      positions[wasReading ? 'human' : 'skill'] = scroller.scrollTop;
      for(const value of ['human','skill']) {
        const button = tabs.querySelector('#reader-tab-' + value);
        button.setAttribute('aria-selected', String(name === value)); button.tabIndex = name === value ? 0 : -1;
      }
      root.hidden = name !== 'human'; body.hidden = name !== 'skill';
      if (loaded && wasReading !== (name === 'human')) {
        if (!recordOpening()) window.AgentFlixMetrics?.record('reading_mode', slug, {mode:name});
      }
      if(name === 'skill') window.dispatchEvent(new Event('resize'));
      if(scroll) scroller.scrollTop = positions[name] ?? tabStart;
    }
    const resize = tabs ? new ResizeObserver(() => panel.style.setProperty('--reader-tabs-height', tabs.offsetHeight + 'px')) : null;
    if(tabs) resize.observe(tabs);
    const instance = { controller, resize, select, positions: {} };
    active = instance;
    if(tabs) {
      tabs.addEventListener('click', event => { const button = event.target.closest('[role="tab"]'); if(button) select(button.id === 'reader-tab-human' ? 'human' : 'skill'); }, {signal});
      tabs.addEventListener('keydown', event => {
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
        event.preventDefault();
        const name = event.key === 'Home' ? 'human' : event.key === 'End' ? 'skill' : root.hidden ? 'human' : 'skill';
        select(name); tabs.querySelector('#reader-tab-' + name).focus({preventScroll:true});
      }, {signal});
    }
    async function load() {
      root.setAttribute('aria-busy','true');
      try {
        let data = cache.get(slug);
        if(!data) {
          const response = await fetch(contentURL, {signal});
          if(!response.ok) throw new Error('Leitura indisponível');
          data = await response.json();
          if(!Array.isArray(data.chapters) || !data.chapters.length || !Array.isArray(data.sources)) throw new Error('Leitura inválida');
        }
        if(signal.aborted || !root.isConnected) return;
        const hidden = root.hidden;
        root.outerHTML = shell;
        root = panel.querySelector('#human-reader'); root.hidden = hidden;
        if(essay) {
          root.setAttribute('role', 'region');
          root.removeAttribute('aria-labelledby');
          root.setAttribute('aria-label', 'Leitura');
          root.dataset.readerFormat = 'essay';
        }
        bindReader(root, data, contentURL, scrollToReading, signal, slug);
        bindPreferences(root, scroller, signal, {fixedPaper: essay, slug});
        loaded = true;
        if (!recordOpening() && root.hidden) window.AgentFlixMetrics?.record('reading_mode', slug, {mode:'skill'});
        sharing?.addButton(root.querySelector('.reading-toolbar'));
        const legal = root.querySelector('.legal');
        legal.textContent = data.disclaimer;
        legal.hidden = !data.disclaimer;
        cache.set(slug, data);
      } catch(error) {
        if(signal.aborted || !root.isConnected) return;
        root.innerHTML = '<div class="reader-message"><p role="status">Não foi possível carregar a leitura.</p><button type="button" data-reader-retry>Tentar novamente</button></div>';
        root.querySelector('[data-reader-retry]').addEventListener('click', load, {once:true, signal});
      } finally { if(root.isConnected) root.removeAttribute('aria-busy'); }
    }
    load();
  }
  function bindReader(root, data, contentURL, scrollToReading, signal, slug) {
    const $ = id => root.querySelector('#hr-' + id);
    const progressKey = `agentflix-reading-progress-v1:${slug}`;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(progressKey) || 'null'); } catch { saved = null; }
    let index = Number.isInteger(saved?.chapter) && saved.chapter >= 0 && saved.chapter < data.chapters.length ? saved.chapter : 0;
    const choices = new Map(Object.entries(saved?.choices || {}).filter(([, value]) => Number.isInteger(value)));
    const checked = new Set(Array.isArray(saved?.checked) ? saved.checked.filter(value => typeof value === 'string') : []);
    let completed = saved?.completed === true;
    const agentPrompts = window.AgentFlixReaderPrompt?.bind(root, key => {
      const [chapter, block] = key.split('-').map(Number);
      return data.chapters[chapter].blocks[block];
    }, signal);
    function saveProgress() {
      completed = completed || (data.format !== 'essay' && index === data.chapters.length - 1);
      try {
        localStorage.setItem(progressKey, JSON.stringify({
          version: 1,
          chapter: index,
          total: data.chapters.length,
          completed,
          choices: Object.fromEntries(choices),
          checked: [...checked],
          updatedAt: new Date().toISOString()
        }));
      } catch { /* A leitura continua mesmo sem armazenamento. */ }
    }
const detail=i=>`<div class="detail"><span class="direction">${esc(i.direction||i.tag||'')}</span><h4>${esc(i.question||i.title)}</h4><p>${esc(i.text)}</p>${i.example?`<p class="example">${esc(i.example)}</p>`:''}${i.avoid?`<p class="avoid">Evite: ${esc(i.avoid)}</p>`:''}</div>`;
const sourceList=()=>`<div class="source-list">${data.sources.map(s=>`<div><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)} ↗</a><p>${esc(s.note)}</p></div>`).join('')}</div>`;
const sourceLinks=ids=>ids.map(id=>{const s=data.sources.find(s=>s.id===id);return `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)} ↗</a>`}).join('');
function block(b,k){const title=b.title?`<h3>${esc(b.title)}</h3>`:'';let body='';const active=choices.get(index+'-'+k)||0;
switch(b.type){
case 'media':body=`<figure class="reader-media">${b.kind==='video'?`<video controls playsinline preload="none" poster="${esc(new URL(b.poster,contentURL).href)}" aria-label="${esc(b.alt)}"><source src="${esc(new URL(b.src,contentURL).href)}" type="video/mp4"></video>`:`<img src="${esc(new URL(b.src,contentURL).href)}" alt="${esc(b.alt)}" loading="lazy">`}<figcaption${b.captionParts?' class="caption-parts"':''}>${b.captionParts?b.captionParts.map(part=>`<span>${esc(part)}</span>`).join(''):esc(b.caption)}</figcaption></figure>`;break;
case 'gallery':body=`<figure class="reader-gallery"><div>${b.items.map(i=>`<figure><img src="${esc(new URL(i.src,contentURL).href)}" alt="${esc(i.alt)}" loading="lazy"><figcaption>${esc(i.caption)}</figcaption></figure>`).join('')}</div><figcaption>${esc(b.caption)}</figcaption></figure>`;break;
case 'metaphor':body=`<div class="reader-metaphor" role="img" aria-label="${esc(b.alt)}"><div aria-hidden="true">▰━━▰　　▰━━▰</div><h4>${esc(b.title)}</h4><p>${esc(b.text)}</p><p class="caption">${esc(b.note)}</p></div>`;break;
case 'narrative':body=b.paragraphs.map(p=>`<p>${esc(p)}</p>`).join('');break;
case 'case_study':body=`${b.visual==='image'?`<figure class="case-image"><img src="${esc(new URL(b.image.src, contentURL).href)}" alt="${esc(b.image.alt)}" width="${b.image.width||888}" height="${b.image.height||561}" loading="lazy"><figcaption>${esc(b.image.caption)}</figcaption></figure>`:`<figure class="empty-art"><div class="empty-frame" role="img" aria-label="Representação editorial de um espaço vazio reservado para a escultura invisível"></div><figcaption><span>${esc(b.visualLabel)}</span>${esc(b.visualNote)}</figcaption></figure>`}<div class="case-stat"><strong>${esc(b.stat)}</strong><span>${esc(b.statLabel)}</span></div><div class="case-text">${b.paragraphs.map(p=>`<p>${esc(p)}</p>`).join('')}</div><p class="caption">${esc(b.note)}</p><div class="case-sources">${sourceLinks(b.sourceIds)}</div>`;break;
case 'equation_bridge':body=`<p class="bridge-intro">${esc(b.text)}</p><div class="bridge-equation">${b.items.map((i,n)=>`${n?`<span class="bridge-op" aria-hidden="true">${n===1?'+':'='}</span>`:''}<div class="bridge-term"><span class="bridge-symbol">${esc(i.symbol)}</span><h4>${esc(i.title)}</h4><p>${esc(i.text)}</p></div>`).join('')}</div><p class="caption">${esc(b.note)}</p>`;break;
case 'comparison':body=`<div class="comparison"><div class="compare-head"><div>${esc(b.beforeLabel)}</div><div>${esc(b.afterLabel)}</div></div>${b.rows.map(r=>`<div class="compare-row"><div>${esc(r[0])}</div><div>${esc(r[1])}</div></div>`).join('')}</div>${b.caption?`<p class="caption">${esc(b.caption)}</p>`:''}`;break;
case 'callout':body=`<p>${esc(b.text)}</p>`;break;
case 'facts':body=`<dl class="facts">${b.items.map(i=>`<div><dt>${esc(i[0])}</dt><dd>${esc(i[1])}</dd></div>`).join('')}</dl>`;break;
case 'model':body=`<div class="formula"><div class="formula-title">Selecione uma variável para entender</div><div class="fraction">${[b.numerator,b.denominator].map((row,r)=>`<div class="fraction-row">${row.map((name,c)=>`${c?'<span aria-hidden="true">×</span>':''}<button class="factor" data-choice="${k}" data-item="${r*2+c}" aria-pressed="${active===r*2+c}" aria-controls="hr-detail-${k}">${esc(name)}</button>`).join('')}</div>`).join('')}</div><div class="result">= ${esc(b.result)}</div></div><p class="caption">${esc(b.note)}</p><div id="hr-detail-${k}" aria-live="polite">${detail(b.items[active])}</div>`;break;
case 'flow':body=`<div class="flow">${b.items.map((i,n)=>`<button data-choice="${k}" data-item="${n}" aria-pressed="${active===n}" aria-controls="hr-detail-${k}"><span>${esc(i.tag)}</span>${esc(i.title)}</button>`).join('')}</div><div id="hr-detail-${k}" aria-live="polite">${detail(b.items[active])}</div>`;break;
case 'cards':body=`<div class="cards">${b.items.map(i=>`<div class="smallcard"><h4>${esc(i.title)}</h4><p>${esc(i.text)}</p></div>`).join('')}</div>`;break;
case 'steps':body=`<ol class="steps">${b.items.map(i=>`<li><h4>${esc(i.title)}</h4><p>${esc(i.text)}</p></li>`).join('')}</ol>`;break;
case 'prompt':body=`<div class="prompt"><p>${esc(b.text)}</p><button data-copy="${k}">Copiar primeiro pedido</button></div><p class="caption">${esc(b.note)}</p>`;break;
case 'agent_prompt':body=agentPrompts.render(b, index+'-'+k);break;
case 'checklist':body=`<div class="checklist">${b.items.map((i,n)=>`<label><input type="checkbox" data-check="${k}-${n}" ${checked.has(k+'-'+n)?'checked':''}><span>${esc(i)}</span></label>`).join('')}</div>`;break;
case 'sources':body=`<p>${esc(b.text)}</p>${sourceList()}`;break;
default:throw Error('Bloco desconhecido: '+b.type)}return `<section class="block ${['callout','narrative','case_study','equation_bridge'].includes(b.type)?esc(b.type):''} ${b.type==='media'?'essay-media':''} ${b.tone==='turn'?'essay-turn':''} ${b.presentation==='paths'?'essay-paths':''}">${b.eyebrow?`<p class="eyebrow">${esc(b.eyebrow)}</p>`:''}${title}${body}</section>`;}
function show(n,focus=false){if(!Number.isInteger(n)||n<0||n>=data.chapters.length)return;index=n;const c=data.chapters[n];root.querySelector('.reading').classList.toggle('editorial',c.tone==='editorial');$('nav').innerHTML=data.chapters.map((c,i)=>`<button data-chapter="${i}" ${i===n?'aria-current="step"':''}><span>${String(i+1).padStart(2,'0')}</span>${esc(c.label)}</button>`).join('');$('chapter-label').textContent=data.method+' · '+c.label;$('position').textContent=`${n+1} de ${data.chapters.length}`;$('chapter-title').textContent=c.title;$('intro').textContent=c.intro;$('blocks').innerHTML=c.blocks.map(block).join('');$('citations').innerHTML=c.sources.map(id=>{const s=data.sources.find(s=>s.id===id);return `<a target="_blank" rel="noopener" href="${esc(s.url)}">${esc(s.label)} ↗</a>`}).join('');$('prev').disabled=n===0;$('next').disabled=n===data.chapters.length-1;$('next').textContent=n<data.chapters.length-1?data.chapters[n+1].label+' →':'Leitura concluída';saveProgress();if(focus){$('chapter-title').focus({preventScroll:true});scrollToReading()}}
async function copy(text,btn){try{await navigator.clipboard.writeText(text);btn.textContent='Copiado ✓';$('status').textContent='Texto copiado.'}catch{$('status').textContent='Selecione o texto e copie. A cópia automática não está disponível.'}}

    root.addEventListener('click', event => {
      const chapter = event.target.closest('[data-chapter]');
      if(chapter) show(Number(chapter.dataset.chapter), true);
      const option = event.target.closest('[data-choice]');
      if(option) {
        const k = +option.dataset.choice, n = +option.dataset.item;
        choices.set(index + '-' + k, n);
        saveProgress();
        root.querySelectorAll(`[data-choice="${k}"]`).forEach(button => button.setAttribute('aria-pressed', String(+button.dataset.item === n)));
        $('detail-' + k).innerHTML = detail(data.chapters[index].blocks[k].items[n]);
      }
      const copyButton = event.target.closest('[data-copy]');
      if(copyButton) copy(data.chapters[index].blocks[+copyButton.dataset.copy].text, copyButton);
    }, {signal});
    root.addEventListener('change', event => { if(event.target.matches('[data-check]')) { const k = event.target.dataset.check; event.target.checked ? checked.add(k) : checked.delete(k); saveProgress(); } }, {signal});
    $('prev').addEventListener('click', () => show(index - 1, true), {signal});
    $('next').addEventListener('click', () => show(index + 1, true), {signal});
    show(index);
  }
function bindPreferences(root, scroller, signal, {fixedPaper = false, slug = null} = {}) {
  const $ = id => root.querySelector('#hr-' + id);
  const listen = (target, name, fn) => target.addEventListener(name, fn, { signal });
  const KEY = 'agentflix-reading-v1';
  const SIZES = [0.94, 1, 1.125, 1.25, 1.5];
  const LABELS = ['Menor', 'Padrão', 'Grande', 'Maior', 'Máximo'];
  const toggle = $('reading-toggle');
  const panel = $('reading-options');
  const smaller = $('text-smaller');
  const larger = $('text-larger');
  const status = $('reading-storage');
  const themes = [...panel.querySelectorAll('[data-reading-theme]')];
  if(fixedPaper) panel.querySelector('.theme-options').closest('fieldset').hidden = true;
  const normalize = value => ({
    theme: value?.theme === 'paper' ? 'paper' : 'dark',
    size: Number.isInteger(value?.size) && value.size >= 0 && value.size < SIZES.length ? value.size : 1
  });
  let prefs = normalize(null);
  try { prefs = normalize(JSON.parse(localStorage.getItem(KEY))); } catch { /* O padrão funciona sem armazenamento. */ }

  function apply() {
    root.dataset.readingTheme = fixedPaper ? 'paper' : prefs.theme;
    root.dataset.readingSize = String(prefs.size);
    root.style.setProperty('--reader-scale', SIZES[prefs.size]);
    themes.forEach(button => button.setAttribute('aria-pressed', button.dataset.readingTheme === prefs.theme));
    smaller.setAttribute('aria-disabled', prefs.size === 0);
    larger.setAttribute('aria-disabled', prefs.size === SIZES.length - 1);
    $('text-size').textContent = LABELS[prefs.size];
  }
  function change(next) {
    // Manter o parágrafo visível na mesma altura ao redimensionar o texto.
    const edge = root.querySelector('.reading-toolbar').getBoundingClientRect().bottom;
    const anchor = [...root.querySelectorAll('.reading h2, .reading h3, .reading p, .compare-row')]
      .find(el => { const rect = el.getBoundingClientRect(); return rect.bottom > edge && rect.top < innerHeight; });
    const top = anchor?.getBoundingClientRect().top;
    const previousTheme = prefs.theme;
    prefs = normalize(next);
    apply();
    if (!fixedPaper && !root.hidden && prefs.theme !== previousTheme) window.AgentFlixMetrics?.record('reading_appearance', slug, {appearance:prefs.theme});
    if (anchor) scroller.scrollBy(0, anchor.getBoundingClientRect().top - top);
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
      status.hidden = true;
    } catch {
      status.textContent = 'O navegador não permitiu salvar. Os ajustes valem nesta visita.';
      status.hidden = false;
    }
  }
  function close(returnFocus = false) {
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    if (returnFocus) toggle.focus({ preventScroll: true });
  }
  listen(toggle, 'click', () => {
    const opening = panel.hidden;
    panel.hidden = !opening;
    toggle.setAttribute('aria-expanded', String(opening));
  });
  listen($('reading-dismiss'), 'click', () => close(true));
  listen(smaller, 'click', () => { if (prefs.size > 0) change({ ...prefs, size: prefs.size - 1 }); });
  listen(larger, 'click', () => { if (prefs.size < SIZES.length - 1) change({ ...prefs, size: prefs.size + 1 }); });
  themes.forEach(button => listen(button, 'click', () => change({ ...prefs, theme: button.dataset.readingTheme })));
  listen(root, 'keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); event.stopPropagation(); close(true); }
  });
  listen(document, 'click', event => { if (!event.target.closest('.reading-settings')) close(); });
  listen(document, 'focusin', event => { if (!event.target.closest('.reading-settings')) close(); });
  listen(window, 'storage', event => {
    if (event.key === KEY || event.key === null) {
      try { changeFromStorage(event.key === null ? null : JSON.parse(event.newValue)); } catch { changeFromStorage(null); }
    }
  });
  function changeFromStorage(value) { prefs = normalize(value); apply(); }
  apply();
}

  window.AgentFlixReader = { catalogSkills, supports: slug => Object.hasOwn(READINGS, slug), mount, unmount, showSkill: () => active?.select('skill', false) };
})();
