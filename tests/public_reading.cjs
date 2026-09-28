const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('site/index.html', 'utf8');
const registry = JSON.parse(fs.readFileSync('site/leitura/manifest.json')).readings.map(x => x.slug);
const registered = new Set([...registry, 'futura-leitura']);
const method = name => {
  const match = source.match(new RegExp('^  function ' + name + '\\([^]*?^  }', 'm'));
  assert(match, name); return match[0];
};
const access = source.match(/^  const isReading = .+;$/m)[0] + '\n' + source.match(/^  const canOpenCard = .+;$/m)[0];
function context() {
  const writes = [], mounted = [], installed = [], opened = [];
  const storage = new Map();
  const by = Object.create(null);
  for (const slug of [...registered, 'skill-sem-leitura']) by[slug] = {
    slug, cat:'base', proc:'método', req:'nenhuma', title:slug, name:slug, sub:'Texto aprovado',
    badge:'BASE', syn:'Sinopse aprovada', how:'Uso aprovado', cast:[], gen:[], traits:[], n:1
  };
  const modal = {hidden:true, innerHTML:'', querySelector:()=>({})};
  const c = {BY:by, state:{view:'catalog',open:null}, DISCOVERY:{completed:false,catalogAvailable:false,
    locked:()=>false, cancel(){}, gate:()=>'<section>PRÉ-REQUISITO</section>',
    bind:()=>installed.push('bind'), installation:()=>'<button>MARCAR</button>',
    installationButton:()=>'<button>MARCAR</button>', context:()=>'',extras:()=>''},
    window:{AgentFlixReader:{supports:slug=>registered.has(slug),unmount(){},mount:(_,slug)=>mounted.push(slug)},clar(){}},
    document:{activeElement:{},body:{style:{}},querySelector:()=>null},
    sessionStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>{storage.set(key,value);writes.push([key,value]);},removeItem:key=>storage.delete(key)},
    location:{hash:'',pathname:'/',search:''},history:{replaceState(){}},
    pvCard:null,lastFocus:null,hidePreview(){},track(){},updateInert(){},measureSynopsis(){},requestAnimationFrame(){},
    $:()=>modal,esc:String,CATS:{base:{chip:'Base'}},coverImg:()=>'<img>',listLabel:()=>'+ Minha lista',exclusiveHtml:()=>'',
    installHtml:()=>{installed.push('installer');return 'COMANDO ORIGINAL';},
    renderModal(){},setCatalogView:view=>{c.state.view=view;},resumeDiscovery:()=>{c.state.view='catalog';},
    openModal:slug=>opened.push(slug),focusSkill:()=>opened.push('skill-tab')
  };
  vm.createContext(c);
  vm.runInContext(access, c);
  return {c,modal,writes,mounted,installed,opened,storage};
}
// Every registered reading, including a future one, opens without onboarding.
for (const slug of registered) {
  const {c,writes}=context(); vm.runInContext(method('openModal'),c); c.openModal(slug);
  assert.equal(c.state.open,slug);assert.equal(c.state.view,'reading');assert.equal(c.DISCOVERY.completed,false);assert.equal(writes.length,0);
}
for (const slug of ['skill-sem-leitura','constructor','slug-inexistente']) {
  const {c}=context();vm.runInContext(method('openModal'),c);c.openModal(slug);assert.equal(c.state.open,null);
}
// Gates belong to the skill tab. No installer, installed control or binding is rendered early.
for (const completed of [false,true]) for (const catalogAvailable of [false,true]) for (const locked of [false,true]) {
  const {c,modal,mounted,installed}=context();c.state.open=registry[0];
  c.DISCOVERY.completed=completed;c.DISCOVERY.catalogAvailable=catalogAvailable;c.DISCOVERY.locked=()=>locked;
  vm.runInContext(method('renderModal'),c);c.renderModal();
  assert.deepEqual(mounted,[registry[0]]);assert(modal.innerHTML.includes('has-human-reader'));
  assert.equal(installed.length>0,catalogAvailable&&!locked);
  assert.equal(modal.innerHTML.includes('COMANDO ORIGINAL'),catalogAvailable&&!locked);
  assert.equal(modal.innerHTML.includes('MARCAR'),catalogAvailable&&!locked);
  assert.equal(modal.innerHTML.includes('reading-onboarding'),!catalogAvailable);
  assert.equal(modal.innerHTML.includes('PRÉ-REQUISITO'),catalogAvailable&&locked);
}
{
  const {c,modal,mounted,installed}=context();c.state.open='skill-sem-leitura';c.DISCOVERY.catalogAvailable=true;c.DISCOVERY.locked=()=>true;
  vm.runInContext(method('renderModal'),c);c.renderModal();assert.equal(mounted.length,0);assert.equal(installed.length,0);assert(modal.innerHTML.includes('PRÉ-REQUISITO'));
}
// The explicit handoff survives reload and is consumed only on completion.
{
  const {c,writes,storage,opened}=context();
  vm.runInContext('const pendingReadingKey="agentflix-reading-skill";let pendingReadingSkill="";'+method('startReadingOnboarding')+method('resumeReadingSkill'),c);
  c.startReadingOnboarding(registry[0]);assert.equal(writes.length,1);assert.equal(c.DISCOVERY.completed,false);
  assert.equal(c.resumeReadingSkill(),false);assert.equal(storage.size,1);
  vm.runInContext('pendingReadingSkill=""',c);c.DISCOVERY.catalogAvailable=true;
  assert.equal(c.resumeReadingSkill(),true);assert.deepEqual(opened,[registry[0],'skill-tab']);assert.equal(storage.size,0);
  assert.equal(c.resumeReadingSkill(),false);
  storage.set('agentflix-reading-skill','skill-sem-leitura');assert.equal(c.resumeReadingSkill(),false);
}
// Even when storage is unavailable, the current reading can hand off to the guide.
{
  const {c,opened}=context();c.sessionStorage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}};
  vm.runInContext('const pendingReadingKey="agentflix-reading-skill";let pendingReadingSkill="";'+method('startReadingOnboarding')+method('resumeReadingSkill'),c);
  c.startReadingOnboarding(registry[0]);c.DISCOVERY.catalogAvailable=true;assert.equal(c.resumeReadingSkill(),true);assert.deepEqual(opened,[registry[0],'skill-tab']);
}
// Enter on the free-reading link must not trigger the intro's global shortcut.
{
  const {c}=context(); const calls=[];c.introPhase='gate';c.playIntro=()=>calls.push('intro');
  const body=source.split('document.addEventListener("keydown", (e) => {\n    if (e.defaultPrevented) return;')[1].split('\n  });')[0];
  const handler=vm.runInContext('(e)=>{'+body+'}',c);
  const event=reading=>({key:'Enter',target:{closest:()=>reading,matches:()=>false},preventDefault:()=>calls.push('prevent')});
  handler(event(true));assert.deepEqual(calls,[]);
  handler(event(false));assert.deepEqual(calls,['prevent','intro']);
}
// Boot must not display an opening animation or mark it seen: the loader only follows catalog readiness.
(async()=>{
  const boot = method('startHome');
  for (const view of ['reading','catalog']) for (const signedIn of [false,true]) {
    const writes=[],intros=[],catalogCalls=[],accountStates=[];
    const c={CATALOG_URLS:['catalog.json'],DISCOVERY_DATA:null,state:{view},
      AbortController,AbortSignal,homeBoot:null,homeReadyResolve:null,homeReadyReject:null,homeSuccessful:false,
      fetch:async()=>({ok:true,json:async()=>({skills:[]})}),
      window:{AgentFlixHome:{ready:null},AgentFlixMemory:{start:async()=>({signedIn})},AgentFlixReader:{catalogSkills:async s=>s},matchMedia:()=>({matches:false})},
      sessionStorage:{getItem:()=>null,setItem:(...args)=>writes.push(args)},
      loadCatalog:(catalog,authenticated)=>catalogCalls.push(authenticated),renderAccountStatus:value=>accountStates.push(value),initShop(){},playIntro:()=>intros.push(true),showLoadError:message=>{throw Error(message);},console};
    vm.createContext(c);vm.runInContext(boot+'\nstartHome();',c);await c.window.AgentFlixHome.ready;
    assert.equal(intros.length,0);assert.equal(writes.length,0);
    assert.deepEqual(catalogCalls,[signedIn]);
    assert.deepEqual(accountStates,[signedIn]);
  }
  console.log('PASS leitura pública: registro, acesso, instalador, pré-requisitos, retorno, recarga e abertura');
})().catch(error=>{console.error(error);process.exitCode=1;});
