/* Curadoria por necessidade. Os textos e as amostras vêm do protótipo aprovado. */
(() => {
  'use strict';
  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $ = id => document.getElementById(id);
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scroll = el => el?.scrollIntoView({block:'start',behavior:reduced()?'auto':'smooth'});
  window.AgentFlixDiscovery = {
    create(data, by, hooks) {
      if (data.schema_version !== 1 || !data.skills || !Array.isArray(data.fileiras) || !data.guia?.inicio || !data.colecoes || !data.amostras || !Array.isArray(data.lentes_em)) throw Error('Curadoria inválida');
      const available = Object.keys(data.skills).filter(slug => by[slug]);
      const legends = Object.values(by).filter(s => s.cat === 'lendas');
      if (Object.values(by).some(s=>s.cat!=='lendas'&&!s.readingOnly&&!data.skills[s.slug]) || available.some(slug=>!Array.isArray(data.skills[slug].antes))) throw Error('Curadoria incompleta');
      const featured = (data.destaques || []).filter(slug => available.includes(slug)).map(slug => by[slug]);
      if (data.destaques && featured.length !== data.destaques.length) throw Error('Destaques ausentes do catálogo');
      // A vitrine recompõe hero e ficha por innerHTML. Reaplique o layout da capa
      // inteira aos consumidores configurados, sem alterar o renderizador legado.
      const wideCovers = available.filter(slug => data.skills[slug].cover_layout === 'editorial-wide');
      if (wideCovers.length) {
        const syncCover = target => {
          const src = target?.querySelector('img.hero-cover, img.pcover')?.getAttribute('src') || '';
          if (wideCovers.some(slug => src === hooks.coverUrl(slug, 'desktop'))) target.classList.add('editorial-cover');
        };
        const hero = $('hero'), modal = $('modal');
        if (hero) new MutationObserver(() => syncCover(hero)).observe(hero, {childList:true,subtree:true});
        if (modal) new MutationObserver(() => syncCover(modal.querySelector('.panel .top'))).observe(modal, {childList:true,subtree:true});
      }
      const journey = window.AgentFlixJourney(data, Object.keys(by), {getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)});
      let door = null, trail = ['inicio'], result = null, completeOnboarding = false;
      let kind = null, answers = [];
      const visitStorage = hooks.authenticated ? localStorage : sessionStorage;
      const visit = window.AgentFlixVisit(data, {getItem:key=>visitStorage.getItem(key),setItem:(key,value)=>visitStorage.setItem(key,value),removeItem:key=>visitStorage.removeItem(key)});
      const restored = visit.load();
      if (restored) ({door,trail,result,kind,answers,completed:completeOnboarding} = restored);
      const event = (name, tags) => window.clar?.(name,{porta:kind,objetivo:result?.skill,...tags});
      const saveVisit = () => visit.save(kind,answers,completeOnboarding);
      let lens = null, current = null, run = 0, timeout = null, release = null, target = null;
      const meta = s => data.skills[s.slug];
      const name = slug => by[slug]?.name || slug;
      const cover = slug => hooks.coverUrl(slug, 'wide');
      const featureCover = (slug,kind) => hooks.coverUrl(slug,kind);
      const titleFocus = container => { const h = container.querySelector('h1,h2,h3'); if(h){h.tabIndex=-1;h.focus({preventScroll:true});} };
      const matches = s => !door || (meta(s) && (door === 'colecao' ? !!meta(s).colecao : !meta(s).colecao));
      const counts = {avulsa:available.filter(s=>!data.skills[s].colecao).length,colecao:available.filter(s=>data.skills[s].colecao).length};
      const dots = n => `<span class="skill-dots" aria-hidden="true">${Array.from({length:n},()=>'<i></i>').join('')}</span>`;
      function setDoor(value) { door=value; hooks.filter(); }
      const entryChoices = [
        {id:'avulsa',art:'copy-headlines',illustration:'resolver',title:'Quero resolver uma coisa hoje',description:'Pega, usa, pronto. Não guarda nada, não pede pasta, não faz entrevista.',label:'Uma tarefa por vez'},
        {id:'colecao',art:'hybrid-perfil',illustration:'base',title:'Quero montar o cérebro do negócio',description:'Abre uma pasta, entrevista você, acumula. Depois todas as outras leem dela.',label:'Construir minha base'},
        {id:'guia',art:'hybrid-proxima-acao',illustration:'caminho',title:'Não sei o que pegar',description:'Três perguntas. No fim, uma skill só e o comando pronto para colar.',label:'Descobrir meu caminho'}
      ];
      const scene = (slug, cls='') => `<span class="choice-scene ${cls}" aria-hidden="true"><img src="${cover(slug)}" alt="" decoding="async" onerror="this.hidden=true"><span class="scene-fallback">A</span></span>`;
      function availability(choice) {
        if(choice==='avulsa')return `<div><p>${counts.avulsa} skills para tarefas pontuais</p>${dots(counts.avulsa)}<small>Cada ponto representa uma skill disponível.</small></div>`;
        if(choice==='colecao')return `<div class="collection-dots">${Object.entries(data.colecoes).map(([id,c])=>{const n=available.filter(slug=>data.skills[slug].colecao===id).length;return `<div class="dot-group"><p>${esc(c.nome)} <b>${n} skills</b></p>${dots(n)}</div>`}).join('')}<small>Cada ponto é uma skill. Cada grupo compartilha arquivos.</small></div>`;
        return '<p>Responda até três perguntas. A indicação considera o que você já tem e o que quer fazer.</p>';
      }
      function home() {
        $('discovery').hidden=false;
        $('discovery').innerHTML=`<div id="entry-stage"><div class="discovery-intro"><p class="eyebrow">Seu ponto de partida</p><h1 id="entry-title">O que você quer fazer agora?</h1><p>AgentFlix é um hub de skills para Hermes, Claude, ChatGPT, Codex e outros agentes de IA. Escolha um caminho para encontrar por onde começar.</p></div>
          <fieldset class="doors" id="doors" aria-labelledby="entry-title">
          ${entryChoices.map(c=>`<label class="door" data-door="${c.id}" ${c.id==='guia'?'id="guide-open"':''}>
            <input class="sr-only" type="radio" name="entry-choice" value="${c.id}" aria-labelledby="door-title-${c.id}">
            <span class="choice-scene entry-illustration" aria-hidden="true"><img src="onboarding/${c.illustration}-v1.webp" alt="" width="960" height="640" decoding="async" onerror="this.hidden=true"><span class="scene-fallback">A</span></span><span class="choice-check" aria-hidden="true">✓</span>
            <span class="door-body"><span class="door-label">${c.label}</span><strong id="door-title-${c.id}" class="door-title">${c.title}</strong><span class="door-description">${c.description}</span></span>
          </label>`).join('')}</fieldset>
          <div class="choice-continue"><p id="entry-hint" role="status">Escolha a opção que mais combina com seu momento.</p><button class="guide-primary" data-door-continue disabled>Continuar <span aria-hidden="true">→</span></button></div>
          <details class="choice-availability" id="choice-availability" hidden><summary>O que tem nesse caminho</summary><div id="availability-detail"></div></details></div>
          <section id="guide" class="guide" aria-label="Guia para escolher uma skill" hidden></section><p id="discovery-status" class="sr-only" role="status"></p>`;
        $('doors').addEventListener('change',e=>{
          const choice=entryChoices.find(c=>c.id===e.target.value);if(!choice)return;
          $('entry-hint').textContent=choice.label;$('discovery').querySelector('[data-door-continue]').disabled=false;
          $('choice-availability').hidden=false;$('choice-availability').open=false;$('availability-detail').innerHTML=availability(choice.id);
        });
        $('discovery').querySelector('[data-door-continue]').addEventListener('click',()=>{const choice=$('doors').querySelector('input:checked');if(choice)start(choice.value);});
      }
      function start(choice) {
        kind=choice;answers=[];door=kind==='guia'?null:kind; completeOnboarding=false; result=null; target=null;
        trail=[kind==='avulsa'?'o_que_agora':'inicio'];saveVisit();event('onboarding_iniciado');
        $('discovery').hidden=false; $('entry-stage').hidden=true; $('guide').hidden=false;
        hooks.filter(); paintGuide(); scroll($('discovery')); titleFocus($('guide'));
      }
      function toggleGuide() {
        event('onboarding_reiniciado');visit.clear();kind=null;answers=[];trail=['inicio'];
        completeOnboarding=false;result=null;target=null;door=null;
        home();
        hooks.filter();scroll($('discovery'));titleFocus($('discovery'));
      }
      function resume() {
        // Navegar não reinicia perguntas nem apaga o filtro e o objetivo.
        const destination=completeOnboarding?journeyHost:kind?$('guide'):$('discovery');
        event('caminho_consultado');scroll(destination);titleFocus(destination);
      }
      function recommendation(compact=false) {
        const r=result&&journey.recommend(result.skill);if(!r)return '';
        const s=by[r.slug];
        const reason=r.done?'Você já marcou esta etapa como instalada.':r.after?`Você já instalou ${name(r.after)}. Esta é uma continuação do seu caminho.`:r.slug!==r.goal?`Para chegar a ${name(r.goal)}, comece por ${s.name}. É um pré-requisito que ainda falta instalar.`:'Esta skill atende à escolha que você fez.';
        if(compact)return `<div class="recommended-inline" data-recommended="${esc(s.slug)}"><div><p class="eyebrow">${r.done?'Seu caminho está em dia':'Recomendado para você'}</p><p><strong>${esc(s.name)}</strong> · ${esc(reason)}</p></div><button class="guide-primary" data-act="open" data-slug="${esc(s.slug)}">${journey.has(s.slug)?'Rever a skill':'Começar por aqui'}</button></div>`;
        return `<article class="recommended-piece" data-recommended="${esc(s.slug)}"><img alt="" src="${cover(s.slug)}"><div><p class="eyebrow">${r.done?'Seu caminho está em dia':'Recomendado para você'}</p><h2>${esc(s.name)}</h2><p>${esc(s.sub)}</p><p class="recommend-reason">${esc(reason)}</p>${completeOnboarding?`<button class="guide-primary" data-act="open" data-slug="${esc(s.slug)}">${journey.has(s.slug)?'Rever a skill':'Começar por aqui'}</button>`:''}</div></article>`;
      }
      let featuredIndex = 0, featuredTimer = null, featuredPaused = false;
      const featureHost = $('recommendation');
      const journeyHost = document.createElement('section');
      journeyHost.id = 'journey-summary';
      journeyHost.setAttribute('aria-label', 'Seu caminho');
      $('chips').insertAdjacentElement('afterend', journeyHost);
      featureHost.setAttribute('aria-label', 'Skills em destaque');
      const featureSlide = () => featured[featuredIndex];
      function featureMarkup() {
        if (!featured.length) return '';
        const s = featureSlide();
        return `<section class="featured-banner" aria-label="Skills em destaque" aria-roledescription="carrossel" data-featured-slug="${esc(s.slug)}">
          <picture class="featured-art"><source media="(max-width: 600px)" srcset="${featureCover(s.slug,'mobile')}"><img src="${featureCover(s.slug,'desktop')}" alt="" decoding="async" fetchpriority="high"></picture>
          <div class="featured-copy"><p class="featured-kicker">Em destaque · <span data-feature-position>${featuredIndex+1} de ${featured.length}</span></p><h2 data-feature-name>${esc(s.name)}</h2><p data-feature-sub>${esc(s.sub)}</p><div class="featured-actions"><button class="guide-primary" data-act="open" data-slug="${esc(s.slug)}">Ver detalhes</button><button type="button" class="featured-playback" data-feature-playback>${featuredPaused?'Reproduzir':'Pausar'}</button></div></div>
          <div class="featured-controls" aria-label="Escolher destaque"><button type="button" data-feature-step="-1">Anterior</button><div class="featured-dots">${featured.map((item,index)=>`<button type="button" data-feature-index="${index}" aria-label="Mostrar ${esc(item.name)}" ${index===featuredIndex?'aria-current="true"':''}><span aria-hidden="true"></span></button>`).join('')}</div><button type="button" data-feature-step="1">Próximo</button></div>
          <p class="sr-only" role="status" data-feature-status></p>
        </section>`;
      }
      function paintFeature(index,announce=false) {
        const banner=featureHost.querySelector('.featured-banner');if(!banner)return;
        featuredIndex=(index+featured.length)%featured.length;
        const s=featureSlide();
        banner.dataset.featuredSlug=s.slug;
        banner.querySelector('source').srcset=featureCover(s.slug,'mobile');
        banner.querySelector('.featured-art img').src=featureCover(s.slug,'desktop');
        banner.querySelector('[data-feature-position]').textContent=`${featuredIndex+1} de ${featured.length}`;
        banner.querySelector('[data-feature-name]').textContent=s.name;
        banner.querySelector('[data-feature-sub]').textContent=s.sub;
        banner.querySelector('.featured-copy [data-act="open"]').dataset.slug=s.slug;
        banner.querySelectorAll('[data-feature-index]').forEach((button,i)=>{if(i===featuredIndex)button.setAttribute('aria-current','true');else button.removeAttribute('aria-current');});
        if(announce)banner.querySelector('[data-feature-status]').textContent=`${s.name}, ${featuredIndex+1} de ${featured.length}`;
      }
      function scheduleFeature() {
        clearTimeout(featuredTimer);featuredTimer=null;
        const banner=featureHost.querySelector('.featured-banner');
        const playbackFocused=!!banner?.querySelector('[data-feature-playback]:focus');
        if(!completeOnboarding||featured.length<2||featuredPaused||reduced()||document.hidden||!banner||(!playbackFocused&&banner.matches(':hover'))||(banner.contains(document.activeElement)&&!playbackFocused))return;
        featuredTimer=setTimeout(()=>{paintFeature(featuredIndex+1);scheduleFeature();},9000);
      }
      featureHost.addEventListener('click',e=>{
        const playback=e.target.closest('[data-feature-playback]');
        if(playback){featuredPaused=!featuredPaused;playback.textContent=featuredPaused?'Reproduzir':'Pausar';featureHost.querySelector('[data-feature-status]').textContent=featuredPaused?'Destaques pausados':'Destaques em reprodução';scheduleFeature();return;}
        const control=e.target.closest('[data-feature-step],[data-feature-index]');if(!control)return;
        const index=control.hasAttribute('data-feature-step')?featuredIndex+Number(control.dataset.featureStep):Number(control.dataset.featureIndex);
        paintFeature(index,true);scheduleFeature();
      });
      featureHost.addEventListener('pointerenter',scheduleFeature);
      featureHost.addEventListener('pointerleave',scheduleFeature);
      featureHost.addEventListener('focusin',scheduleFeature);
      featureHost.addEventListener('focusout',()=>setTimeout(scheduleFeature,0));
      document.addEventListener('visibilitychange',scheduleFeature);
      matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',scheduleFeature);
      function renderRecommendation() {
        featureHost.innerHTML = completeOnboarding ? featureMarkup() : '';
        journeyHost.innerHTML = completeOnboarding ? `<div class="selection-heading"><div><h2 class="eyebrow">Seu caminho</h2><p>Objetivo: ${esc(name(result.skill))}</p></div><button data-discover-reset>Refazer minhas escolhas</button></div>${recommendation(true)}` : '';
        journeyHost.hidden = !completeOnboarding;
        scheduleFeature();
      }
      function optionArt(nodeId,option,index) {
        if(option.skill)return option.skill;
        const scenes={inicio:['hybrid-perfil','hybrid-tech','hybrid-diagnostico'],o_que_agora:['copy-headlines','copy-auditoria','hybrid-proxima-acao','ads-plano','sop-extrair']};
        return scenes[nodeId]?.[index] || entryChoices.find(c=>c.id===kind)?.art || 'hybrid-perfil';
      }
      function paintGuide(selected = null) {
        const nodeId=trail.at(-1),node=data.guia[nodeId];
        const progress=`<div class="guide-progress"><span>${esc(entryChoices.find(c=>c.id===kind)?.label || 'Seu caminho')}</span><span>${result?'Sua seleção':`Pergunta ${trail.length}`}</span></div>`;
        const content=result ? `<div class="result-intro"><p class="eyebrow">Escolhida para o seu momento</p><h2 id="guide-title">Sua próxima descoberta</h2><p>A gente indica esta primeira etapa com base nas suas escolhas.</p></div>${recommendation()}<div class="result-action"><button class="guide-primary enter-selection" data-enter-selection>Abrir minha seleção <span aria-hidden="true">→</span></button></div>` : `<div class="question-heading"><h2 id="guide-title">${esc(node.p)}</h2>${node.ajuda?`<p>${esc(node.ajuda)}</p>`:''}</div><fieldset class="guide-options ${node.o.length>3?'compact-options':''}" aria-labelledby="guide-title">${node.o.map((o,i)=>`<label class="guide-option" data-option="${i}"><input type="radio" class="sr-only" name="guide-answer" value="${i}" aria-labelledby="option-title-${i}" ${selected===i?'checked':''}>${scene(optionArt(nodeId,o,i))}<span class="choice-check" aria-hidden="true">✓</span><strong id="option-title-${i}">${esc(o.t)}</strong></label>`).join('')}</fieldset><div class="choice-continue"><p id="answer-hint" role="status">${selected===null?'Selecione uma opção para continuar.':'Você pode mudar sua escolha antes de continuar.'}</p><button class="guide-primary" data-answer-continue ${selected===null?'disabled':''}>Continuar <span aria-hidden="true">→</span></button></div>`;
        $('guide').classList.toggle('has-result',!!result);
        $('guide').innerHTML=progress+content+`<div class="guide-nav">${trail.length>1||result?'<button data-guide-back>← Voltar</button>':''}<button data-guide-reset>Trocar de caminho</button></div>`;
        $('guide').querySelector('.guide-options')?.addEventListener('change',()=>{
          $('guide').querySelector('[data-answer-continue]').disabled=false;$('answer-hint').textContent='Você pode mudar sua escolha antes de continuar.';
        });
        $('guide').querySelector('[data-answer-continue]')?.addEventListener('click',()=>{
          const input=$('guide').querySelector('input:checked');if(!input)return;
          const index=Number(input.value),o=node.o[index];event('onboarding_resposta',{pergunta:nodeId,opcao:index});answers.push(index);
          if(o.vai)trail.push(o.vai);else result=o;saveVisit();if(result)event('recomendacao_exibida');paintGuide();scroll($('guide'));titleFocus($('guide'));
        });
        $('guide').querySelector('[data-guide-back]')?.addEventListener('click',()=>{
          const previous=answers.pop();if(result)result=null;else trail.pop();saveVisit();paintGuide(previous);scroll($('guide'));titleFocus($('guide'));
        });
        $('guide').querySelector('[data-guide-reset]').addEventListener('click',toggleGuide);
        $('guide').querySelector('[data-enter-selection]')?.addEventListener('click',()=>{
          completeOnboarding=true;saveVisit();if(hooks.authenticated)window.AgentFlixMemory?.flush();event('onboarding_concluido');$('discovery').hidden=true;hooks.filter();renderRecommendation();scroll($('recommendation'));titleFocus($('recommendation'));hooks.enter();
        });
      }
      function status(s) {
        const missing=journey.missing(s.slug);
        if(missing.length)return 'Antes: '+missing.map(name).join(', ');
        return journey.has(s.slug)?'✓ Instalado':'Pronto para instalar';
      }
      function card(s) {
        const m=meta(s);if(!m)return '';
        const label=m.colecao ? (m.passo===0?'Atalho':`Coleção${m.passo?' · passo '+m.passo:''}`) : 'Avulsa';
        return `<div class="journey-info"><div class="journey-label">${esc(label)}${data.amostras[s.slug]&&!journey.locked(s.slug)?'<span>▶ Amostra</span>':''}</div><h3>${esc(s.name)}</h3><p>${esc(s.sub)}</p><small class="${journey.locked(s.slug)?'needs':''}" title="${esc(status(s))}">${esc(status(s))}</small></div>`;
      }
      function gate(s) {
        target=s.slug;const next=journey.firstNeeded(s.slug);
        return `<div class="prerequisite-gate"><p class="eyebrow">Uma etapa antes</p><h2>${esc(s.name)}</h2><p>Para liberar esta skill, marque os pré-requisitos como instalados.</p><ul>${journey.missing(s.slug).map(dep=>`<li>${esc(name(dep))}</li>`).join('')}</ul><p>Comece por <strong>${esc(name(next))}</strong>. Depois de instalar, confirme na ficha.</p><button class="guide-primary" data-act="open" data-prerequisite="${esc(s.slug)}" data-slug="${esc(next)}">Ir para ${esc(name(next))} <span aria-hidden="true">→</span></button></div>`;
      }
      function installationButton(s) {
        return `<button class="installed-control" data-installed="${esc(s.slug)}" aria-pressed="${journey.has(s.slug)}" aria-describedby="installation-help">${journey.has(s.slug)?'✓ Instalado':'Marcar como instalado'}</button>`;
      }
      function installation(s) {
        return `<section class="installation-state" data-install-area>${installationButton(s)}<p id="installation-help">Marque depois de instalar no seu agente. A confirmação fica salva neste navegador.</p><p class="installation-feedback" role="status"></p><div class="installation-next">${nextLink(s)}</div></section>`;
      }
      function nextLink(s) {
        if(!journey.has(s.slug))return '';
        const goal=target||result?.skill;
        const next=goal&&journey.recommend(goal);
        return next&&next.slug!==s.slug?`<button class="guide-primary" data-act="open" data-slug="${esc(next.slug)}">Continuar com ${esc(name(next.slug))} →</button>`:'';
      }
      function context(s) {
        const m=meta(s);if(!m)return '';
        const c=m.colecao&&data.colecoes[m.colecao];
        return `<div class="discovery-detail"><div class="context-block">${m.nota?`<p>${esc(m.nota)}</p>`:''}${c?`<h3>Faz parte de: ${esc(c.nome)}</h3><p>${esc(c.explica)}</p><details><summary>Onde fica salvo</summary><p>${esc(c.pasta)} · config <code>${esc(c.chave)}</code></p></details>`:''}${m.antes.length?'<p class="prerequisites-ready">✓ Pré-requisitos instalados</p>':''}</div></div>`;
      }
      function extras(s) {
        const a=data.amostras[s.slug],hasLens=data.lentes_em.includes(s.slug);
        return `<div class="discovery-detail">${hasLens?`<section class="context-block"><h3>Escrever com a régua de</h3><div class="lenses">${legends.map(l=>`<button data-lens="${esc(l.slug)}" aria-pressed="false" title="${esc(l.sub)}">${esc(l.name)}</button>`).join('')}</div><p class="lens-note" id="lens-note">Escolha uma régua para orientar o texto de uso desta skill.</p><p class="legal">Skill independente: reúne o método publicado em livros, cursos e entrevistas do autor. Sem afiliação nem endosso dele.</p><div id="lens-usage" hidden></div></section>`:''}
          ${a?sampleHTML(a):''}</div>`;
      }
      function sampleHTML(a) {
        return `<section class="context-block sample"><h3>Amostra de conversa</h3><p>${esc(a.legenda)}</p><p class="sample-case"><b>Simulação com caso fictício</b> ${esc(data.caso)}</p>
          <div class="phone" aria-label="Simulação de conversa no Telegram"><div class="phone-top"><span class="phone-avatar">H</span><div><b>Hermes</b><span>Conversa de exemplo</span></div></div><div class="sample-chat" id="sample-chat" tabindex="0" aria-label="Conversa de exemplo, role para ler"></div><div class="phone-bottom" aria-hidden="true">Mensagem <span>➤</span></div></div>
          <div class="sample-controls"><button id="sample-play">Reproduzir amostra</button><button id="sample-all">Ver conversa completa</button><span id="sample-progress" role="status"></span></div></section>`;
      }
      function format(t) {
        // Código é separado antes da formatação para preservar quebras e caracteres.
        return String(t||'').split(/(```[\s\S]*?```)/g).map(part=>part.startsWith('```')?`<pre>${esc(part.slice(3,-3).replace(/^\n|\n$/g,''))}</pre>`:esc(part).replace(/\*([^*\n]+)\*/g,'<b>$1</b>').replace(/`([^`\n]+)`/g,'<code>$1</code>').replace(/\n/g,'<br>')).join('');
      }
      function pieces() {const a=data.amostras[current];return a?.variantes?.[lens]||a?.peca||[];}
      function bubble(t) {
        if(t.doc)return `<div class="bubble bot document"><b>↓ ${esc(t.doc.nome)}</b><span>${esc(t.doc.meta)}</span></div>`;
        if(t.chave==='peca')return `<div class="bubble bot">${pieces().map(p=>`<strong>${esc(p.t)}</strong><small>${esc(p.n)}</small>`).join('')}</div>`;
        return `<div class="bubble ${t.de==='eu'?'user':'bot'}">${format(t.t)}</div>`;
      }
      function cancel() {run++;clearTimeout(timeout);timeout=null;if(release){release();release=null;}}
      const wait = ms => new Promise(resolve=>{release=resolve;timeout=setTimeout(()=>{release=null;resolve();},ms);});
      function complete() {
        cancel();const a=data.amostras[current];if(!a||!$('sample-chat'))return;
        $('sample-chat').innerHTML=a.roteiro.map(bubble).join('');$('sample-chat').scrollTop=0;
        $('sample-play').dataset.playing='false';$('sample-play').textContent='Reproduzir amostra';$('sample-progress').textContent='Conversa completa';
      }
      async function play() {
        if($('sample-play').dataset.playing==='true'){cancel();$('sample-play').dataset.playing='false';$('sample-play').textContent='Recomeçar amostra';$('sample-chat').querySelector('.typing')?.remove();return;}
        if(reduced()){complete();return;}
        cancel();const id=run,a=data.amostras[current],chat=$('sample-chat'),button=$('sample-play');
        button.dataset.playing='true';button.textContent='Pausar amostra';chat.innerHTML='';
        for(let i=0;i<a.roteiro.length;i++){
          const t=a.roteiro[i];
          if(t.typing)chat.insertAdjacentHTML('beforeend','<div class="typing" aria-hidden="true">•••</div>');
          chat.scrollTop=chat.scrollHeight;await wait(t.typing||430);if(id!==run)return;
          chat.querySelector('.typing')?.remove();chat.insertAdjacentHTML('beforeend',bubble(t));chat.scrollTop=chat.scrollHeight;
          $('sample-progress').textContent=`${i+1} de ${a.roteiro.length}`;
          await wait(300);if(id!==run)return;
        }
        button.dataset.playing='false';button.textContent='Repetir amostra';
      }
      function bind(s) {
        cancel();current=s.slug;lens=null;
        const panel=$('modal');
        panel.querySelectorAll('[data-installed]').forEach(button=>button.addEventListener('click',e=>{
          const outcome=journey.setInstalled(s.slug,!journey.has(s.slug));
          if(!outcome.ok)return;
          event(journey.has(s.slug)?'instalacao_marcada':'instalacao_desmarcada',{skill:s.slug,salvo:outcome.saved});
          panel.querySelectorAll('[data-installed]').forEach(control=>{
            control.setAttribute('aria-pressed',String(journey.has(s.slug)));
            control.textContent=journey.has(s.slug)?'✓ Instalado':'Marcar como instalado';
          });
          // Só a posição acionada anuncia a mudança, sem duplicar a leitura de status.
          panel.querySelectorAll('.installation-feedback').forEach(message=>message.textContent='');
          e.currentTarget.closest('[data-install-area]').querySelector('.installation-feedback').textContent=outcome.saved?(journey.has(s.slug)?'Instalação marcada. Seu caminho foi atualizado.':'Marcação removida. As skills que dependem desta ficam bloqueadas.'): 'A marcação vale nesta visita. Não foi possível salvar neste navegador.';
          panel.querySelector('.installation-next').innerHTML=nextLink(s);
          hooks.changed();renderRecommendation();
        }));
        panel.querySelectorAll('[data-lens]').forEach(b=>b.addEventListener('click',()=>{
          lens=lens===b.dataset.lens?null:b.dataset.lens;
          panel.querySelectorAll('[data-lens]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.lens===lens)));
          const l=lens&&by[lens],usage=$('lens-usage');
          usage.hidden=!l;
          if(l){const text=s.how+'\n\nUse a régua de '+l.name+' ('+l.slug+').';usage.innerHTML=`<label for="usage-text">Depois de instalar, diga</label><textarea id="usage-text" readonly>${esc(text)}</textarea><button data-usage-copy>Copiar texto de uso</button><button data-act="open" data-slug="${esc(l.slug)}">Ver e instalar a régua</button>`;usage.querySelector('[data-usage-copy]').addEventListener('click',async e=>{try{await navigator.clipboard.writeText(text);e.target.textContent='Copiado ✓';}catch{e.target.textContent='Selecione o texto para copiar';$('usage-text').select();}});}
          $('lens-note').textContent=l ? `Régua de ${l.name}: ${l.sub}${data.amostras[s.slug]&&!data.amostras[s.slug].variantes?.[lens]?' Ainda não há amostra desta régua; a conversa abaixo usa o exemplo padrão.':''}` : 'Escolha uma régua para orientar o texto de uso desta skill.';
          complete();
        }));
        if(data.amostras[s.slug]){complete();$('sample-play').addEventListener('click',play);$('sample-all').addEventListener('click',()=>{complete();$('sample-play').dataset.playing='false';});}
      }
      home();
      if (kind) {
        $('entry-stage').hidden=true;$('guide').hidden=completeOnboarding;$('discovery').hidden=completeOnboarding;
        if(completeOnboarding)renderRecommendation();else paintGuide();
        event('caminho_restaurado');
      } else event('onboarding_exibido');
      window.addEventListener('storage',e=>{if(e.key===journey.key||e.key===null){journey.reload();hooks.changed(true);renderRecommendation();}});
      return {matches,card,context,extras,bind,cancel,setDoor,toggleGuide,resume,installation,installationButton,gate,status,
        locked:journey.locked, renderRecommendation, endVisit(){target=null;},
        get completed(){return completeOnboarding;},
        rows:data.fileiras.map(f=>({id:f.id,title:()=>f.titulo,note:f.sub,ids:available.filter(slug=>data.skills[slug].fileira===f.id),journey:true})),
        get door(){return door;}
      };
    }
  };
})();

// A prévia ampliada pode cobrir parte do card vizinho. Nesse trecho, o clique
// deve abrir o card que está sob o ponteiro, não a prévia anterior.
document.addEventListener('click', event => {
  const preview = event.target.closest('#preview');
  if (!preview || preview.hidden) return;
  const underneath = document.elementsFromPoint(event.clientX, event.clientY)
    .map(element => element.closest?.('.card[data-slug]'))
    .find(Boolean);
  if (!underneath || underneath.dataset.slug === preview.querySelector('.preview-open')?.dataset.slug) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  underneath.click();
}, true);
