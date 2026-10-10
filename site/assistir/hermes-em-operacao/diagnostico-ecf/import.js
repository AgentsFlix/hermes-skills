/* The same import and delivery checks run locally in the page and in Hermes. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(module.exports);
  else root.ECFImport=factory(root.ECF);
})(typeof globalThis!=='undefined'?globalThis:this,function(M){
  'use strict';
  const REVISION='ecf-contract-1';
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const object=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
  const fail=(path,message)=>{throw Error(path+': '+message);};
  const keys=(o,fields,path)=>{
    if(!object(o))fail(path,'use um objeto.');
    if(Object.keys(o).some(k=>!fields.includes(k)))fail(path,'há campos fora do contrato; use somente os campos do modelo.');
    for(const k of fields)if(!own(o,k))fail(path+'.'+k,'campo obrigatório ausente.');
  };
  // JSON.parse alone silently accepts duplicate keys. Reject them before parsing.
  function parse(raw){
    let i=0;
    const ws=()=>{while(/[\x20\t\r\n]/.test(raw[i]||'x'))i++;};
    const bad=()=>fail('JSON','sintaxe inválida; use aspas duplas, sem comentários ou vírgulas finais.');
    function string(){
      const start=i++;while(i<raw.length){if(raw[i]==='\\'){i+=2;continue;}if(raw[i++]==='"'){try{return JSON.parse(raw.slice(start,i));}catch(_){bad();}}}bad();
    }
    function value(depth){
      if(depth>30)fail('JSON','estrutura profunda demais para o resumo.');
      ws();const c=raw[i];
      if(c==='"'){string();return;}
      if(c==='{'||c==='['){
        const obj=c==='{',end=obj?'}':']',seen=new Set();i++;ws();if(raw[i]===end){i++;return;}
        for(;;){
          if(obj){if(raw[i]!=='"')bad();const key=string();if(seen.has(key))fail('JSON','chave duplicada; remova a ambiguidade antes de importar.');seen.add(key);ws();if(raw[i++]!==':')bad();}
          value(depth+1);ws();if(raw[i]===end){i++;return;}if(raw[i++]!==',')bad();ws();
        }
      }
      const token=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(raw.slice(i));if(!token)bad();i+=token[0].length;
    }
    value(0);ws();if(i!==raw.length)bad();return JSON.parse(raw);
  }
  function strict(d){
    keys(d,['method','profile','window','collected_at','reference','credential_resolution','coverage','axes'],'relatório');
    keys(d.window,['start','end'],'window');
    keys(d.reference,['label','ideal_score','targets'],'reference');
    keys(d.reference.targets,Object.keys(M.AXES),'reference.targets');
    keys(d.axes,Object.keys(M.AXES),'axes');
    for(const [id,a] of Object.entries(M.AXES)){
      keys(d.reference.targets[id],a.metrics.map(([k])=>k),'reference.targets.'+id);
      keys(d.axes[id],['note','metrics'],'axes.'+id);
      keys(d.axes[id].metrics,a.metrics.map(([k])=>k),'axes.'+id+'.metrics');
      for(const [key] of a.metrics){
        const p='axes.'+id+'.metrics.'+key,m=d.axes[id].metrics[key];
        keys(m,['numerator','denominator','samples','status','scope','source','evidence','reason'],p);
        for(const f of ['numerator','denominator'])if(m[f]!==null&&!(typeof m[f]==='number'&&Number.isFinite(m[f])&&m[f]>=0))fail(p+'.'+f,'use número não negativo ou null, sem percentual nem separador de milhar.');
        if(!Array.isArray(m.samples)||m.samples.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0))fail(p+'.samples','use uma lista de razões decimais não negativas.');
        if(!['measured','partial','estimated','missing'].includes(m.status))fail(p+'.status','use measured, partial, estimated ou missing.');
        for(const f of ['scope','source','reason'])if(typeof m[f]!=='string')fail(p+'.'+f,'use texto.');
        if(!Array.isArray(m.evidence))fail(p+'.evidence','use uma lista de referências anônimas.');
        if(m.status!=='measured'&&!m.reason.trim())fail(p+'.reason','explique a lacuna, limitação ou estimativa.');
        if(m.status==='missing'){
          if(m.numerator!==null||m.denominator!==null||m.samples.length)fail(p,'missing exige numerator e denominator null e samples vazio; mantenha medidas incompletas nos artefatos privados.');
          continue;
        }
        if(key==='alcance_relativo'){
          if(!m.samples.length||m.numerator!==null||m.denominator!==null)fail(p,'preencha samples com alcance/base por post; numerator e denominator ficam null.');
        }else{
          if(m.numerator===null)fail(p+'.numerator','informe eventos medidos, incluindo zero real, ou use status missing.');
          for(const f of ['numerator','denominator'])if(m[f]!==null&&!Number.isSafeInteger(m[f]))fail(p+'.'+f,'contagens precisam ser números inteiros seguros, sem casas decimais.');
          if(!(m.denominator>0))fail(p+'.denominator','informe o denominador positivo do mesmo conjunto ou use status missing.');
          if(m.samples.length)fail(p+'.samples','esta variável usa numerator/denominator; samples deve ficar vazio.');
        }
        if(!m.source.trim())fail(p+'.source','informe a origem da medição.');
        if(!m.scope.trim())fail(p+'.scope','identifique o conjunto, período e denominador da medição.');
        if(!d.collected_at)fail('collected_at','medições precisam da data e hora da coleta.');
        if(m.status==='measured'&&!m.evidence.length)fail(p+'.evidence','informe evidências ou marque partial com motivo.');
        if(key==='reconhecimento'&&m.denominator<10&&m.status==='measured')fail(p+'.status','menos de 10 respostas exige partial e motivo.');
      }
    }
    if(!Array.isArray(d.coverage)||d.coverage.some(x=>typeof x!=='string'))fail('coverage','use uma lista de textos curtos.');
    M.validate(d);
  }
  function normalizeNumbers(d,changes){
    const convert=(o,k,path)=>{
      if(!object(o)&&!Array.isArray(o))return;
      const n=o[k];
      if(typeof n==='string'&&/^(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(n.trim())&&Number.isFinite(Number(n))){o[k]=Number(n);changes.push(path+': texto numérico convertido em número.');}
    };
    for(const [id,a] of Object.entries(M.AXES))for(const [key] of a.metrics){
      const p='axes.'+id+'.metrics.'+key,m=d?.axes?.[id]?.metrics?.[key];
      for(const f of ['numerator','denominator','target'])convert(m,f,p+'.'+f);
      if(Array.isArray(m?.samples))m.samples.forEach((_,i)=>convert(m.samples,i,p+'.samples['+i+']'));
      convert(d?.reference?.targets?.[id],key,'reference.targets.'+id+'.'+key);
    }
  }
  function canonical(d){
    if(d.method===M.INITIAL_METHOD)return JSON.parse(JSON.stringify(d));
    const board=M.initialDashboard(d),out=M.emptyInitialReport(d.profile,d.window.start,d.window.end);
    out.collected_at=d.collected_at;out.coverage=d.coverage.map(M.coverageText);out.credential_resolution=d.credential_resolution||null;
    for(const [id,a] of Object.entries(board.axes)){
      out.axes[id].note=a.note;
      for(const c of a.components){
        const m=out.axes[id].metrics[c.key],old=c.record;
        Object.assign(m,{source:old.source,scope:c.scope,reason:old.reason,evidence:old.evidence.slice(0,20)});
        if(c.raw===null){m.reason=m.reason||'Arquivo anterior sem valores, origem ou denominador compatível.';continue;}
        Object.assign(m,{numerator:old.numerator,denominator:old.denominator,samples:old.samples,status:c.quality});
        if(c.key==='alcance_relativo'){m.numerator=null;m.denominator=null;}else m.samples=[];
        if(!m.scope.trim())m.scope='Conjunto registrado no arquivo anterior; descrição incompleta.';
        // Missing context or a small survey cannot become a fully measured result.
        if(!c.scope?.trim()||!m.evidence.length||(c.key==='reconhecimento'&&m.denominator<10))m.status='partial';
        if(m.status!=='measured')m.reason=m.reason||'Arquivo anterior com cobertura ou evidência parcial.';
      }
    }
    return out;
  }
  function inspect(d){
    const board=M.initialDashboard(d),missing=[],limited=[];
    for(const [id,a] of Object.entries(board.axes))for(const c of a.components){
      const item={path:'axes.'+id+'.metrics.'+c.key,label:M.AXES[id].name+' · '+c.label,status:c.quality,reason:c.record.reason};
      if(c.raw===null)missing.push(item);else if(c.quality!=='measured')limited.push(item);
    }
    const scores=Object.fromEntries(Object.entries(board.axes).map(([id,a])=>[id,{score:a.score===null?null:Math.round(a.score),measured:a.measured,total:3,partial:a.partial}]));
    return {revision:REVISION,measured:9-missing.length,total:9,complete:!board.partial,missing,limited,scores};
  }
  function read(raw,expected){
    if(typeof raw!=='string'||new TextEncoder().encode(raw).length>200000)fail('JSON','use o resumo de até 200 KB.');
    const changes=[];let clean=raw.trim();
    if(raw.charCodeAt(0)===0xfeff)changes.push('Marca BOM removida.');
    const fence=/^```(?:json)?\s*\n([\s\S]*?)\n```$/.exec(clean);
    if(fence){clean=fence[1];changes.push('Marcas do bloco JSON removidas.');}
    const source=parse(clean);
    if(M.Native?.forMethod(source?.method)){
      const N=M.Native.forMethod(source.method);N.normalize(source,changes);N.validate(source);
      if(expected){
        N.validate(expected);
        if(source.profile.replace(/^@/,'').toLowerCase()!==expected.profile.replace(/^@/,'').toLowerCase()||source.window.start!==expected.window.start||source.window.end!==expected.window.end||(expected.account_id!==null&&source.account_id!==expected.account_id))fail('contrato','perfil, conta ou período diferente do pedido.');
        if(source.reference.label!==expected.reference.label)fail('reference','preserve a régua do pedido.');
        for(const [id,a] of Object.entries(N.AXES))for(const [k] of a.metrics)if(source.reference.targets[id][k]!==expected.reference.targets[id][k])fail('reference.targets.'+id+'.'+k,'preserve o ideal do pedido.');
      }
      const data=JSON.parse(JSON.stringify(source));
      return{source,data,audit:{...N.inspect(data),changes,legacy:false}};
    }
    normalizeNumbers(source,changes);
    if(source?.method===M.INITIAL_METHOD)strict(source);else M.validate(source);
    const data=canonical(source);strict(data);
    if(expected){
      strict(expected);
      if(data.method!==expected.method||data.profile.replace(/^@/,'').toLowerCase()!==expected.profile.replace(/^@/,'').toLowerCase()||data.window.start!==expected.window.start||data.window.end!==expected.window.end)fail('contrato','perfil ou período diferente do pedido.');
      if(data.reference.label!==expected.reference.label)fail('reference','preserve a régua do pedido.');
      for(const [id,a] of Object.entries(M.AXES))for(const [k] of a.metrics)if(data.reference.targets[id][k]!==expected.reference.targets[id][k])fail('reference.targets.'+id+'.'+k,'preserve o ideal do pedido.');
    }
    if(source.method!==data.method)changes.push('Contrato v1 convertido para v2; indicadores em texto não viram medições.');
    return {source,data,audit:{...inspect(data),changes,legacy:source.method!==data.method}};
  }
  return {REVISION,read,inspect,strict};
});
