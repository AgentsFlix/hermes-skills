(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const axes={creator:{name:'Creator',coin:'Atenção',promise:'As pessoas certas chegam.'},expert:{name:'Expert',coin:'Autoridade',promise:'Elas reconhecem seu valor.'},founder:{name:'Founder',coin:'Ação',promise:'Elas dão o próximo passo.'}};
  const scenarios={
    harmony:{levels:[76,76,76],labels:['Em harmonia','Em harmonia','Em harmonia'],title:'As três moedas circulam.',text:'Você é notado, demonstra o que sabe e cria um caminho para agir.'},
    clown:{levels:[92,20,12],labels:['Alta','Baixa','Baixa'],title:'Doença do palhaço de circo',text:'Todo mundo aplaude. Mas pouca gente te reconhece como alguém que resolve um problema ou considera comprar de você.'},
    wizard:{levels:[20,92,12],labels:['Baixa','Alta','Baixa'],title:'Doença do mestre dos magos',text:'Pouca gente chega. Quem chega te ouve com atenção. Só que você aparece, ensina e some sem convidar para uma próxima ação.'},
    sales:{levels:[20,16,92],labels:['Baixa','Baixa','Alta'],title:'Doença do telemarketing',text:'Oferta, direct, link, CTA. Sem atenção, falta demanda. Sem autoridade, falta confiança. Vender vira força bruta.'}
  };
  const treatments={
    clown:{focus:'Expert',title:'Transforme o aplauso em confiança.',steps:[['Mostre seu raciocínio','Quadro Branco','Explique como você resolve um problema.'],['Demonstre seu critério','Comparativo','Compare caminhos e mostre por que escolheu um.']],next:'Depois, conecte essa prova a um convite claro.'},
    wizard:{focus:'Creator + Founder',title:'Apareça mais. Dê um próximo passo.',steps:[['Traga gente nova','Storytelling','Conte uma situação em que o público se reconheça.'],['Abra uma conversa','Falando com a Câmera','Convide quem tem esse problema a conversar.']],next:'Continue ensinando. Acrescente descoberta e convite.'},
    sales:{focus:'Creator + Expert',title:'Construa interesse antes da oferta.',steps:[['Entre na conversa','React com ponto de vista','Parta de um assunto que já importa para o público.'],['Dê uma razão para confiar','Estudo de Caso','Explique um caso real e o raciocínio por trás da solução.']],next:'Depois, a oferta encontra atenção e confiança.'}
  };
  const formatSets={
    creator:{heading:'Faça a pessoa pensar: “isso é pra mim”.',formats:[
      {name:'Storytelling',kind:'reel',visual:'<div class="demo-video"><span class="video-top">● ● ●</span><strong>Eu também<br>já passei por isso.</strong><span class="video-bottom">▷ <i></i></span></div>',caption:'Uma história real com tensão e aprendizado.'},
      {name:'React',kind:'reaction',visual:'<div class="react-original"><span class="play-glyph">▷</span>Trecho original</div><span class="react-plus">+</span><div class="react-reading">Minha leitura<i></i><i></i></div>',caption:'Use um assunto relevante e acrescente sua leitura.'},
      {name:'Tela Verde',kind:'source',visual:'<div class="source-window"><span>O fato</span><i></i><i></i><i></i></div><div class="source-comment">▷<span>Seu olhar</span></div>',caption:'Mostre a fonte e explique o detalhe que importa.'}]},
    expert:{heading:'Mostre como você pensa e resolve.',formats:[
      {name:'Quadro Branco',kind:'diagram',visual:'<span>Problema</span><b>→</b><span>Critério</span><b>→</b><span>Decisão</span>',caption:'Desenhe o raciocínio por trás de uma decisão.'},
      {name:'Carrossel educativo',kind:'carousel',visual:'<span><b>01</b>O erro</span><span><b>02</b>O porquê</span><span><b>03</b>Como resolver</span>',caption:'Ensine um caminho em passos que mereçam ser salvos.'},
      {name:'Comparativo',kind:'comparison',visual:'<table><thead><tr><th>Critério</th><th>A</th><th>B</th></tr></thead><tbody><tr><th>Quando usar</th><td>?</td><td>?</td></tr><tr><th>Limites</th><td>?</td><td>?</td></tr></tbody></table>',caption:'Julgue alternativas pelos mesmos critérios.'}]},
    founder:{heading:'Mostre o que você constrói. Abra o caminho.',formats:[
      {name:'Bastidores',kind:'diagram',visual:'<span>Decisão</span><b>→</b><span>Execução</span><b>→</b><span>Entrega</span>',caption:'Mostre um processo real e o valor que ele entrega.'},
      {name:'Estudo de Caso',kind:'case',visual:'<span>Antes</span><b>O que eu fiz</b><span>Depois</span>',caption:'Apresente um resultado verificável e como chegou a ele.'},
      {name:'Falando com a Câmera',kind:'invitation',visual:'Para quem é?<span>Como posso ajudar?</span><b>Vamos conversar?</b>',caption:'Faça um convite específico, com um próximo passo claro.'}]}
  };
  function card(id,index,level,label,context,selectable=false){
    const a=axes[id],tag=selectable?'button':'article';
    return `<${tag} class="learning-card" ${selectable?`type="button" data-content-axis="${id}" aria-pressed="${label==='Fortalecer'}"`:`aria-labelledby="${context}-${id}"`}><div class="learning-card-heading"><span>0${index+1} / ${a.coin.toUpperCase()}</span><h3 id="${context}-${id}">${a.name}</h3></div><div class="learning-art" aria-hidden="true">${$('art-'+id).innerHTML}</div><p>${a.promise}</p><div class="learning-bar-label"><span>${a.coin}</span><b>${label}</b></div><div class="learning-bar" role="img" aria-label="${a.coin}: ${label.toLowerCase()}, exemplo ilustrativo"><span style="width:${level}%"></span></div></${tag}>`;
  }
  function cards(s,context){return Object.keys(axes).map((id,i)=>card(id,i,s.levels[i],s.labels[i],context)).join('');}
  function scenario(id){
    const s=scenarios[id];if(!s)return;
    document.querySelectorAll('[data-scenario]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scenario===id)));
    $('scenario-cards').innerHTML=cards(s,'scenario');
    $('scenario-reading').innerHTML=`<div><span>${id==='harmony'?'EQUILÍBRIO':'QUANDO UMA MOEDA DOMINA'}</span><h2>${s.title}</h2></div><p>${s.text}</p>`;
  }
  function formats(id,focus=false){
    if(!axes[id])return;
    const f=formatSets[id];
    $('content-axes').innerHTML=Object.keys(axes).map((a,i)=>card(a,i,a===id?80:35,a===id?'Fortalecer':'Manter','content',true)).join('');
    $('format-heading').innerHTML=`<span class="eyebrow">CONTEÚDO ${axes[id].name.toUpperCase()}</span><h2>${f.heading}</h2>`;
    $('format-cards').innerHTML=f.formats.map((item,i)=>`<article class="format-card"><header><span>0${i+1}</span><h3>${item.name}</h3></header><div class="format-preview preview-${item.kind}">${item.visual}</div><p>${item.caption}</p></article>`).join('');
    if(focus)$('content-axes').querySelector('[data-content-axis="'+id+'"]').focus({preventScroll:true});
  }
  function treatment(id){
    const t=treatments[id];if(!t)return;
    document.querySelectorAll('[data-treatment]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.treatment===id)));
    $('treatment-cards').innerHTML=cards(scenarios[id],'treatment');
    $('treatment-plan').innerHTML=`<div class="treatment-prescription"><span class="eyebrow">PRIORIDADE: ${t.focus.toUpperCase()}</span><h3>${t.title}</h3></div><div class="prescription-steps">${t.steps.map((s,i)=>`<div><span>0${i+1} / ${s[0]}</span><h4>${s[1]}</h4><p>${s[2]}</p></div>`).join('')}</div><p class="prescription-next">${t.next}</p>`;
  }
  function lesson(n,move=true){
    if(!Number.isInteger(n)||n<0||n>3)return;
    document.querySelectorAll('[data-lesson-page]').forEach((p,i)=>p.hidden=i!==n);
    document.querySelectorAll('[data-lesson]').forEach(b=>{if(Number(b.dataset.lesson)===n)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
    if(move){history.replaceState(null,'','#metodo-'+(n+1));document.querySelector('[data-lesson-page="'+n+'"] h1').focus({preventScroll:true});$('understand').scrollIntoView({block:'start',behavior:'instant'});}
  }
  document.querySelectorAll('[data-lesson],[data-lesson-go]').forEach(b=>b.addEventListener('click',()=>lesson(Number(b.dataset.lesson??b.dataset.lessonGo))));
  document.querySelectorAll('[data-scenario]').forEach(b=>b.addEventListener('click',()=>scenario(b.dataset.scenario)));
  document.querySelectorAll('[data-treatment]').forEach(b=>b.addEventListener('click',()=>treatment(b.dataset.treatment)));
  $('content-axes').addEventListener('click',e=>{const button=e.target.closest('[data-content-axis]');if(button)formats(button.dataset.contentAxis,true);});
  const photo=$('method-photo');
  document.querySelectorAll('[data-photo]').forEach(b=>b.addEventListener('click',()=>{$('method-photo-title').textContent=b.dataset.photoTitle;$('method-photo-image').src=b.dataset.photo;$('method-photo-image').alt=b.querySelector('img').alt;photo.showModal();}));
  $('close-method-photo').addEventListener('click',()=>photo.close());
  photo.addEventListener('click',e=>{if(e.target===photo){const r=photo.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)photo.close();}});
  scenario('harmony');formats('creator');treatment('clown');
  const hash=/^#metodo-([1-4])$/.exec(location.hash);lesson(hash?Number(hash[1])-1:0,false);
})();
