/* Shared by the browser and the behavioral tests. All weights belong to this method. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ECF = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const METHOD = 'ecf-metas-v1';
  const AXES = {
    creator: {name:'Creator', asset:'Atenção própria', question:'As pessoas certas me encontram e escolhem acompanhar?', metrics:[
      ['alcance_relativo','Alcance relativo',.40], ['seguidores','Seguidores por alcance',.35], ['compartilhamentos','Compartilhamentos por alcance',.25]]},
    expert: {name:'Expert', asset:'Autoridade demonstrada', question:'Elas entendem meu raciocínio e reconhecem minha capacidade de resolver?', metrics:[
      ['salvamentos','Salvamentos por alcance',.35], ['autoridade','Sinais de autoridade por alcance',.35], ['conversas','Conversas qualificadas por alcance',.30]]},
    founder: {name:'Founder', asset:'Construção, reputação e demanda', question:'Elas reconhecem o que construo e qual próxima ação faz sentido?', metrics:[
      ['intencao','Intenção declarada por alcance',.40], ['dms','DMs qualificadas por alcance',.35], ['reconhecimento','Reconhecimento na pesquisa',.25]]}
  };
  const number = x => typeof x === 'number' && Number.isFinite(x) && x >= 0;
  const text = x => typeof x === 'string' && x.trim().length > 0 && x.length <= 1000;
  const date = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(Date.parse(x)) && new Date(x).toISOString().slice(0,10) === x;
  const profile = x => typeof x === 'string' && /^@?[a-zA-Z0-9._]{1,30}$/.test(x);
  const median = values => { const s = [...values].sort((a,b)=>a-b); const m = Math.floor(s.length/2); return s.length%2 ? s[m] : (s[m-1]+s[m])/2; };
  function emptyReport(handle, start, end) {
    return {method:METHOD, profile:handle, window:{start,end}, collected_at:null, coverage:[], observations:[], credential_resolution:null, axes:Object.fromEntries(Object.entries(AXES).map(([id,axis])=>[id,{
      analysis:{summary:'',evidence:[],limitations:[],next_step:''},
      cohort:{description:'', post_ids:[], comparable:false, collection_complete:false, reach_total:null},
      metrics:Object.fromEntries(axis.metrics.map(([key])=>[key,{numerator:null,denominator:null,samples:[],target:null,target_source:'',target_fixed_at:null,source:'',evidence:[],reason:'Ainda não coletado'}]))
    }]))};
  }
  // Older exports used resource objects; render only their descriptive fields.
  function coverageText(entry) {
    if (text(entry)) return entry;
    const allowed=['resource','endpoint','parameters','queried_at','pages','items','status','fields_unavailable','reason'];
    if (!entry || typeof entry!=='object' || Array.isArray(entry) || Object.keys(entry).some(k=>!allowed.includes(k)) || !text(entry.resource) || !text(entry.reason) ||
        (entry.pages!==undefined && entry.pages!==null && (!Number.isInteger(entry.pages)||entry.pages<0)) ||
        (entry.items!==undefined && entry.items!==null && (!Number.isInteger(entry.items)||entry.items<0))) throw Error('Confira as descrições de cobertura da coleta.');
    return [entry.resource,entry.pages!=null?entry.pages+' páginas':'',entry.items!=null?entry.items+' itens':'',entry.reason].filter(Boolean).join(' · ');
  }
  function observationValue(o) {
    return o.numerator===null || (o.unit==='ratio' && !(o.denominator>0)) ? null : o.unit==='ratio' ? o.numerator/o.denominator : o.numerator;
  }
  function validate(data) {
    if(data?.method===INITIAL_METHOD)return validateInitial(data);
    if (!data || data.method !== METHOD) throw Error('Use um relatório ECF compatível: ecf-inicial-v2 ou ecf-metas-v1.');
    if (!profile(data.profile)) throw Error('O relatório precisa identificar um @perfil de Instagram válido.');
    if (!data.window || !date(data.window.start) || !date(data.window.end) || (Date.parse(data.window.end)-Date.parse(data.window.start))/86400000 !== 29) throw Error('O relatório precisa de uma janela de 30 dias, incluindo início e fim.');
    if (data.collected_at !== null && (typeof data.collected_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(data.collected_at) || Number.isNaN(Date.parse(data.collected_at)))) throw Error('Confira a data e hora de coleta do relatório.');
    if (!Array.isArray(data.coverage) || data.coverage.length > 40) throw Error('A cobertura precisa ser uma lista de descrições curtas.');
    data.coverage.forEach(coverageText);
    if (data.observations!==undefined) {
      if (!Array.isArray(data.observations) || data.observations.length>30) throw Error('Confira os indicadores observados.');
      for(const o of data.observations) {
        if (!o || !text(o.label) || !text(o.scope) || !text(o.source) || !['count','ratio'].includes(o.unit) ||
            (o.numerator!==null&&!number(o.numerator)) || (o.denominator!==null&&!number(o.denominator)) ||
            (o.unit==='count'&&o.denominator!==null) || typeof o.reason!=='string' || o.reason.length>1000 ||
            ((o.numerator===null || (o.unit==='ratio'&&!(o.denominator>0)))&&!text(o.reason))) throw Error('Confira valores, origem e lacunas dos indicadores observados.');
      }
    }
    // Optional for earlier reports; when present, only operational metadata is accepted.
    const resolution=data.credential_resolution;
    if (resolution!==undefined && resolution!==null) {
      const fields=['source','test_endpoint','result'];
      if (typeof resolution!=='object' || Array.isArray(resolution) || Object.keys(resolution).length!==fields.length || Object.keys(resolution).some(key=>!fields.includes(key)) ||
          !['env','hermes_env','mcp','cli','sdk','unavailable'].includes(resolution.source) || resolution.test_endpoint!=='GET /v1/accounts' ||
          !['success','401','403','429','unavailable'].includes(resolution.result) || (resolution.source==='unavailable' && resolution.result!=='unavailable')) {
        throw Error('A resolução de credencial deve conter somente origem, endpoint e resultado permitidos, sem valores de credenciais.');
      }
    }
    for (const [id,axis] of Object.entries(AXES)) {
      const a = data.axes && data.axes[id];
      if (!a || !a.cohort || !a.metrics) throw Error('O relatório precisa conter os três eixos e seus componentes.');
      if (a.analysis!==undefined) {
        const n=a.analysis;
        if (!n || typeof n.summary!=='string' || n.summary.length>1000 || typeof n.next_step!=='string' || n.next_step.length>1000 ||
            !Array.isArray(n.evidence) || n.evidence.length>10 || n.evidence.some(x=>!text(x)) ||
            !Array.isArray(n.limitations) || n.limitations.length>10 || n.limitations.some(x=>!text(x)) ||
            (text(n.summary)&&n.evidence.length===0)) throw Error('A análise editorial precisa de evidências resumidas e limites explícitos.');
      }
      const c=a.cohort;
      if (!Array.isArray(c.post_ids) || c.post_ids.length>500 || c.post_ids.some(x=>!text(x)) || new Set(c.post_ids).size!==c.post_ids.length) throw Error('Os IDs da amostra precisam ser únicos em cada eixo.');
      if (typeof c.comparable !== 'boolean' || typeof c.collection_complete !== 'boolean') throw Error('Confira os estados de comparação e coleta de cada eixo.');
      if (typeof c.description!=='string' || c.description.length>1000 || (c.reach_total!==null && !number(c.reach_total))) throw Error('Confira a descrição e o alcance da amostra.');
      for (const [key] of axis.metrics) {
        const m=a.metrics[key];
        if (!m || !Array.isArray(m.samples) || m.samples.length>500 || m.samples.some(x=>!number(x)) || !Array.isArray(m.evidence) || m.evidence.length>100 || m.evidence.some(x=>!text(x))) throw Error('Confira as amostras e evidências de '+axis.name+'.');
        for (const field of ['numerator','denominator','target']) if (m[field]!==null && !number(m[field])) throw Error('Métricas e metas devem ser números não negativos ou null.');
        for (const field of ['source','target_source','reason']) if (typeof m[field]!=='string' || m[field].length>1000) throw Error('Confira as fontes e os motivos de cada componente.');
        if (m.target_fixed_at!==null && !date(m.target_fixed_at)) throw Error('Confira a data de fixação de cada meta.');
        if (key==='reconhecimento' && m.numerator!==null && m.denominator!==null && (!Number.isInteger(m.numerator) || !Number.isInteger(m.denominator) || m.numerator>m.denominator)) throw Error('Reconhecimento deve contar pessoas: o numerador não pode superar a amostra.');
      }
    }
    const ids=Object.values(data.axes).filter(a=>a&&a.cohort&&Array.isArray(a.cohort.post_ids)).flatMap(a=>a.cohort.post_ids);
    if(new Set(ids).size!==ids.length) throw Error('Cada post precisa de um único eixo principal.');
    return data;
  }
  function calculate(data) {
    if(data?.method===INITIAL_METHOD)return initialDashboard(data).axes;
    validate(data);
    return Object.fromEntries(Object.entries(AXES).map(([id,axis])=>{
      const a=data.axes[id], c=a.cohort, count=c.post_ids.length;
      const components=axis.metrics.map(([key,label,weight])=>{
        const m=a.metrics[key]; let raw=null, gap='';
        if (key==='alcance_relativo') {
          if (count && m.samples.length===count) raw=median(m.samples);
          else gap='Falta a razão alcance/base para cada post.';
        } else if (number(m.numerator) && number(m.denominator) && m.denominator>0) {
          if (key==='reconhecimento' || m.denominator===c.reach_total) raw=m.numerator/m.denominator;
          else gap='O denominador precisa corresponder ao alcance da coorte.';
        } else gap='Faltam eventos ou um denominador positivo.';
        const sourced=text(m.source) && m.evidence.length>0 && data.collected_at!==null;
        const calibrated=number(m.target) && m.target>0 && text(m.target_source) && date(m.target_fixed_at) && m.target_fixed_at<=data.window.start;
        if (!sourced) gap='Falta a origem, a evidência ou a data de coleta.';
        const points=raw!==null && sourced && calibrated ? 100*Math.min(raw/m.target,1) : null;
        return {key,label,weight,raw,points,gap:gap || (calibrated?'':'Meta ainda não calibrada para este ciclo.'),...{record:m}};
      });
      let status='Operacional', score=null;
      const gaps=[];
      if (!c.comparable || !text(c.description)) { status='Sem comparação'; gaps.push('Defina um grupo de posts com execução, distribuição e idade de medição equivalentes.'); }
      if (count<3) { status='Amostra insuficiente'; gaps.push('Reúna pelo menos 3 posts comparáveis neste eixo.'); }
      if (!c.collection_complete) {status='Coleta incompleta'; gaps.push('Conclua a coleta e a conferência das evidências deste eixo.');}
      const missing=components.filter(m=>m.points===null);
      if (missing.length) {status=components.every(m=>m.raw===null)?'Sem dados':'Não calculável'; missing.forEach(m=>gaps.push(m.label+': '+m.gap));}
      if (!gaps.length) {
        score=components.reduce((sum,m)=>sum+m.points*m.weight,0);
        if (count<6 || (id==='founder' && a.metrics.reconhecimento.denominator<10)) status='Provisório';
      }
      if (id==='founder' && !(a.metrics.reconhecimento.denominator>=10)) gaps.push('A pesquisa precisa de 10 respostas válidas para Founder ser operacional.');
      return [id,{score,status,count,components,gaps}];
    }));
  }
  function example() {
    const d=emptyReport('@perfil.exemplo','2026-08-01','2026-08-30');
    d.collected_at='2026-09-01T12:00:00Z'; d.coverage=['Demonstração fictícia. Nenhuma conta foi consultada.','Uma coorte ilustrativa de 6 posts por eixo, com coleta e metas completas.'];
    for(const [id,a] of Object.entries(d.axes)) {
      a.cohort={description:'Exemplo fictício: Reels orgânicos medidos em D+7.',post_ids:Array.from({length:6},(_,i)=>id+'-exemplo-'+(i+1)),comparable:true,collection_complete:true,reach_total:10000};
      for(const [key,m] of Object.entries(a.metrics)) {
        Object.assign(m,{numerator:id==='creator'?150:id==='expert'?90:40,denominator:10000,target:.02,target_source:'Meta fictícia definida antes do ciclo de exemplo.',target_fixed_at:'2026-07-31',source:'Registro fictício, 01/09/2026.',evidence:['Evidência ilustrativa. Não usar como diagnóstico real.'],reason:''});
        if(key==='alcance_relativo') Object.assign(m,{samples:[.6,.7,.8,.8,.9,1],numerator:null,denominator:null,target:1});
        if(key==='reconhecimento') Object.assign(m,{numerator:4,denominator:10,target:1});
      }
    }
    return d;
  }
  const INITIAL_METHOD='ecf-inicial-v2';
  const IDEAL_SCORE=80;
  const INITIAL_TARGETS={creator:{alcance_relativo:1,seguidores:.01,compartilhamentos:.01},expert:{salvamentos:.02,autoridade:.001,conversas:.001},founder:{intencao:.001,dms:.002,reconhecimento:.5}};
  const SHORT_LABELS={alcance_relativo:'Alcance relativo',seguidores:'Novos seguidores',compartilhamentos:'Compartilhamentos',salvamentos:'Salvamentos',autoridade:'Autoridade',conversas:'Conversas qualificadas',intencao:'Intenção',dms:'DMs qualificadas',reconhecimento:'Reconhecimento'};
  function initialReference() {return {label:'ECF inicial · proposta ajustável',ideal_score:IDEAL_SCORE,targets:JSON.parse(JSON.stringify(INITIAL_TARGETS))};}
  function validateReference(ref) {
    if(!ref || !text(ref.label) || ref.ideal_score!==IDEAL_SCORE || !ref.targets)throw Error('Confira a régua ECF inicial e o marco ideal de 80 pontos.');
    for(const [id,a] of Object.entries(AXES))for(const [key] of a.metrics)if(!number(ref.targets[id]?.[key])||ref.targets[id][key]<=0)throw Error('Cada valor ideal precisa ser um número positivo.');
    return ref;
  }
  function emptyInitialReport(handle,start,end,reference=initialReference()) {
    return {method:INITIAL_METHOD,profile:handle,window:{start,end},collected_at:null,reference:JSON.parse(JSON.stringify(validateReference(reference))),credential_resolution:null,coverage:[],axes:Object.fromEntries(Object.entries(AXES).map(([id,a])=>[id,{note:'',metrics:Object.fromEntries(a.metrics.map(([key])=>[key,{numerator:null,denominator:null,samples:[],status:'missing',scope:'',source:'',evidence:[],reason:'Ainda não medido'}]))}]))};
  }
  function validateInitial(data) {
    // Reuse the legacy envelope checks without changing its score calculation.
    validate({...emptyReport(data.profile,data.window?.start,data.window?.end),collected_at:data.collected_at,coverage:data.coverage,credential_resolution:data.credential_resolution});
    validateReference(data.reference);
    for(const [id,a] of Object.entries(AXES)) {
      const row=data.axes?.[id];
      if(!row||typeof row.note!=='string'||row.note.length>1000||!row.metrics)throw Error('O arquivo precisa dos três cards ECF e suas variáveis.');
      for(const [key] of a.metrics) {
        const m=row.metrics[key];
        if(!m||!['measured','partial','estimated','missing'].includes(m.status)||!Array.isArray(m.samples)||m.samples.length>500||m.samples.some(x=>!number(x))||!Array.isArray(m.evidence)||m.evidence.length>20||m.evidence.some(x=>!text(x)))throw Error('Confira o estado e as evidências de cada variável.');
        for(const field of ['numerator','denominator'])if(m[field]!==null&&!number(m[field]))throw Error('Use números não negativos ou null nas medições.');
        for(const field of ['source','scope','reason'])if(typeof m[field]!=='string'||m[field].length>1000)throw Error('Confira a origem e o contexto das medições.');
        if(m.status!=='measured'&&!text(m.reason))throw Error('Medições parciais, estimadas ou ausentes precisam de motivo.');
        if(key==='reconhecimento'&&m.numerator!==null&&m.denominator!==null&&(!Number.isInteger(m.numerator)||!Number.isInteger(m.denominator)||m.numerator>m.denominator))throw Error('Reconhecimento precisa contar respostas válidas da pesquisa.');
      }
    }
    return data;
  }
  function initialDashboard(data,reference) {
    validate(data);reference=reference||data.reference||initialReference();validateReference(reference);
    const legacy=data.method===METHOD;
    const results=Object.fromEntries(Object.entries(AXES).map(([id,a])=>{
      const row=data.axes[id];
      const components=a.metrics.map(([key])=>{
        const m=row.metrics[key], c=row.cohort;
        let raw=null;
        if(key==='alcance_relativo') {
          if(m.samples.length && (!legacy||m.samples.length===c.post_ids.length))raw=median(m.samples);
        } else if(number(m.numerator)&&number(m.denominator)&&m.denominator>0&&(!legacy||key==='reconhecimento'||m.denominator===c.reach_total))raw=m.numerator/m.denominator;
        const sourced=text(m.source)&&data.collected_at!==null;
        let quality=legacy?(c.comparable&&c.collection_complete&&m.evidence.length?'measured':'partial'):m.status;
        if(raw===null||!Number.isFinite(raw)||!sourced||quality==='missing') {raw=null;quality='missing';}
        if(quality==='measured'&&(!m.evidence.length||(key==='reconhecimento'&&m.denominator<10)))quality='partial';
        const ideal=reference.targets[id][key],points=raw===null?null:Math.min(100,IDEAL_SCORE*raw/ideal);
        return {key,label:SHORT_LABELS[key],raw,ideal,points,quality,record:m,scope:legacy?c.description:m.scope};
      });
      const available=components.filter(m=>m.points!==null);
      const partial=available.length<3||available.some(m=>m.quality!=='measured');
      return [id,{components,score:available.length?available.reduce((s,m)=>s+m.points,0)/available.length:null,measured:available.length,partial,note:legacy?(row.analysis?.summary||''):row.note}];
    }));
    const available=Object.values(results).filter(a=>a.score!==null);
    return {axes:results,reference,legacy,overall:available.length?available.reduce((s,a)=>s+a.score,0)/available.length:null,axesMeasured:available.length,partial:available.length<3||available.some(a=>a.partial)};
  }
  function initialExample() {
    const d=emptyInitialReport('@perfil.exemplo','2026-08-01','2026-08-30');d.collected_at='2026-09-01T12:00:00Z';d.coverage=['Exemplo fictício para mostrar os três cards. Nenhuma conta foi consultada.'];
    const points={creator:[72,48,66],expert:[40,64,55],founder:[88,72,80]};
    for(const [id,a] of Object.entries(AXES))a.metrics.forEach(([key],i)=>{
      const m=d.axes[id].metrics[key],raw=d.reference.targets[id][key]*points[id][i]/IDEAL_SCORE;
      Object.assign(m,{numerator:Math.round(raw*80000),denominator:80000,status:'measured',scope:'Conjunto fictício completo para esta variável.',source:'Demonstração ECF, sem dados reais.',evidence:['Números criados apenas para demonstrar o cálculo.'],reason:''});
      if(key==='reconhecimento')Object.assign(m,{numerator:5,denominator:10});
      if(key==='alcance_relativo')Object.assign(m,{numerator:null,denominator:null,samples:[raw,raw,raw]});
    });
    return d;
  }
  return {METHOD,AXES,emptyReport,validate,calculate,example,date,profile,coverageText,observationValue,INITIAL_METHOD,IDEAL_SCORE,SHORT_LABELS,initialReference,validateReference,emptyInitialReport,initialDashboard,initialExample};
});
