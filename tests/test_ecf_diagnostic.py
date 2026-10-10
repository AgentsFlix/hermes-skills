"""Behavioral checks for the ECF summary contract and score calculations."""
import pathlib
import shutil
import subprocess
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]


class ECFDiagnosticTests(unittest.TestCase):
    @unittest.skipUnless(shutil.which('node'), 'Node is required for browser model checks')
    def test_score_contract_and_missing_data(self):
        script = r"""
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const box={module:{exports:{}}};
vm.runInNewContext(fs.readFileSync('site/assistir/hermes-em-operacao/diagnostico-ecf/model.js','utf8'),box);
const M=box.module.exports;
const score=d=>M.calculate(d), make=()=>M.example();
let d=make(), r=score(d);
assert.equal(r.creator.score,77);
assert(Math.abs(r.expert.score-45)<1e-8);
assert.equal(r.founder.score,25);
assert.equal(r.creator.status,'Operacional');
assert.equal(r.founder.status,'Operacional');
// Unknown is not zero; all original weights remain mandatory.
d=make();d.axes.creator.metrics.seguidores.numerator=null;
assert.equal(score(d).creator.score,null);
d=make();d.axes.creator.metrics.seguidores.numerator=0;
assert.equal(score(d).creator.score,50.75);
// No denominator substitution, and zero reach cannot produce a rate.
d=make();d.axes.expert.metrics.autoridade.denominator=20000;
assert.equal(score(d).expert.score,null);
d=make();d.axes.expert.metrics.autoridade.denominator=0;
assert.equal(score(d).expert.score,null);
// Targets must be positive, sourced, and frozen before the evaluated cycle.
for(const change of [{target:null},{target:0},{target_source:''},{target_fixed_at:'2026-08-02'},{target_fixed_at:null}]) {
 d=make();Object.assign(d.axes.creator.metrics.compartilhamentos,change);assert.equal(score(d).creator.score,null);
}
// No provenance, incomplete collection, or incomparable snapshots: no full score.
for(const change of [{source:''},{evidence:[]}]) {
 d=make();Object.assign(d.axes.expert.metrics.salvamentos,change);assert.equal(score(d).expert.score,null);
}
for(const change of [{collection_complete:false},{comparable:false},{description:''}]) {
 d=make();Object.assign(d.axes.expert.cohort,change);assert.equal(score(d).expert.score,null);
}
d=make();d.collected_at=null;assert.equal(score(d).creator.score,null);
// Sample thresholds affect usability, without fabricating a ranking.
for(const n of [0,2,3,5,6]) {
 d=make();d.axes.expert.cohort.post_ids=d.axes.expert.cohort.post_ids.slice(0,n);r=score(d).expert;
 if(n<3) assert.equal(r.score,null);else assert.equal(r.status,n<6?'Provisório':'Operacional');
}
d=make();d.axes.founder.metrics.reconhecimento.denominator=9;
assert.equal(score(d).founder.status,'Provisório');
d=make();d.axes.founder.metrics.reconhecimento.numerator=11;
assert.throws(()=>score(d),/pessoas/);
// Relative reach uses a median per publication and stays visible above the cap.
d=make();d.axes.creator.metrics.alcance_relativo.samples=[0,0,1,1,10,10];
assert.equal(score(d).creator.components[0].raw,1);
d=make();d.axes.creator.metrics.alcance_relativo.samples=[2,2,2,2,2,2];
r=score(d).creator;assert.equal(r.components[0].raw,2);assert.equal(r.components[0].points,100);
d.axes.creator.metrics.alcance_relativo.samples.pop();assert.equal(score(d).creator.score,null);
// Empty reports can be imported to show actionable gaps, never a score.
d=M.emptyReport('@sem.dados','2026-08-01','2026-08-30');
for(const axis of Object.values(score(d)))assert.equal(axis.score,null);
// Malformed reports fail before rendering or calculations.
for(const change of [{method:'inventado'},{profile:'<script>'},{collected_at:'ontem'},{coverage:[{}]},{axes:null}]) {
 d=make();Object.assign(d,change);assert.throws(()=>score(d));
}
d=make();d.window.end='2026-08-29';assert.throws(()=>score(d),/30 dias/);
d=make();d.axes.creator.cohort.post_ids[1]=d.axes.creator.cohort.post_ids[0];assert.throws(()=>score(d),/únicos/);
d=make();d.axes.founder.cohort.post_ids[0]=d.axes.creator.cohort.post_ids[0];assert.throws(()=>score(d),/único eixo/);
d=make();d.axes.creator.metrics.seguidores.numerator=-1;assert.throws(()=>score(d));
d=make();d.axes.creator.metrics.seguidores.numerator='150';assert.throws(()=>score(d));
// An imported score or weight cannot override the method.
d=make();d.axes.creator.score=100;d.axes.creator.metrics.seguidores.weight=1;assert.equal(score(d).creator.score,77);
// Credential audit is optional for old reports and never changes the score.
assert.equal(M.emptyReport('@perfil','2026-08-01','2026-08-30').credential_resolution,null);
d=make();delete d.credential_resolution;assert.equal(score(d).creator.score,77);
for(const source of ['env','hermes_env','mcp','cli','sdk']) {
 for(const result of ['success','401','403','429','unavailable']) {
  d=make();d.credential_resolution={source,test_endpoint:'GET /v1/accounts',result};assert.equal(score(d).creator.score,77);
 }
}
d=make();d.credential_resolution={source:'unavailable',test_endpoint:'GET /v1/accounts',result:'unavailable'};assert.equal(score(d).creator.score,77);
for(const resolution of [
 {source:'cache',test_endpoint:'GET /v1/accounts',result:'success'},
 {source:'env',test_endpoint:'GET /v1/users',result:'success'},
 {source:'env',test_endpoint:'GET /v1/accounts',result:401},
 {source:'env',test_endpoint:'GET /v1/accounts',result:'inventado'},
 {source:'unavailable',test_endpoint:'GET /v1/accounts',result:'success'},
 {source:'env',result:'success'}, [], 'env', true
]) {d=make();d.credential_resolution=resolution;assert.throws(()=>score(d),/resolução de credencial/);}
// Reject extra properties without repeating their names or contents in the error.
for(const field of ['token','api_key','headers','unexpected']) {
 d=make();d.credential_resolution={source:'hermes_env',test_endpoint:'GET /v1/accounts',result:'success',[field]:'sensitive-test-marker'};
 assert.throws(()=>score(d),error=>/resolução de credencial/.test(error.message)&&!error.message.includes('sensitive-test-marker'));
}
// Structured legacy coverage is compatible without rendering endpoint arguments.
d=make();d.coverage=[{resource:'Comentários',reason:'Leitura parcial, classificação pendente.',pages:2,items:14,endpoint:'GET /example',parameters:'private-test-marker',status:{'200':2}}];
assert.equal(score(d).creator.score,77);
assert(!M.coverageText(d.coverage[0]).includes('private-test-marker'));
assert.match(M.coverageText(d.coverage[0]),/14 itens/);
for(const entry of [{}, {resource:'X',reason:'Y',token:'private-test-marker'}, {resource:'X',reason:'Y',items:-1}]) {
 d=make();d.coverage=[entry];assert.throws(()=>score(d));
}
// Contextual observations and editorial interpretation do not become weighted scores.
d=M.emptyReport('@baseline','2026-08-01','2026-08-30');d.collected_at='2026-09-01T12:00:00Z';
d.observations=[{label:'Compartilhamentos por alcance',numerator:15,denominator:1000,unit:'ratio',scope:'5 posts de idades diferentes',source:'Coleta fictícia',reason:'Sem coorte comparável'}];
d.axes.creator.analysis={summary:'Há compartilhamentos observados.',evidence:['15 eventos em 5 posts.'],limitations:['Sem metas prévias.'],next_step:'Completar a classificação.'};
assert.equal(M.observationValue(d.observations[0]),.015);
for(const axis of Object.values(score(d)))assert.equal(axis.score,null);
let o=d.observations[0];o.numerator=0;assert.equal(M.observationValue(o),0);score(d);
o.denominator=0;assert.equal(M.observationValue(o),null);score(d);
o.reason='';assert.throws(()=>score(d),/indicadores/);o.reason='Alcance indisponível';
o.numerator=null;assert.equal(M.observationValue(o),null);score(d);
o.numerator=-1;assert.throws(()=>score(d),/indicadores/);
d=make();d.observations=[{label:'Alcance',numerator:1000,denominator:null,unit:'count',scope:'Posts da janela',source:'Exemplo',reason:''}];
assert.equal(M.observationValue(d.observations[0]),1000);assert.equal(score(d).creator.score,77);
d.axes.creator.analysis={summary:'Conclusão sem evidência',evidence:[],limitations:[],next_step:''};assert.throws(()=>score(d),/evidências/);
// The initial ruler is a versioned proposal, independent from the old target method.
d=M.initialExample();let board=M.initialDashboard(d);
assert.equal(d.method,'ecf-inicial-v2');assert.equal(board.axes.creator.score,62);assert.equal(board.axes.expert.score,53);assert.equal(board.axes.founder.score,80);assert.equal(board.overall,65);assert.equal(board.partial,false);
assert.equal(M.calculate(d).creator.score,62);
// An ideal observation is 80; above the ideal can rise to the cap of 100.
d=M.initialExample();d.axes.creator.metrics.compartilhamentos.numerator=d.reference.targets.creator.compartilhamentos*d.axes.creator.metrics.compartilhamentos.denominator;
assert.equal(M.initialDashboard(d).axes.creator.components[2].points,80);
d.axes.creator.metrics.compartilhamentos.numerator*=10;assert.equal(M.initialDashboard(d).axes.creator.components[2].points,100);
// Zero is measured, but absent values are excluded visibly from an arithmetic mean.
d=M.initialExample();d.axes.creator.metrics.compartilhamentos.numerator=0;assert.equal(M.initialDashboard(d).axes.creator.components[2].points,0);
d.axes.creator.metrics.seguidores.status='missing';d.axes.creator.metrics.seguidores.reason='API sem campo';board=M.initialDashboard(d);
assert.equal(board.axes.creator.score,36);assert.equal(board.axes.creator.measured,2);assert.equal(board.axes.creator.partial,true);assert.equal(board.partial,true);
for(const m of Object.values(d.axes.founder.metrics)){m.status='missing';m.reason='Sem medição';}
board=M.initialDashboard(d);assert.equal(board.axes.founder.score,null);assert.equal(board.axesMeasured,2);assert.equal(board.overall,(36+53)/2);
d=M.emptyInitialReport('@sem.dados','2026-08-01','2026-08-30');assert.equal(M.initialDashboard(d).overall,null);
// Editing an ideal changes only its variable and the dependent averages.
d=M.initialExample();const ref=M.initialReference();ref.targets.expert.salvamentos*=2;board=M.initialDashboard(d,ref);
assert.equal(board.axes.expert.components[0].points,20);assert.equal(board.axes.creator.score,62);assert.equal(board.axes.expert.score,(20+64+55)/3);
assert.equal(d.reference.targets.expert.salvamentos,.02);
for(const change of [0,-1,null,'1',Infinity]){const ref=M.initialReference();ref.targets.creator.seguidores=change;assert.throws(()=>M.initialDashboard(d,ref),/ideal/);}
// Estimates and partial evidence keep scores visible with an explicit partial state.
for(const quality of ['partial','estimated']){d=M.initialExample();d.axes.creator.metrics.alcance_relativo.status=quality;d.axes.creator.metrics.alcance_relativo.reason='Base aproximada';assert.equal(M.initialDashboard(d).axes.creator.partial,true);}
d=M.initialExample();d.axes.creator.metrics.alcance_relativo.samples=[2,2,2];assert.equal(M.initialDashboard(d).axes.creator.components[0].points,100);
d=M.initialExample();d.axes.creator.metrics.seguidores.denominator=0;assert.equal(M.initialDashboard(d).axes.creator.components[1].points,null);
d=M.initialExample();d.axes.creator.metrics.seguidores.source='';assert.equal(M.initialDashboard(d).axes.creator.components[1].points,null);
d=M.initialExample();d.reference.ideal_score=100;assert.throws(()=>M.initialDashboard(d),/80 pontos/);
d=M.initialExample();d.axes.creator.metrics.seguidores.status='good';assert.throws(()=>M.initialDashboard(d));
d=M.initialExample();d.axes.founder.metrics.reconhecimento.numerator=d.axes.founder.metrics.reconhecimento.denominator+1;assert.throws(()=>M.initialDashboard(d),/pesquisa/);
d=M.initialExample();d.axes.founder.metrics.reconhecimento.numerator=1;d.axes.founder.metrics.reconhecimento.denominator=2;assert.equal(M.initialDashboard(d).axes.founder.partial,true);
// Legacy source records can be read against the new proposal without mutating the old scores.
d=make();const before=JSON.stringify(d);board=M.initialDashboard(d);assert.equal(JSON.stringify(d),before);assert.equal(score(d).creator.score,77);assert.equal(board.legacy,true);
d.axes.creator.cohort.comparable=false;assert(M.initialDashboard(d).axes.creator.score!==null);assert.equal(score(d).creator.score,null);
assert.throws(()=>M.initialDashboard(null));
console.log('ECF: cálculos, amostras, fontes, metas e lacunas verificados.');
"""
        subprocess.run([shutil.which('node'), '-e', script], cwd=ROOT, check=True)


    @unittest.skipUnless(shutil.which('node'), 'Node is required for shared import checks')
    def test_delivery_normalization_and_cli(self):
        script = r"""
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),cp=require('node:child_process');
const dir='site/assistir/hermes-em-operacao/diagnostico-ecf/',box={module:{exports:{}},TextEncoder};
vm.runInNewContext(fs.readFileSync(dir+'model.js','utf8'),box);const M=box.module.exports;
vm.runInNewContext(fs.readFileSync(dir+'import.js','utf8'),box);const I=box.module.exports;
const read=d=>I.read(JSON.stringify(d));
let d=M.initialExample(),result=read(d);assert.equal(result.audit.complete,true);assert.equal(result.audit.measured,9);
// Byte-order marks, Markdown fences, and canonical numeric strings are safe repairs.
d.axes.expert.metrics.salvamentos.numerator='400';
result=I.read('\ufeff```json\n'+JSON.stringify(d)+'\n```');
assert.equal(result.data.axes.expert.metrics.salvamentos.numerator,400);assert.equal(result.audit.changes.length,3);
assert.equal(d.axes.expert.metrics.salvamentos.numerator,'400');
for(const n of ['1,234','1.234,56','1.234','9007199254740993','1%','',false,[],{},-1]){d=M.initialExample();d.axes.expert.metrics.salvamentos.numerator=n;assert.throws(()=>read(d),/axes.expert.metrics.salvamentos.numerator/);}
for(const raw of ['{"method":"a","method":"b"}','{"a":1,"\\u0061":2}','[1,]','{"x":1,}','{"x":NaN}','Here is your JSON: {}','{}\n{}'])assert.throws(()=>I.read(raw));
// No guessing aliases, converting an unknown state to zero, or accepting false success.
for(const change of [{numerator:null},{denominator:0},{source:''},{scope:''},{evidence:[]},{status:'ready'},{status:'missing',reason:'Unavailable'}]){
 d=M.initialExample();Object.assign(d.axes.creator.metrics.seguidores,change);assert.throws(()=>read(d),/axes.creator.metrics.seguidores/);
}
d=M.initialExample();delete d.axes.expert.metrics.autoridade;assert.throws(()=>read(d),/axes.expert.metrics.autoridade/);
d=M.initialExample();d.axes.expert.metrics.conversas.score=100;assert.throws(()=>read(d),/campos fora/);
d=M.initialExample();d.axes.founder.metrics.reconhecimento.denominator=8;assert.throws(()=>read(d),/partial/);
d.axes.founder.metrics.reconhecimento.status='partial';d.axes.founder.metrics.reconhecimento.reason='Amostra pequena';assert.equal(read(d).audit.complete,false);
d=M.initialExample();d.axes.expert.metrics.conversas.numerator=0;assert.equal(read(d).data.axes.expert.metrics.conversas.numerator,0);assert.equal(read(d).audit.measured,9);
// Frozen request context: profile, window, and every ideal must match.
const expected=M.emptyInitialReport('@perfil.exemplo','2026-08-01','2026-08-30');
for(const change of [x=>x.profile='@outro',x=>x.window={start:'2026-07-01',end:'2026-07-30'},x=>x.reference.targets.creator.seguidores=.9]){d=M.initialExample();change(d);assert.throws(()=>I.read(JSON.stringify(d),expected));}
// Synthetic legacy file reproduces the 4/9 failure without private account data.
const legacy=M.emptyReport('@perfil.exemplo','2026-08-01','2026-08-30');legacy.collected_at='2026-09-01T12:00:00Z';
for(const [id,key,value] of [['creator','compartilhamentos',20],['expert','salvamentos',30],['expert','autoridade',2],['expert','conversas',0]]){
 legacy.axes[id].cohort.reach_total=1000;legacy.axes[id].cohort.description='Conjunto fictício';
 Object.assign(legacy.axes[id].metrics[key],{numerator:value,denominator:1000,source:'Exemplo fictício',reason:'Cobertura parcial'});
}
legacy.axes.founder.metrics.dms.reason='Há 23 conversas em lotes ainda sem deduplicação.';
legacy.observations=[{label:'DMs',numerator:23,denominator:null,unit:'count',scope:'Lotes sem deduplicação',source:'Exemplo',reason:'Não é total único'}];
result=read(legacy);assert.equal(result.audit.measured,4);assert.equal(result.audit.missing.length,5);assert.equal(result.data.axes.founder.metrics.dms.numerator,null);assert.equal(result.data.axes.expert.metrics.conversas.numerator,0);
assert.equal(result.data.method,'ecf-inicial-v2');assert.equal(read(result.data).audit.measured,4);assert.equal(legacy.method,'ecf-metas-v1');
for(const id of ['creator','expert','founder'])assert.equal(M.initialDashboard(result.data).axes[id].score,M.initialDashboard(legacy).axes[id].score);
legacy.axes.expert.metrics.autoridade.denominator=2000;assert.equal(read(legacy).data.axes.expert.metrics.autoridade.status,'missing');
// CLI assembled exactly as the prompt assembles it: shared code, no external dependency.
const temp=process.argv[1],cli=path.join(temp,'validar-ecf.cjs'),input=path.join(temp,'draft.json'),contract=path.join(temp,'contract.json'),out=path.join(temp,'result.json');
fs.writeFileSync(cli,['model.js','import.js','validator-cli.cjs'].map(f=>fs.readFileSync(dir+f,'utf8')).join('\n'));
fs.writeFileSync(contract,JSON.stringify(expected));
const run=()=>cp.spawnSync(process.execPath,[cli,input,'--contract',contract,'--output',out],{encoding:'utf8'});
fs.writeFileSync(input,JSON.stringify(M.initialExample()));let p=run();assert.equal(p.status,0,p.stderr);assert.equal(JSON.parse(p.stdout).measured,9);assert.equal(read(JSON.parse(fs.readFileSync(out,'utf8'))).audit.complete,true);
const content=fs.readFileSync(out,'utf8'),receipt=JSON.parse(p.stdout);
assert.equal(receipt.validation_scope,'structure_and_calculation');assert.equal(receipt.evidence_validation,'not_performed');
assert.equal(receipt.json_sha256,require('node:crypto').createHash('sha256').update(content).digest('hex'));
assert.deepEqual(receipt.scores,{creator:{score:62,measured:3,total:3,partial:false},expert:{score:53,measured:3,total:3,partial:false},founder:{score:80,measured:3,total:3,partial:false}});
assert.notEqual(receipt.json_sha256,require('node:crypto').createHash('sha256').update(content+' ').digest('hex'));
p=run();assert.equal(p.status,1);assert.equal(fs.readFileSync(out,'utf8'),content);fs.unlinkSync(out);
fs.writeFileSync(input,JSON.stringify(result.data));p=run();assert.equal(p.status,2,p.stderr);assert.equal(JSON.parse(p.stdout).measured,4);assert.equal(JSON.parse(p.stdout).missing.length,5);const partialReceipt=JSON.parse(p.stdout);assert.equal(partialReceipt.scores.founder.score,null);assert.equal(partialReceipt.scores.expert.measured,3);assert.equal(partialReceipt.scores.expert.partial,true);assert.equal(partialReceipt.json_sha256,require('node:crypto').createHash('sha256').update(fs.readFileSync(out)).digest('hex'));fs.unlinkSync(out);
d=M.initialExample();d.axes.expert.metrics.autoridade.numerator=null;fs.writeFileSync(input,JSON.stringify(d));p=run();assert.equal(p.status,1);assert.match(p.stderr,/axes.expert.metrics.autoridade.numerator/);assert.equal(fs.existsSync(out),false);
d=M.initialExample();d.credential_resolution={token:'private-marker'};fs.writeFileSync(input,JSON.stringify(d));p=run();assert.equal(p.status,1);assert(!p.stderr.includes('private-marker'));assert.equal(fs.existsSync(out),false);
console.log('ECF: normalização segura, migração 4/9, lacunas, contrato fixo e entrega CLI verificados.');
"""
        with tempfile.TemporaryDirectory() as temp:
            subprocess.run([shutil.which('node'), '-e', script, temp], cwd=ROOT, check=True)


    @unittest.skipUnless(shutil.which('node'), 'Node is required for native metric checks')
    def test_native_zernio_contract_and_scores(self):
        script = r"""
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),cp=require('node:child_process');
const dir='site/assistir/hermes-em-operacao/diagnostico-ecf/',box={module:{exports:{}},TextEncoder};
for(const file of ['model.js','native.js'])vm.runInNewContext(fs.readFileSync(dir+file,'utf8'),box);
const M=box.module.exports,N=M.Native;vm.runInNewContext(fs.readFileSync(dir+'import.js','utf8'),box);const I=box.module.exports;
const read=d=>I.read(JSON.stringify(d)),board=d=>N.initialDashboard(d),make=()=>N.initialExample();
let d=make(),r=board(d);assert.equal(r.axes.creator.score,64);assert.equal(r.axes.expert.score,68);assert(Math.abs(r.axes.founder.score-190/3)<1e-8);assert.equal(r.partial,false);assert.equal(read(d).audit.measured,9);assert.equal(read(d).audit.scores.founder.score,63);
// A native file carries observations, never manually assigned scores or semantics.
for(const change of [x=>x.axes={},x=>x.account.followers_gained=100,x=>x.inbox.qualified_dms=9,x=>x.posts.items[0].completionRate=1]){d=make();change(d);assert.throws(()=>read(d),/fora do contrato/);}
// Numerators and denominators of post ratios are always paired by post.
d=make();d.posts.items[0].likes=null;r=board(d);assert.equal(r.axes.creator.components[1].raw,.04);assert.equal(r.axes.creator.components[1].quality,'partial');assert.equal(r.axes.expert.components[0].quality,'measured');
d.account.reach=60000;assert.equal(board(d).axes.creator.components[1].raw,.04);assert.equal(board(d).axes.founder.components[0].raw,90/60000);
d=make();d.account.accounts_engaged=0;assert.equal(board(d).axes.founder.components[1].points,0);d.account.accounts_engaged=null;assert.equal(board(d).axes.founder.components[1].points,null);assert.equal(read(d).audit.measured,8);
d=make();d.account.reach=0;assert.equal(board(d).axes.creator.components[0].points,0);assert.equal(board(d).axes.founder.score,null);
d=make();d.account.followers_updated_at=null;assert.equal(board(d).axes.creator.components[0].quality,'partial');assert.equal(board(d).axes.creator.components[0].raw,2.4);
// Milliseconds vs seconds: median of per-Reel ratios, not completion rate or engagementRate.
d=make();d.posts.items.forEach((p,i)=>p.ig_reels_avg_watch_time_ms=[9000,15000,21000][i]);assert.equal(board(d).axes.expert.components[2].raw,.5);
d.posts.items[0].media_product_type='FEED';d.posts.items[0].ig_reels_avg_watch_time_ms=0;d.posts.items[1].video_duration_seconds=null;assert.equal(board(d).axes.expert.components[2].raw,.7);assert.equal(board(d).axes.expert.components[2].quality,'partial');
d.posts.items[2].video_duration_seconds=0;assert.equal(board(d).axes.expert.components[2].raw,null);
d=make();d.posts.items.forEach(p=>{p.media_product_type='UNKNOWN';p.ig_reels_avg_watch_time_ms=0;});assert.equal(board(d).axes.expert.components[2].raw,null);assert.equal(board(d).axes.creator.components[1].raw,.04);
d=make();d.posts.items[0].media_product_type='STORY';d.posts.items[0].likes=9999;assert.equal(board(d).axes.creator.components[1].raw,.04);
d=make();d.posts.items.forEach(p=>p.ig_reels_avg_watch_time_ms=60000);assert.equal(board(d).axes.expert.components[2].raw,2);assert.equal(board(d).axes.expert.components[2].points,100);
// Scope and coverage do not silently mix accounts or duplicated pages.
for(const change of [x=>x.inbox.account_id='outra',x=>x.posts.items[1].id=x.posts.items[0].id,x=>x.posts.expected_count=4,x=>x.posts.items[0].published_at='2026-07-31T12:00:00Z',x=>x.account.status='missing',x=>x.posts.items[0].likes=1.2]){d=make();change(d);assert.throws(()=>read(d));}
d=make();d.posts.expected_count=4;d.posts.status='partial';d.posts.reason='Uma página pendente';assert.equal(board(d).axes.expert.partial,true);
d=N.emptyInitialReport('@perfil','2026-08-01','2026-08-30');assert.equal(board(d).overall,null);assert.equal(read(d).audit.measured,0);
// Numeric repairs are explicit, without converting percentages or ambiguous formatting.
d=make();d.account.reach='12000';assert.equal(read(d).data.account.reach,12000);assert.equal(read(d).audit.changes.length,1);
for(const v of ['12.000,00','1%','12.500',false,-1]){d=make();d.account.reach=v;assert.throws(()=>read(d));}
// Engaged accounts use native account counts, without adopting follower values.
d=make();d.account.accounts_engaged=1200;r=board(d);assert.equal(r.axes.founder.components[1].raw,.1);assert.equal(r.axes.founder.components[1].points,80);
d=make();d.account.follows=75;assert.throws(()=>read(d),/fora do contrato/);
// V3 remains readable at its original score; migration preserves eight metrics and ideals.
const old=N.V3.initialExample(),oldCopy=JSON.stringify(old);assert.equal(read(old).audit.revision,'ecf-zernio-v3');assert.equal(read(old).audit.scores.founder.score,63);
old.reference.targets.founder.cliques_perfil=.02;old.reference.targets.creator.alcance=6;old.account.reason='Cobertura anterior limitada';const beforeUpgrade=JSON.stringify(old);
const migrated=N.upgrade(old);assert.equal(JSON.stringify(old),beforeUpgrade);assert.equal(migrated.account.reason,old.account.reason);assert.equal(migrated.method,'ecf-zernio-v4');assert.equal(migrated.account.accounts_engaged,null);assert.equal(migrated.account.follows,undefined);assert.equal(migrated.reference.targets.founder.novos_seguidores,undefined);assert.equal(migrated.reference.targets.founder.contas_engajadas,.1);assert.equal(migrated.reference.targets.founder.cliques_perfil,.02);assert.equal(migrated.reference.targets.creator.alcance,6);assert.equal(JSON.stringify(migrated.posts),JSON.stringify(old.posts));assert.equal(migrated.inbox.unique_conversations,old.inbox.unique_conversations);assert.equal(read(migrated).audit.measured,8);assert.equal(N.V3.initialExample().method,'ecf-zernio-v3');assert.equal(JSON.stringify(N.V3.initialExample()),oldCopy);
assert.throws(()=>I.read(JSON.stringify(make()),old),/method/);assert.throws(()=>I.read(JSON.stringify(old),make()),/method/);
// New ideals stay independent from the previous ECF method.
d=make();const ref=N.initialReference();ref.targets.creator.alcance=6;assert(Math.abs(N.initialDashboard(d,ref).axes.creator.score-160/3)<1e-8);
assert.equal(I.read(JSON.stringify(M.initialExample())).data.method,'ecf-inicial-v2');
// The copied validator emits the same native scores and byte hash as the page.
const tmp=process.argv[1],validator=path.join(tmp,'validate.cjs'),draft=path.join(tmp,'draft.json'),contract=path.join(tmp,'contract.json'),out=path.join(tmp,'out.json');
fs.writeFileSync(validator,['model.js','native.js','import.js','validator-cli.cjs'].map(f=>fs.readFileSync(dir+f,'utf8')).join('\n'));
const expected=N.emptyInitialReport('@perfil.exemplo','2026-08-01','2026-08-30');fs.writeFileSync(contract,JSON.stringify(expected));fs.writeFileSync(draft,JSON.stringify(make()));
const run=()=>cp.spawnSync(process.execPath,[validator,draft,'--contract',contract,'--output',out],{encoding:'utf8'});
let p=run();assert.equal(p.status,0,p.stderr);const receipt=JSON.parse(p.stdout);assert.equal(receipt.contract,'ecf-zernio-v4');assert.equal(receipt.measured,9);assert.equal(receipt.scores.expert.score,68);assert.equal(receipt.evidence_validation,'not_performed');assert.equal(receipt.json_sha256,require('node:crypto').createHash('sha256').update(fs.readFileSync(out)).digest('hex'));fs.unlinkSync(out);
d=make();d.inbox.unique_conversations=null;fs.writeFileSync(draft,JSON.stringify(d));p=run();assert.equal(p.status,2,p.stderr);assert.equal(JSON.parse(p.stdout).missing[0],'inbox.unique_conversations');fs.unlinkSync(out);
for(const change of [x=>x.profile='@outro',x=>x.reference.targets.expert.salvamentos=.5]){d=make();change(d);fs.writeFileSync(draft,JSON.stringify(d));p=run();assert.equal(p.status,1);assert.equal(fs.existsSync(out),false);}
console.log('ECF nativo: nove variáveis, fontes, unidades, cobertura, compatibilidade e CLI verificados.');
"""
        with tempfile.TemporaryDirectory() as temp:
            subprocess.run([shutil.which('node'), '-e', script, temp], cwd=ROOT, check=True)


if __name__ == '__main__':
    unittest.main()
