/* Native Instagram observations only. Legacy ECF methods remain separate. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports={...module.exports,Native:factory(module.exports)};
  else root.ECF.Native=factory(root.ECF);
})(typeof globalThis!=='undefined'?globalThis:this,function(M){
  'use strict';
  function create(METHOD){
  const V4=METHOD==='ecf-zernio-v4',IDEAL_SCORE=80;
  const ACTION_KEY=V4?'contas_engajadas':'novos_seguidores',ACTION_FIELD=V4?'accounts_engaged':'follows';
  const AXES={
    creator:{name:'Creator',asset:'Atenção',question:'Quanto o perfil alcança e mobiliza?',metrics:[['alcance','Alcance por seguidor'],['curtidas','Curtidas'],['compartilhamentos','Compartilhamentos']]},
    expert:{name:'Expert',asset:'Interesse',question:'Quanto o conteúdo desperta interesse?',metrics:[['salvamentos','Salvamentos'],['comentarios','Comentários'],['tempo_assistido','Tempo assistido · Reels']]},
    founder:{name:'Founder',asset:'Ações',question:'Quais ações o perfil recebe?',metrics:[['cliques_perfil','Cliques no perfil'],[ACTION_KEY,V4?'Contas engajadas':'Novos seguidores'],['conversas_inbox','Conversas no inbox']]}
  };
  const SHORT_LABELS=Object.fromEntries(Object.values(AXES).flatMap(a=>a.metrics));
  const TARGETS={creator:{alcance:3,curtidas:.05,compartilhamentos:.01},expert:{salvamentos:.02,comentarios:.01,tempo_assistido:.5},founder:{cliques_perfil:.01,[ACTION_KEY]:V4?.1:.01,conversas_inbox:.01}};
  const ACCOUNT_FIELDS=['reach','followers_count','profile_links_taps',ACTION_FIELD];
  const POST_FIELDS=['reach','likes','comments','shares','saves','ig_reels_avg_watch_time_ms','video_duration_seconds'];
  const clone=x=>JSON.parse(JSON.stringify(x));
  const fail=(p,msg)=>{throw Error(p+': '+msg);};
  const nonempty=x=>typeof x==='string'&&x.trim().length>0&&x.length<=1000;
  const integer=x=>Number.isSafeInteger(x)&&x>=0;
  const timestamp=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(x)&&Number.isFinite(Date.parse(x));
  const keys=(o,expected,p)=>{
    if(!o||typeof o!=='object'||Array.isArray(o))fail(p,'use um objeto.');
    if(Object.keys(o).some(k=>!expected.includes(k)))fail(p,'há campos fora do contrato nativo.');
    for(const k of expected)if(!Object.prototype.hasOwnProperty.call(o,k))fail(p+'.'+k,'campo obrigatório ausente.');
  };
  const median=xs=>{const s=[...xs].sort((a,b)=>a-b),i=Math.floor(s.length/2);return s.length%2?s[i]:(s[i-1]+s[i])/2;};
  function initialReference(){return{label:V4?'ECF Zernio v4 · proposta ajustável':'ECF Zernio · proposta ajustável',ideal_score:80,targets:clone(TARGETS)};}
  function validateReference(r){
    keys(r,['label','ideal_score','targets'],'reference');if(!nonempty(r.label)||r.ideal_score!==80)fail('reference','use rótulo e ideal de 80 pontos.');
    keys(r.targets,Object.keys(AXES),'reference.targets');
    for(const [id,a] of Object.entries(AXES)){
      keys(r.targets[id],a.metrics.map(([k])=>k),'reference.targets.'+id);
      for(const [k] of a.metrics)if(typeof r.targets[id][k]!=='number'||!Number.isFinite(r.targets[id][k])||r.targets[id][k]<=0)fail('reference.targets.'+id+'.'+k,'use um ideal positivo.');
    }return r;
  }
  function emptyReport(profile,start,end,reference=initialReference()){
    const base={account_id:null,status:'missing',source:'',reason:'Ainda não coletado'};
    return{method:METHOD,profile,account_id:null,window:{start,end},collected_at:null,reference:clone(validateReference(reference)),credential_resolution:null,coverage:[],
      account:{...base,reach:null,followers_count:null,followers_updated_at:null,profile_links_taps:null,[ACTION_FIELD]:null},
      posts:{...base,expected_count:null,items:[]},inbox:{...base,unique_conversations:null}};
  }
  function validate(d){
    keys(d,['method','profile','account_id','window','collected_at','reference','credential_resolution','coverage','account','posts','inbox'],'relatório');
    if(d.method!==METHOD)fail('method','use '+METHOD+'.');
    keys(d.window,['start','end'],'window');
    // Shared profile, period, timestamp and credential checks; no old metric migration.
    M.validate({...M.emptyReport(d.profile,d.window.start,d.window.end),collected_at:d.collected_at,credential_resolution:d.credential_resolution,coverage:d.coverage});
    if(!Array.isArray(d.coverage)||d.coverage.some(x=>typeof x!=='string'))fail('coverage','use textos curtos.');
    if(d.account_id!==null&&!nonempty(d.account_id))fail('account_id','use o ID da conta ou null.');
    validateReference(d.reference);
    const resource=(x,name,fields)=>{
      keys(x,['account_id','status','source','reason',...fields],name);
      if(!['complete','partial','missing'].includes(x.status))fail(name+'.status','use complete, partial ou missing.');
      for(const f of ['source','reason'])if(typeof x[f]!=='string'||x[f].length>1000)fail(name+'.'+f,'use texto curto.');
      if(x.account_id!==null&&!nonempty(x.account_id))fail(name+'.account_id','use ID ou null.');
      if(x.status!=='complete'&&!nonempty(x.reason))fail(name+'.reason','explique a cobertura ou indisponibilidade.');
      if(x.status!=='missing'&&(!nonempty(x.source)||!d.collected_at||!d.account_id||x.account_id!==d.account_id))fail(name,'confira fonte, coleta e ID da mesma conta.');
    };
    resource(d.account,'account',[...ACCOUNT_FIELDS,'followers_updated_at']);
    for(const k of ACCOUNT_FIELDS)if(d.account[k]!==null&&!integer(d.account[k]))fail('account.'+k,'use uma contagem inteira não negativa ou null.');
    if(d.account.followers_updated_at!==null&&!timestamp(d.account.followers_updated_at))fail('account.followers_updated_at','use a data da base atual de seguidores.');
    if(d.account.status==='missing'&&ACCOUNT_FIELDS.some(k=>d.account[k]!==null))fail('account','recurso missing não pode conter medições.');
    resource(d.posts,'posts',['expected_count','items']);
    if(!Array.isArray(d.posts.items)||d.posts.items.length>500)fail('posts.items','use até 500 posts, sem conteúdo textual.');
    if(d.posts.expected_count!==null&&(!integer(d.posts.expected_count)||d.posts.expected_count<d.posts.items.length))fail('posts.expected_count','confira o total da paginação.');
    if(d.posts.status==='complete'&&d.posts.expected_count!==d.posts.items.length)fail('posts.expected_count','complete exige todos os posts da paginação.');
    if(d.posts.status==='missing'&&d.posts.items.length)fail('posts','recurso missing não pode conter posts.');
    const ids=new Set();
    for(const [i,row] of d.posts.items.entries()){
      const p='posts.items['+i+']';keys(row,['id','published_at','last_updated','media_product_type',...POST_FIELDS],p);
      if(!nonempty(row.id)||ids.has(row.id))fail(p+'.id','use IDs de posts únicos.');ids.add(row.id);
      if(!timestamp(row.published_at)||(row.last_updated!==null&&!timestamp(row.last_updated)))fail(p,'informe publicação e atualização do snapshot.');
      if(row.published_at.slice(0,10)<d.window.start||row.published_at.slice(0,10)>d.window.end)fail(p+'.published_at','post fora da janela.');
      if(!['FEED','REELS','STORY','AD','UNKNOWN'].includes(row.media_product_type))fail(p+'.media_product_type','use o tipo nativo; video não comprova REELS.');
      for(const k of POST_FIELDS)if(row[k]!==null&&!integer(row[k]))fail(p+'.'+k,'use a contagem ou duração nativa inteira, ou null.');
    }
    resource(d.inbox,'inbox',['unique_conversations']);
    if(d.inbox.unique_conversations!==null&&!integer(d.inbox.unique_conversations))fail('inbox.unique_conversations','use o total nativo inteiro ou null.');
    if(d.inbox.status==='missing'&&d.inbox.unique_conversations!==null)fail('inbox','recurso missing não pode conter medição.');
    return d;
  }
  function normalize(d,changes){
    function n(o,k,p){const x=o?.[k];if(typeof x==='string'&&/^(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(x.trim())&&Number.isFinite(Number(x))){o[k]=Number(x);changes.push(p+': texto numérico convertido.');}}
    for(const k of ACCOUNT_FIELDS)n(d.account,k,'account.'+k);
    n(d.inbox,'unique_conversations','inbox.unique_conversations');n(d.posts,'expected_count','posts.expected_count');
    if(Array.isArray(d.posts?.items))d.posts.items.forEach((row,i)=>POST_FIELDS.forEach(k=>n(row,k,'posts.items['+i+'].'+k)));
    for(const [id,a] of Object.entries(AXES))for(const [k] of a.metrics)n(d.reference?.targets?.[id],k,'reference.targets.'+id+'.'+k);
  }
  function dashboard(d,reference=d.reference){
    validate(d);validateReference(reference);
    const acct=d.account,posts=d.posts,inbox=d.inbox;
    // Entire profile, with a metric-specific subset when the API omits fields.
    const content=posts.items.filter(p=>['FEED','REELS','UNKNOWN'].includes(p.media_product_type));
    const note='Indicadores nativos do perfil. Não comprovam expertise, intenção de compra ou vendas.';
    function metric(key,raw,quality,scope,source,reason,evidence){return{key,label:SHORT_LABELS[key],raw,quality,scope,record:{source,reason,evidence},reason};}
    function missing(key,reason,source=''){return metric(key,null,'missing','',source,reason,[]);}
    function accountRatio(key,n,den,source=acct,scope='Conta na janela de 30 dias',extra=''){
      if(n===null||den===null||den<=0||source.status==='missing'||acct.status==='missing')return missing(key,source.reason||'Campo nativo ou denominador positivo indisponível.',source.source);
      return metric(key,n/den,source.status==='partial'||acct.status==='partial'||(key==='alcance'&&!acct.followers_updated_at)?'partial':'measured',scope,source.source,extra||(key==='alcance'&&!acct.followers_updated_at?'Data de atualização da base atual não informada.':source.reason),[n+' / '+den]);
    }
    function postRatio(key,field){
      const valid=content.filter(p=>p[field]!==null&&p.reach!==null),den=valid.reduce((s,p)=>s+p.reach,0),num=valid.reduce((s,p)=>s+p[field],0);
      if(!valid.length||!den)return missing(key,posts.reason||'Sem posts com os dois campos nativos e alcance positivo.',posts.source);
      const partial=posts.status!=='complete'||valid.length!==content.length;
      return metric(key,num/den,partial?'partial':'measured',valid.length+' posts com '+field+' e reach; snapshots de publicações na janela.',posts.source,partial?(posts.reason||'Alguns posts não retornaram ambos os campos.'):'',[num+' / '+den+'; mesmos posts, sem usar alcance da conta.']);
    }
    const reels=content.filter(p=>p.media_product_type==='REELS'),watched=reels.filter(p=>p.ig_reels_avg_watch_time_ms!==null&&p.video_duration_seconds>0);
    const watch=watched.length?metric('tempo_assistido',median(watched.map(p=>p.ig_reels_avg_watch_time_ms/(p.video_duration_seconds*1000))),posts.status==='complete'&&watched.length===reels.length?'measured':'partial',watched.length+'/'+reels.length+' Reels com tempo médio e duração. Mediana da fração assistida; não é taxa de conclusão.',posts.source,watched.length<reels.length?'Duração ou tempo médio ausente em parte dos Reels.':posts.status==='partial'?posts.reason:'',['Razão por Reel: tempo médio em ms / (duração em s × 1.000).']):missing('tempo_assistido','Sem Reels com tempo médio e duração disponíveis.',posts.source);
    const rows={
      creator:[accountRatio('alcance',acct.reach,acct.followers_count,acct,'Alcance da conta no período / base atual de seguidores em '+(acct.followers_updated_at||'data ausente')+'. Índice de distribuição, não alcance histórico por post.'),postRatio('curtidas','likes'),postRatio('compartilhamentos','shares')],
      expert:[postRatio('salvamentos','saves'),postRatio('comentarios','comments'),watch],
      founder:[accountRatio('cliques_perfil',acct.profile_links_taps,acct.reach),accountRatio(ACTION_KEY,acct[ACTION_FIELD],acct.reach,acct,V4?'Contas engajadas / alcance da conta na mesma janela. Contagem nativa de contas, não soma de interações ou classificação de intenção.':'Seguimentos brutos da conta na janela / alcance da conta. Sem atribuição a posts; não usa variação líquida.'),accountRatio('conversas_inbox',inbox.unique_conversations,acct.reach,inbox,'Conversas únicas do inbox / alcance da conta na mesma janela. Conversas, não pessoas ou leads qualificados.')]
    };
    const axes=Object.fromEntries(Object.entries(rows).map(([id,components])=>{
      components.forEach(m=>{m.ideal=reference.targets[id][m.key];m.points=m.raw===null?null:Math.min(100,80*m.raw/m.ideal);});
      const available=components.filter(m=>m.points!==null);
      return[id,{components,score:available.length?available.reduce((s,m)=>s+m.points,0)/available.length:null,measured:available.length,partial:available.length!==3||available.some(m=>m.quality!=='measured'),note}];
    }));
    const available=Object.values(axes).filter(a=>a.score!==null);
    return{axes,reference,legacy:false,overall:available.length?available.reduce((s,a)=>s+a.score,0)/available.length:null,axesMeasured:available.length,partial:available.length!==3||available.some(a=>a.partial)};
  }
  function inspect(d){
    const b=dashboard(d),missing=[],limited=[],scores={};
    const fields={alcance:['account.reach','account.followers_count'],curtidas:['posts.items'],compartilhamentos:['posts.items'],salvamentos:['posts.items'],comentarios:['posts.items'],tempo_assistido:['posts.items'],cliques_perfil:['account.profile_links_taps','account.reach'],[ACTION_KEY]:['account.'+ACTION_FIELD,'account.reach'],conversas_inbox:['inbox.unique_conversations','account.reach']};
    for(const [id,a] of Object.entries(b.axes)){
      scores[id]={score:a.score===null?null:Math.round(a.score),measured:a.measured,total:3,partial:a.partial};
      for(const m of a.components){const issue={path:fields[m.key][0],input_fields:fields[m.key],metric:id+'.'+m.key,label:AXES[id].name+' · '+m.label,status:m.quality,reason:m.record.reason};if(m.raw===null)missing.push(issue);else if(m.quality!=='measured')limited.push(issue);}
    }return{revision:METHOD,measured:9-missing.length,total:9,complete:!b.partial,missing,limited,scores};
  }
  function example(){
    const d=emptyReport('@perfil.exemplo','2026-08-01','2026-08-30');d.account_id='conta-ficticia';d.collected_at='2026-09-01T12:00:00Z';d.coverage=['Dados fictícios para demonstrar as métricas nativas.'];
    for(const r of [d.account,d.posts,d.inbox])Object.assign(r,{account_id:d.account_id,status:'complete',source:'Demonstração fictícia, sem consultar contas.',reason:''});
    Object.assign(d.account,{reach:12000,followers_count:5000,followers_updated_at:d.collected_at,profile_links_taps:90,[ACTION_FIELD]:V4?750:75});d.inbox.unique_conversations=120;
    d.posts.expected_count=3;d.posts.items=Array.from({length:3},(_,i)=>({id:'exemplo-'+i,published_at:'2026-08-10T12:00:00Z',last_updated:d.collected_at,media_product_type:'REELS',reach:1000,likes:40,comments:8,shares:8,saves:15,ig_reels_avg_watch_time_ms:15000,video_duration_seconds:30}));return d;
  }
  return{METHOD,AXES,SHORT_LABELS,IDEAL_SCORE,initialReference,validateReference,emptyInitialReport:emptyReport,initialExample:example,initialDashboard:dashboard,validate,normalize,inspect};
  }
  const current=create('ecf-zernio-v4'),previous=create('ecf-zernio-v3');
  current.V3=previous;
  current.forMethod=method=>method===current.METHOD?current:method===previous.METHOD?previous:null;
  current.upgrade=function(data){
    if(data.method===current.METHOD)return JSON.parse(JSON.stringify(current.validate(data)));
    previous.validate(data);
    const result=JSON.parse(JSON.stringify(data));result.method=current.METHOD;
    delete result.account.follows;result.account.accounts_engaged=null;
    delete result.reference.targets.founder.novos_seguidores;
    result.reference.targets.founder.contas_engajadas=current.initialReference().targets.founder.contas_engajadas;
    result.reference.label='ECF Zernio v4 · régua migrada';
    if(result.account.status!=='missing')result.account.status='partial';
    result.account.reason=result.account.reason||'Falta accounts_engaged nativo da mesma conta e janela; seguidores não são convertidos em contas engajadas.';
    if(result.coverage.length<40)result.coverage.push('Migração v3 para v4: demais campos preservados; contas engajadas aguardam a fonte nativa. A escala Founder mudou.');
    return current.validate(result);
  };
  return current;
});
