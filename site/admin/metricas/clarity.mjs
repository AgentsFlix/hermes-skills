/* Agregados administrativos. Nenhum número real ou credencial é publicado no bundle. */
const nf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const df = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
const labels = {
  traffic: 'Visitas e bots', user_overview: 'Novos e recorrentes', pages_per_session: 'Páginas por visita', scroll_depth: 'Profundidade de rolagem', engagement_time: 'Tempo de navegação',
  popular_pages: 'Páginas mais acessadas', entry_pages: 'Páginas de entrada', exit_pages: 'Páginas de saída', smart_events: 'Ações observadas', insights: 'Problemas de navegação',
  channel: 'Canais de aquisição', source: 'Fontes de tráfego', medium: 'Meios de aquisição', campaign: 'Campanhas', referrer: 'Sites de origem', referrer_url: 'Sites de origem',
  device: 'Dispositivos', browser: 'Navegadores', os: 'Sistemas operacionais', country: 'Países', region: 'Regiões', city: 'Cidades', bot_types: 'Tipos de bot',
  performance: 'Desempenho do site', url_performance: 'Desempenho por página', javascript_errors: 'Erros de JavaScript', script_error_count: 'Sessões com erros de JavaScript',
  dead_click_count: 'Cliques sem resposta', rage_click_count: 'Cliques repetidos', quickback_click: 'Retornos rápidos', excessive_scroll: 'Rolagem excessiva', error_click_count: 'Cliques com erro', page_title: 'Títulos de página',
};
const actionLabels = { copiou_comando: 'Comando copiado', leitura_aberta: 'Leitura aberta', assistiu: 'Ação “assistiu”', abriu_card: 'Card aberto', onboarding_exibido: 'Onboarding exibido', onboarding_iniciado: 'Onboarding iniciado', onboarding_concluido: 'Onboarding concluído', comprar_clicado: 'Comprar clicado', prompt_copiado: 'Prompt copiado', copia_tentada: 'Tentativa de cópia' };
const measureLabels = { sessions_count: 'Sessões', visits_count: 'Visitas à página', value: 'Valor', distinct_visitors: 'Visitantes únicos', total_session_count: 'Sessões reportadas', total_bot_session_count: 'Sessões de bot', distinct_user_count: 'Usuários reportados pela API', active_time: 'Tempo ativo', total_time: 'Tempo total', average_scroll_depth: 'Rolagem média', pages_per_session_percentage: 'Páginas por sessão', sessions_percentage: 'Participação', sessions_with_metric_percentage: 'Sessões afetadas', sessions_without_metric_percentage: 'Sessões não afetadas', sub_total: 'Ocorrências', pages_views: 'Visualizações', reported_count: 'Erros reportados', score: 'Pontuação', lcp: 'LCP', inp: 'INP', cls: 'CLS' };
const sourceLabels = { dashboard_csv: 'Painel Clarity', data_export_api: 'API Clarity' };
const node = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const finite = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const stamp = (s) => typeof s === 'string' && Number.isFinite(Date.parse(s));
export function normalizeClarity(data) {
  if (data?.source !== 'Microsoft Clarity' || ![1,2,3,7,30,90,396].includes(data.requested_days) || !Array.isArray(data.metrics) || !Array.isArray(data.breakdowns)) throw new TypeError('Clarity indisponível');
  const snapshot = (m, breakdown = false) => {
    if (!sourceLabels[m.source || 'data_export_api'] || !stamp(m.period_start) || !stamp(m.period_end) || !stamp(m.retrieved_at) || !Array.isArray(m.rows) || (breakdown ? !Array.isArray(m.dimensions) : typeof m.metric !== 'string')) throw new TypeError('Snapshot inválido');
    for (const row of m.rows) {
      if (!row.segment || Object.values(row.segment).some(v => typeof v !== 'string') || !row.measures || !Object.keys(row.measures).length || Object.values(row.measures).some(v => !finite(v)) || !row.units || Object.values(row.units).some(v => typeof v !== 'string')) throw new TypeError('Agregado inválido');
    }
    return m;
  };
  return { ...data, metrics: data.metrics.map(m => snapshot(m)), breakdowns: data.breakdowns.map(m => snapshot(m, true)) };
}
function period(m) {
  const calendar = (s) => s.slice(0,10).split('-').reverse().join('/');
  const endStamp = /(?:Z|[+-]\d{2}:\d{2})$/.test(m.period_end) ? m.period_end : `${m.period_end}Z`;
  const end = new Date(Date.parse(endStamp) - (m.source === 'dashboard_csv' ? 60000 : 1)).toISOString();
  return `${calendar(m.period_start)} a ${calendar(end)}${m.source_timezone === 'UTC' ? ' · UTC' : ''}`;
}
function provenance(m) { return `${sourceLabels[m.source || 'data_export_api']} · ${period(m)} · Importado em ${df.format(new Date(m.retrieved_at))} (Brasília)`; }
function format(n, unit) {
  if (!finite(n)) return '—';
  if (unit === 'seconds') return n >= 60 ? `${Math.floor(n / 60)}min ${nf.format(n % 60)}s` : `${nf.format(n)}s`;
  if (unit === 'ratio') return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 5 }).format(n);
  if (unit === 'milliseconds') return `${nf.format(n)}ms`;
  if (unit === 'percent' || unit === 'reported_errors_percent') return `${nf.format(n)}%`;
  if (unit === 'score_0_100') return `${nf.format(n)}/100`;
  return nf.format(n);
}
const label = (r) => r.segment.label || r.segment.name || r.segment.url || Object.values(r.segment).join(' · ');
const humanLabel = (s) => actionLabels[s] || ({ 'Clique com o botão direito do mouse': 'Retornos rápidos', 'Clique inativo': 'Cliques sem resposta', 'Cliques contínuos': 'Cliques repetidos' }[s] || s);
const rows = (data, key) => data.metrics.find(m => m.metric === key)?.rows || [];
const find = (data, key, text, measure = 'value') => rows(data,key).find(r => label(r) === text)?.measures[measure];
function card(title, value, note, meter = null) {
  const e = node('article', 'af-card metric-card clarity-card');
  e.append(node('h3','af-type-context',title),node('p','metric-value af-type-context',value));
  if (finite(meter)) { const track = node('div','rank-meter'); track.setAttribute('aria-hidden','true'); const fill = node('span'); fill.style.width = `${Math.min(100,meter)}%`; track.append(fill); e.append(track); }
  e.append(node('p','metric-footnote af-type-caption',note)); return e;
}
function panel(title, subtitle) {
  const e = node('section','af-panel clarity-panel'); e.append(node('h2','',title)); if (subtitle) e.append(node('p','section-note af-type-caption',subtitle)); return e;
}
function bars(entries, measure = 'sessions_count', limit = 5, valueUnit = null) {
  const sorted = [...entries].filter(r => finite(r.measures[measure])).sort((a,b)=>b.measures[measure]-a.measures[measure]);
  const host = node('div','clarity-bars');
  if (!sorted.length) {host.append(node('p','rank-empty af-type-caption','Sem dados importados para este recorte.')); return host;}
  const peak = Math.max(1,...sorted.map(r=>r.measures[measure]));
  const list = node('ol','af-list rank-list');
  sorted.forEach((r,i)=>{
    const line = node('li','af-list-row clarity-bar-row'); line.hidden = i >= limit;
    const top = node('div','rank-top'); top.append(node('span','rank-title af-type-context',humanLabel(label(r))),node('strong','rank-number af-type-context',format(r.measures[measure],valueUnit || r.units[measure])));
    const track = node('div','rank-meter'); track.setAttribute('aria-hidden','true'); const fill = node('span'); fill.style.width = `${r.measures[measure]/peak*100}%`; track.append(fill);
    line.append(top,track); if (finite(r.measures.sessions_percentage)) line.append(node('span','af-type-caption',format(r.measures.sessions_percentage,'percent'))); list.append(line);
  });
  host.append(list);
  if (sorted.length > limit) {
    const more = node('button','af-button af-button--text ranking-more',`Ver todos (${sorted.length})`); more.type='button'; more.setAttribute('aria-expanded','false');
    more.addEventListener('click',()=>{const open=more.getAttribute('aria-expanded')!=='true'; [...list.children].forEach((e,i)=>{e.hidden=!open&&i>=limit;}); more.setAttribute('aria-expanded',String(open)); more.textContent=open?'Mostrar os primeiros 5':`Ver todos (${sorted.length})`;}); host.append(more);
  }
  return host;
}
function table(m) {
  const keys = [...new Set(m.rows.flatMap(r=>Object.keys(r.measures)))];
  const wrap=node('div','table-scroll'); wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label',labels[m.metric]||'Agregados por dimensão');
  const t=node('table'),head=node('thead'),h=node('tr');
  ['Recorte',...keys.map(k=>measureLabels[k]||k.replaceAll('_',' '))].forEach(x=>{const c=node('th','',x);c.scope='col';h.append(c);}); head.append(h);
  const body=node('tbody');m.rows.forEach(r=>{const line=node('tr'),title=node('th','',Object.entries(r.segment).map(([k,v])=>['label','name','url'].includes(k)?humanLabel(v):`${k}: ${v}`).join(' · ')||'Geral');title.scope='row';line.append(title);keys.forEach(k=>{const c=node('td','',format(r.measures[k],r.units[k]));c.title=r.units[k]||'';line.append(c);});body.append(line);});t.append(node('caption','sr-only',`${labels[m.metric]||'Métricas'} · Unidades preservadas da fonte`),head,body);wrap.append(t);return wrap;
}
function metricDetail(m) {
  const detail=node('details','metric-details clarity-metric-detail');detail.append(node('summary','af-type-context',labels[m.metric]||m.metric.replaceAll('_',' ')));
  let built=false;detail.addEventListener('toggle',()=>{if(!detail.open||built)return;built=true;detail.append(node('p','af-type-caption',provenance(m)));const key=['sessions_count','visits_count','score'].find(k=>m.rows.some(r=>finite(r.measures[k])));if(key)detail.append(bars(m.rows,key));detail.append(table(m));if(m.warnings?.length)detail.append(node('p','af-type-caption','A fonte contém avisos de cobertura; os recortes permanecem separados por importação.'));});return detail;
}
function distribution(title, entries) {
  const e=panel(title,'Participação nas sessões deste recorte');
  const values=entries.filter(r=>finite(r.measures.sessions_count)).sort((a,b)=>b.measures.sessions_count-a.measures.sessions_count);
  const total=values.reduce((n,r)=>n+r.measures.sessions_count,0),top=values[0];
  const visual=node('div','preference-visual'),donut=node('div','preference-donut');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 180 180');svg.setAttribute('aria-hidden','true');const c=2*Math.PI*70;
  const circle=(cls,len,offset)=>{const n=document.createElementNS(svg.namespaceURI,'circle');for(const [k,v]of Object.entries({cx:90,cy:90,r:70,class:cls,'stroke-dasharray':`${len} ${c-len}`,'stroke-dashoffset':-offset,transform:'rotate(-90 90 90)'}))n.setAttribute(k,String(v));svg.append(n);};
  circle('donut-base',c,0);let offset=0;values.forEach((r,i)=>{const len=total?r.measures.sessions_count/total*c:0;if(len)circle(`donut-segment ${i===0?'copies':i===1?'readings':'videos'}`,len,offset);offset+=len;});
  const center=node('div','donut-center');center.append(node('strong','af-type-context',total?`${Math.round(top.measures.sessions_count/total*100)}%`:'—'),node('span','af-type-caption',top?humanLabel(label(top)):'Sem dados'));donut.append(svg,center);
  const legend=node('ul','preference-legend');values.forEach((r,i)=>{const li=node('li'),l=node('div','preference-label');l.append(node('span',`legend-key ${i===0?'copies':i===1?'readings':'videos'}`),node('span','af-type-context',humanLabel(label(r))));const stats=node('div','preference-stats');stats.append(node('strong','af-type-context',total?`${Math.round(r.measures.sessions_count/total*100)}%`:'—'),node('span','af-type-caption',`${nf.format(r.measures.sessions_count)} sessões`));li.append(l,stats);legend.append(li);});visual.append(donut,legend);e.append(visual);return e;
}
export function renderClarityUnavailable(host) {
  host.replaceChildren();const e=panel('Histórico de visitas indisponível','Os dados do Clarity não carregaram. Use Atualizar para tentar novamente.');host.append(e);
}
export function renderClarity(host,data,recent) {
  host.replaceChildren();
  if(!data.metrics.length){host.append(panel('Sem importação para este período','Selecione outro período para consultar os dados disponíveis.'));return;}
  const traffic=data.metrics.find(m=>m.metric==='traffic'),overview=data.metrics.find(m=>m.metric==='user_overview');
  const heading=node('div','clarity-heading');heading.append(node('h2','','Visitas e comportamento'),node('p','section-note af-type-caption',provenance(traffic||data.metrics[0])));host.append(heading);
  const visits=find(data,'traffic','Total de sessões','sessions_count'),visitors=find(data,'user_overview','Usuários únicos','distinct_visitors'),active=find(data,'engagement_time','Tempo de atividade'),scroll=find(data,'scroll_depth','Média');
  const cards=node('div','metric-grid clarity-overview');cards.append(card('Visitas',format(visits),'Sessões · Bots excluídos no painel Clarity'),card('Visitantes únicos',format(visitors),'Identificadores distintos do Clarity'),card('Tempo ativo médio',format(active,'seconds'),'Tempo de interação por sessão'),card('Rolagem média',format(scroll,'percent'),'Profundidade alcançada na página',scroll));host.append(cards);
  const context=node('div','clarity-context');context.append(card('Páginas por visita',format(find(data,'pages_per_session','Média')),'Média de páginas em cada sessão'),card('Tempo total médio',format(find(data,'engagement_time','Tempo total'),'seconds'),'Inclui períodos sem interação'),card('Sessões de bot',format(find(data,'traffic','Sessões de bot','sessions_count')),'Separadas do total de visitas'));host.append(context);
  const grid=node('div','rankings-grid clarity-grid');
  const actions=panel('Ações no acervo','Sessões em que a ação ocorreu · Histórico Clarity');
  const events=rows(data,'smart_events');actions.append(bars(events.filter(r=>['copiou_comando','leitura_aberta','assistiu','abriu_card','prompt_copiado'].includes(label(r)))));
  const definition=node('details','metric-details');definition.append(node('summary','','Entender as ações históricas'),node('p','af-type-caption','O Clarity conta sessões com a ação, não quantas vezes ela aconteceu. “Assistiu” é o evento histórico do site; não comprova conclusão de aula. O detalhamento por skill e modo aparece na coleta do produto abaixo.'));actions.append(definition);grid.append(actions);
  const pages=panel('Páginas mais acessadas','Sessões que acessaram cada página · Barras comparadas ao líder');pages.append(bars(rows(data,'popular_pages')));grid.append(pages);
  const userRows=overview?.rows.filter(r=>finite(r.measures.sessions_count)).map(r=>({...r,segment:{label:label(r).includes('novos')?'Novas visitas':'Visitas de retorno'}}))||[];
  grid.append(distribution('Novas visitas e retorno',userRows),distribution('Como chegam ao site',rows(data,'device')));
  for(const [key,title]of [['channel','Canais de aquisição'],['source','Fontes de tráfego'],['country','De onde vêm as visitas'],['browser','Navegadores']]){const p=panel(title,'Sessões por categoria · Barras comparadas ao líder');p.append(bars(rows(data,key)));grid.append(p);}
  const friction=panel('Onde a navegação trava','Sessões afetadas · Cada problema é medido separadamente');const fr=node('div','clarity-friction');rows(data,'insights').forEach(r=>{const e=card(humanLabel(label(r)),format(r.measures.sessions_percentage,'percent'),`${format(r.measures.sessions_count)} sessões`,r.measures.sessions_percentage);fr.append(e);});friction.append(fr);grid.append(friction);
  const performance=panel('Desempenho do site','Indicadores medidos pelo Clarity');const perf=node('div','clarity-friction');rows(data,'performance').forEach(r=>{const title=label(r).startsWith('LCP')?'LCP · Carregamento':label(r).startsWith('Interação')?'INP · Resposta':label(r).startsWith('CLS')?'CLS · Estabilidade':label(r);perf.append(card(title,format(r.measures.value,r.units.value),r.units.value==='score_0_100'?'Pontuação do Clarity':r.units.value==='ratio'?'Índice de deslocamento visual':label(r).startsWith('LCP')?'Até o maior elemento aparecer':'Tempo para responder à interação',r.units.value==='score_0_100'?r.measures.value:null));});performance.append(perf);grid.append(performance);host.append(grid);
  const all=node('details','af-panel metric-details clarity-all');all.append(node('summary','af-type-context',`Todas as métricas do período (${data.metrics.length} grupos)`),node('p','af-type-caption','Páginas de entrada e saída, todas as ações, regiões, cidades, sistemas, bots, erros e desempenho por página. Cada grupo mostra a data da própria importação.'));
  data.metrics.forEach(m=>all.append(metricDetail(m)));host.append(all);
  const api=node('details','af-panel metric-details clarity-all');api.append(node('summary','af-type-context','Diagnóstico adicional · Últimas 72 horas importadas'));
  if(recent?.metrics.length){api.append(node('p','af-type-caption','Janela independente da API. Sessões e visualizações podem ter definições diferentes das exportações do painel acima. Os recortes não são somados entre si.'));recent.metrics.forEach(m=>api.append(metricDetail(m)));recent.breakdowns.forEach(m=>{const d=node('details','metric-details clarity-metric-detail');d.append(node('summary','af-type-context',`Recorte: ${m.dimensions.join(' · ')}`));let built=false;d.addEventListener('toggle',()=>{if(!d.open||built)return;built=true;d.append(node('p','af-type-caption',provenance(m)));const types=[...new Set(m.rows.map(r=>r.metric))];types.forEach(metric=>d.append(metricDetail({...m,metric,source:'data_export_api',rows:m.rows.filter(r=>r.metric===metric)})));});api.append(d);});}
  else api.append(node('p','af-type-caption','O diagnóstico da API não carregou ou ainda não tem importação. Use Atualizar para tentar novamente.'));host.append(api);
  const note=node('details','metric-details');note.append(node('summary','','Fonte e cobertura dos números'),node('p','af-type-caption','Histórico importado do Microsoft Clarity. Atualizar consulta as importações salvas; a data acima informa a última captura disponível. Os agregados podem incluir navegação em ambientes de desenvolvimento. Bots e tipos de bot permanecem separados; categorias de bot podem se sobrepor. Não há comparação com o período anterior sem outra importação compatível.'));host.append(note);
}
