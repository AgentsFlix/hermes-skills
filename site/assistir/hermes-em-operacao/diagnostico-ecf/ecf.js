(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const escape = value => String(value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const percent = value => value===null ? 'Não disponível' : new Intl.NumberFormat('pt-BR',{style:'percent',maximumFractionDigits:3}).format(value);
  const fmt = value => new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(value);
  const dateLabel = value => new Intl.DateTimeFormat('pt-BR').format(new Date(value+'T12:00:00'));
  const collectedLabel = value => new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(value));
  const names=['understand','collect','diagnosis'], headings=['intro-title','collect-title','diagnosis-title'];
  const Native=ECF.Native;
  let currentModel=Native,currentReference=Native.initialReference(),activeData=null,activeDemo=false;
  let templatePromise, generatedPrompt='', completionPrompt='', pendingRaw='', generation=0, reportGeneration=0;
  function step(n) {
    names.forEach((id,i)=>$(id).hidden=i!==n);
    document.querySelectorAll('[data-step]').forEach(b=>{ if(Number(b.dataset.step)===n)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current'); });
    (n===0?document.querySelector('.lesson:not([hidden]) h1'):n===2&&!$('report-results').hidden?$('results-title'):$(headings[n])).focus();
  }
  document.querySelectorAll('[data-step],[data-next]').forEach(b=>b.addEventListener('click',()=>step(Number(b.dataset.step??b.dataset.next))));
  const localDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const end=new Date();end.setDate(end.getDate()-1);const start=new Date(end);start.setDate(start.getDate()-29);
  $('start').value=localDate(start);$('end').value=localDate(end);
  function invalidatePrompt() {
    generation++; $('form-status').textContent=''; generatedPrompt=''; $('prompt-output').value=''; $('prompt-panel').hidden=true; $('copy-status').textContent='';
  }
  $('collection-form').addEventListener('input',invalidatePrompt);
  $('collection-form').addEventListener('submit',async event=>{
    event.preventDefault();
    const handle=$('profile').value.trim(), from=$('start').value, to=$('end').value;
    if(!ECF.profile(handle)) { $('form-status').textContent='Informe apenas o @perfil, sem a URL do Instagram.';return; }
    if(!ECF.date(from)||!ECF.date(to)||(Date.parse(to)-Date.parse(from))/86400000!==29) { $('form-status').textContent='Escolha uma janela de 30 dias, contando o primeiro e o último dia.';return; }
    if(to>=localDate(new Date())) { $('form-status').textContent='Use uma janela de dias completos, terminando no máximo ontem.';return; }
    const revision=++generation;
    $('form-status').textContent='Preparando o prompt…';
    const context={perfil:handle.startsWith('@')?handle:'@'+handle,inicio:from,fim:to,modo:'metricas_nativas',ler_conteudo_de_mensagens:false};
    try {
      const prepared=await buildPrompt(context);
      if(revision!==generation)return;
      generatedPrompt=prepared;
      $('prompt-output').value=generatedPrompt;$('prompt-panel').hidden=false;$('form-status').textContent='Prompt pronto para '+context.perfil+'.';$('prompt-title').focus();
    } catch (_) { templatePromise=null;$('form-status').textContent='Não foi possível carregar o prompt. Confira sua conexão e clique em Gerar meu prompt para tentar de novo.'; }
  });
  async function buildPrompt(context,reference=currentModel===Native?currentReference:Native.initialReference()) {
    try {
      if(!templatePromise) templatePromise=Promise.all(['prompt.md','model.js','native.js','import.js','validator-cli.cjs'].map(file=>fetch(file,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('fetch');return r.text();})));
      const [template,...validator]=await templatePromise;
      return template.replace('{{CONTEXTO}}',JSON.stringify(context,null,2)).replace('{{CONTRATO}}','```json\n'+JSON.stringify(Native.emptyInitialReport(context.perfil,context.inicio,context.fim,reference),null,2)+'\n```').replace('{{VALIDATOR}}',()=> '```javascript\n'+validator.join('\n')+'\n```');
    } catch(error) {templatePromise=null;throw error;}
  }
  async function completeAnalysis(data) {
    const revision=reportGeneration;
    $('report-status').textContent='Preparando o pedido para continuar a análise…';
    try {
      const isNative=Boolean(Native.forMethod(data.method));
      const input=isNative?Native.upgrade({...data,reference:currentReference}):null;
      const prompt=await buildPrompt({perfil:data.profile,inicio:data.window.start,fim:data.window.end,modo:'retomar métricas nativas nos artefatos existentes',ler_conteudo_de_mensagens:false},input?.reference);
      if(revision!==reportGeneration)return;
      const base=isNative?'Reutilize este JSON v4 como dado de entrada. Preserve as medições existentes. Se accounts_engaged estiver ausente, recupere somente esse campo da fonte nativa da mesma conta e janela; não retome a extração de novos seguidores.\n\n<dados_existentes>\n'+JSON.stringify(input,null,2)+'\n</dados_existentes>\n\n':'O arquivo anterior usa métricas diferentes. Reaproveite somente os campos nativos dos artefatos privados da coleta, não as taxas de subconjuntos Creator/Expert/Founder. Não converta as antigas classificações semânticas em métricas nativas.\n\n';
      completionPrompt='# Complete o diagnóstico com métricas nativas do Zernio\n\nNa mesma conversa, reutilize os posts e respostas nativas da conta e janela já coletados. Não execute outra coleta completa. Se faltarem valores, consulte apenas os recursos agregados necessários e autorizados no prompt abaixo. Não leia mensagens, não classifique comentários e não faça pesquisa.\n\n'+base+prompt;
      $('completion-output').value=completionPrompt;$('completion-panel').hidden=false;$('completion-status').textContent='Pedido pronto. Cole na conversa em que a coleta foi feita.';$('report-status').textContent='Pedido de continuação preparado.';$('completion-title').focus();
    } catch(_) {if(revision===reportGeneration)$('report-status').textContent='Não foi possível carregar o pedido. Tente gerar o prompt para completar análise novamente.';}
  }
  $('copy-completion').addEventListener('click',async()=>{
    if(!completionPrompt)return;
    try {await navigator.clipboard.writeText(completionPrompt);$('completion-status').textContent='Pedido copiado. Cole na mesma conversa com o Hermes.';}
    catch(_) {$('completion-panel').querySelector('details').open=true;$('completion-output').focus();$('completion-output').select();$('completion-status').textContent='Use Copiar no seu dispositivo para levar o texto selecionado.';}
  });
  $('download-completion').addEventListener('click',()=>{if(completionPrompt)download('pedido-completar-analise-ecf.md',completionPrompt,'text/markdown;charset=utf-8');});
  $('copy-prompt').addEventListener('click',async()=>{
    if(!generatedPrompt)return;
    try {await navigator.clipboard.writeText(generatedPrompt);$('copy-status').textContent='Prompt copiado. Cole na conversa com o Hermes.';}
    catch (_) {$('prompt-panel').querySelector('details').open=true;$('prompt-output').focus();$('prompt-output').select();$('copy-status').textContent='A cópia automática não ficou disponível. O prompt está selecionado: use Copiar no seu dispositivo.';}
  });
  function download(name,content,type) {
    const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  $('download-prompt').addEventListener('click',()=>{if(generatedPrompt)download('prompt-diagnostico-ecf.md',generatedPrompt,'text/markdown;charset=utf-8');});
  function clearResults() {reportGeneration++;$('analyze-report').disabled=false;$('report-entry').hidden=false;$('diagnosis').classList.remove('has-report');$('report-results').hidden=true;$('report-results').replaceChildren();$('completion-panel').hidden=true;$('completion-output').value='';completionPrompt='';}
  function scoreLabel(value) {return value===null?'Sem medição':String(Math.round(value));}
  function renderReport(data,demo,override,prepared) {
    const imported=prepared||ECFImport.read(JSON.stringify(data));
    const viewModel=Native.forMethod(imported.data.method)||ECF;
    const isNative=viewModel!==ECF,isCurrent=viewModel===Native;
    const dashboard=viewModel.initialDashboard(imported.data,override||data?.reference||(viewModel===currentModel?currentReference:viewModel.initialReference()));
    currentModel=viewModel;
    currentReference=JSON.parse(JSON.stringify(dashboard.reference));activeData=data;activeDemo=demo;reportGeneration++;
    $('completion-panel').hidden=true;completionPrompt='';
    const cards=Object.entries(viewModel.AXES).map(([id,axis],index)=>{
      const r=dashboard.axes[id],art=$('art-'+id).innerHTML;
      const bars=r.components.map(m=>`<div class="variable"><div class="variable-label"><span>${escape(m.label)}</span><b>${m.points===null?'Sem dado':Math.round(m.points)+'<small>/100</small>'}</b></div><div class="variable-track" ${m.points===null?'':`role="meter" aria-label="${escape(m.label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(m.points)}"`}><span style="width:${m.points??0}%"></span></div><p>${m.raw===null?'Medição ainda ausente':percent(m.raw)}<span>Ideal ${percent(m.ideal)}</span></p></div>`).join('');
      const marker=r.score===null?'':`<i class="you-marker" style="left:${r.score}%" aria-hidden="true"></i>`;
      return `<article class="scorecard" aria-labelledby="card-${id}"><div class="scorecard-title"><div><p>${String(index+1).padStart(2,'0')} / ${id==='creator'?'ATENÇÃO':id==='expert'?(isNative?'INTERESSE':'AUTORIDADE'):(isNative?'AÇÕES':'DEMANDA')}</p><h2 id="card-${id}">${axis.name}</h2></div></div><div class="scorecard-art" aria-hidden="true">${art}</div><div class="variables">${bars}</div><div class="axis-average"><div><span>Média geral</span><strong class="axis-number ${r.score===null?'unmeasured':''}">${scoreLabel(r.score)}${r.score===null?'':'<small>/100</small>'}</strong></div><span class="sample-badge">${r.measured}/3 variáveis${r.partial?' · parcial':''}</span></div><div class="ideal-ruler" role="img" aria-label="Média ${r.score===null?'sem medição':Math.round(r.score)+' de 100'}. Faixa ideal a partir de 80 pontos.">${marker}<i class="ideal-marker" aria-hidden="true"></i></div><div class="ruler-labels"><span>0</span><span>Ideal ≥ 80</span><span>100</span></div></article>`;
    }).join('');
    const config=Object.entries(viewModel.AXES).map(([id,axis])=>`<fieldset><legend>${axis.name}</legend>${axis.metrics.map(([key])=>`<label>${escape(viewModel.SHORT_LABELS[key])}<span><input type="number" inputmode="decimal" step="any" min="0.000001" data-ref-axis="${id}" data-ref-key="${key}" value="${currentReference.targets[id][key]*100}" required aria-label="Ideal de ${escape(viewModel.SHORT_LABELS[key])}"> %</span></label>`).join('')}</fieldset>`).join('');
    const details=Object.entries(viewModel.AXES).map(([id,axis])=>{
      const r=dashboard.axes[id];
      return `<section><h3>${axis.name}</h3>${r.note?`<p>${escape(r.note)}</p>`:''}${r.components.map(m=>`<div class="source-detail"><b>${escape(m.label)}</b><p>${percent(m.raw)} · ideal ${percent(m.ideal)} · ${escape(m.quality)}</p><p>${escape(m.scope||'Contexto não informado.')}</p><p>${escape(m.record.source||'Origem não informada.')}</p>${m.record.reason?`<p>${escape(m.record.reason)}</p>`:''}${(m.record.evidence||[]).map(e=>`<p>${escape(e)}</p>`).join('')}</div>`).join('')}</section>`;
    }).join('');
    $('report-results').innerHTML=`${demo?'<p class="demo-label">EXEMPLO FICTÍCIO · Apenas para mostrar o visual e o cálculo.</p>':''}<div class="dashboard-heading"><div><p class="eyebrow">SEU DIAGNÓSTICO ECF</p><h1 id="results-title" tabindex="-1">Seu perfil em três notas.</h1><p>${escape(data.profile)} <span>· ${dateLabel(data.window.start)} a ${dateLabel(data.window.end)}</span></p></div><div class="profile-average"><span>${dashboard.partial?'Média parcial do perfil':'Média do perfil'}</span><strong>${scoreLabel(dashboard.overall)}${dashboard.overall===null?'':'<small>/100</small>'}</strong><p>${dashboard.axesMeasured}/3 eixos com medição</p></div></div><div class="score-grid compact-scores">${cards}</div><div class="dashboard-toolbar"><p>${escape(currentReference.label)}<span>Ideal a partir de 80 pontos.</span></p><div class="actions"><button type="button" class="text-button" id="edit-reference">Ajustar régua</button><button type="button" class="text-button" id="clear-report">Trocar arquivo</button>${demo?'':`<button type="button" class="secondary" id="resume-analysis">${isCurrent?'Completar métricas':isNative?'Atualizar métrica Founder':'Usar métricas Zernio'}</button>`}</div></div><details id="reference-panel" class="reference-panel"><summary>Valores ideais desta régua</summary><p>Referência operacional proposta, ajustável. Não é um benchmark de mercado. Cada variável recebe até 100 pontos; atingir seu valor ideal vale 80. A média usa pesos iguais e informa quando faltam medições.</p><form id="reference-form"><div class="reference-fields">${config}</div><div class="actions"><button type="submit" class="primary">Aplicar régua</button><button type="button" class="secondary" id="reset-reference">Restaurar proposta</button></div><p class="hint">A alteração vale nesta página e nos prompts gerados nesta sessão.</p><p id="reference-status" class="status" role="status"></p></form></details><p id="import-summary" class="hint">${imported.audit.measured}/9 medições disponíveis${imported.audit.legacy?' · arquivo anterior convertido':''}. ${imported.audit.complete?'Preenchimento completo.':'Resultado parcial.'}${isCurrent?' Indicadores nativos de atenção, interesse e ação.':isNative?' Método v3 preservado. Atualize Founder para usar contas engajadas.':' Método anterior: gere a coleta nativa para usar as novas métricas.'}</p><details class="report-evidence"><summary>Ver dados e critérios</summary><h3>Conferência do arquivo</h3><p>Formato validado. A conferência automática não verifica a veracidade das evidências.</p>${imported.audit.changes.length?`<ul>${imported.audit.changes.map(c=>`<li>${escape(c)}</li>`).join('')}</ul>`:''}${imported.audit.missing.length?`<ul>${imported.audit.missing.map(m=>`<li><b>${escape(m.label)}</b>: ${escape(m.reason)}</li>`).join('')}</ul>`:''}${demo?'':'<button type="button" class="text-button" id="download-normalized">Baixar JSON normalizado</button>'}<p>${imported.audit.legacy?'Arquivo anterior recalculado na régua inicial. O arquivo de origem permanece no método por metas da versão 1.':isNative?'Método '+escape(viewModel.METHOD)+'. Expert representa interesse; Founder representa ações observadas. Não são provas de expertise, intenção de compra ou vendas.':'Método ecf-inicial-v2.'} Score = mínimo de 100 e 80 × observado / ideal. A média de cada eixo considera as variáveis medidas. A média do perfil considera os eixos com medição. Resultados parciais não devem ser tratados como diagnóstico completo.</p><p>${data.collected_at?'Coletado em '+collectedLabel(data.collected_at):'Coleta sem data informada.'}</p>${details}<h3>Cobertura da coleta</h3><ul>${data.coverage.map(c=>`<li>${escape(ECF.coverageText(c))}</li>`).join('')}</ul>${data.observations?.length?`<details><summary>Outros indicadores</summary><ul>${data.observations.map(o=>`<li>${escape(o.label)}: ${o.unit==='ratio'?percent(ECF.observationValue(o)):o.numerator===null?'Sem dado':fmt(o.numerator)}. ${escape(o.scope)}. ${escape(o.reason)}</li>`).join('')}</ul></details>`:''}</details>`;
    $('report-results').hidden=false;$('report-entry').hidden=true;$('diagnosis').classList.add('has-report');
    if(!demo){
      $('resume-analysis').addEventListener('click',()=>completeAnalysis(data));
      $('download-normalized').addEventListener('click',()=>{const exported={...imported.data,reference:currentReference};download('diagnostico-ecf-normalizado.json',JSON.stringify(exported,null,2),'application/json;charset=utf-8');});
    }
    $('clear-report').addEventListener('click',()=>{clearResults();activeData=null;pendingRaw='';$('report-file').value='';$('report-json').value='';$('report-status').textContent='';$('diagnosis-title').focus();});
    $('edit-reference').addEventListener('click',()=>{$('reference-panel').open=!$('reference-panel').open;if($('reference-panel').open)$('reference-panel').querySelector('input').focus();});
    $('reference-form').addEventListener('submit',event=>{
      event.preventDefault();const ref=JSON.parse(JSON.stringify(currentReference));ref.label='Sua régua ECF · ajuste nesta sessão';
      document.querySelectorAll('[data-ref-axis]').forEach(input=>{ref.targets[input.dataset.refAxis][input.dataset.refKey]=Number(input.value)/100;});
      try {viewModel.validateReference(ref);renderReport(activeData,activeDemo,ref);$('report-status').textContent='Régua aplicada. Notas recalculadas.';}catch(error){$('reference-status').textContent=error.message;}
    });
    $('reset-reference').addEventListener('click',()=>{renderReport(activeData,activeDemo,viewModel.initialReference());$('report-status').textContent='Régua inicial restaurada.';});
    $('report-status').textContent='';$('results-title').focus();
  }
  function importText(raw) {
    clearResults();
    try {
      if(raw.length>200000)throw Error('Use o resumo agregado de até 200 KB, sem dados brutos de conversas.');
      if(!raw.trim())throw Error('Selecione o arquivo diagnostico-ecf.json ou cole seu conteúdo antes de gerar a análise.');
      const imported=ECFImport.read(raw);
      renderReport(imported.source,false,undefined,imported);
      // Keep a record of safe format repairs without changing the original file.
      if(imported.audit.changes.length)$('import-summary').textContent+=' '+imported.audit.changes.length+(imported.audit.changes.length===1?' ajuste aplicado.':' ajustes aplicados.');
    } catch(error) {$('report-status').textContent=error.message;}
  }
  $('example').addEventListener('click',()=>{clearResults();pendingRaw='';$('report-json').value='';$('report-file').value='';renderReport(Native.initialExample(),true);});
  $('report-json').addEventListener('input',()=>{clearResults();pendingRaw='';$('report-file').value='';$('report-status').textContent='Texto alterado. Clique em Gerar análise e conferir scores.';});
  $('analyze-report').addEventListener('click',()=>importText($('report-json').value.trim()||pendingRaw));
  $('report-file').addEventListener('change',async()=>{
    clearResults();pendingRaw='';$('report-json').value='';
    const file=$('report-file').files[0];if(!file){$('report-status').textContent='Selecione um arquivo ou cole o resumo.';return;}
    const revision=reportGeneration;
    if(file.size>200000) {$('report-status').textContent='Use apenas o resumo agregado de até 200 KB, sem dados brutos.';return;}
    $('analyze-report').disabled=true;$('report-status').textContent='Lendo o arquivo…';
    try {const raw=await file.text();if(revision===reportGeneration){pendingRaw=raw;$('report-status').textContent='Arquivo carregado. Clique em Gerar análise e conferir scores.';}}
    catch(_) {if(revision===reportGeneration)$('report-status').textContent='Não foi possível ler o arquivo. Abra novamente ou cole o resumo.';}
    finally {if(revision===reportGeneration)$('analyze-report').disabled=false;}
  });
})();
