import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const web = process.argv[2];
const { mountLiveVisuals } = await import(pathToFileURL(`${web}/design-system/live-visuals.mjs`));
const { mountNavigation } = await import(pathToFileURL(`${web}/design-system/navigation.mjs`));
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
let mutation;
globalThis.MutationObserver = class { constructor(fn) { mutation=fn; } };
const makeImage = src => ({src,srcset:'',currentSrc:src,complete:false,naturalWidth:0,style:{visibility:''},dataset:{},
  closest(){return null;}, getAttribute(name){return name==='src'?this.src:null;},
  reset(src) {this.src=this.currentSrc=src;this.complete=false;this.naturalWidth=0;const d=deferred();this.decode=()=>d.promise;this.finish=()=>{this.complete=true;this.naturalWidth=100;d.resolve();};this.fail=d.reject;}
});
const parent = new AbortController(), cleanup=[];
const images=[], root={ownerDocument:{defaultView:{}},querySelectorAll(){return images;},contains(image){return images.includes(image);}};
const life={signal:parent.signal,observe(){},listen(){},onDispose(fn){cleanup.push(fn);}};
mountLiveVisuals(root,life);
const image=makeImage('first');image.reset('first');images.push(image);mutation();
assert.equal(image.style.visibility,'hidden');assert.equal(image.dataset.afVisualState,'loading');
await tick();image.finish();await tick();
assert.equal(image.style.visibility,'');assert.equal(image.dataset.afVisualState,'ready');
image.reset('broken');mutation();await tick();image.fail(Error('network'));await tick();
assert.equal(image.dataset.afVisualState,'error');assert.equal(image.style.visibility,'hidden');
image.reset('recovered');mutation();await tick();image.finish();await tick();
assert.equal(image.style.visibility,'');assert.equal(image.dataset.afVisualState,'ready');
image.reset('obsolete');mutation();await tick();const obsoleteFinish=image.finish;
image.reset('newest');mutation();await tick();obsoleteFinish();await tick();
assert.equal(image.style.visibility,'hidden');
image.finish();await tick();assert.equal(image.dataset.afVisualState,'ready');
image.reset('cancelled');mutation();await tick();parent.abort();cleanup.forEach(fn=>fn());
image.finish();await tick();assert.equal(image.style.visibility,'');

// Exercise the real navigation state machine with a small DOM contract.
class Element extends EventTarget {
  constructor(){super();this.dataset={};this.style={};this.hidden=false;this.inert=false;this.children=[];this.attrs={};}
  setAttribute(k,v){this.attrs[k]=v;} removeAttribute(k){delete this.attrs[k];}
  querySelector(){return null;} querySelectorAll(){return [];}
  replaceChildren(...nodes){this.children=nodes;}
  focus(){focusCalls++;}
}
let focusCalls=0, scrollCalls=0, prepared=0, disposed=0, reveals=0;
const win=new EventTarget();win.scrollY=720;win.scrollTo=()=>{scrollCalls++;win.scrollY=0;};
win.location={href:'https://example.test/course'};win.history={pushState(){}};
win.matchMedia=()=>Object.assign(new EventTarget(),{matches:false});
const doc={defaultView:win,fonts:{ready:Promise.resolve()}};
const header=new Element(),nav=new Element(),viewport=new Element(),screen=new Element(),loader=new Element(),error=new Element(),retry=new Element(),marker=new Element();
header.ownerDocument=screen.ownerDocument=doc;header.offsetHeight=60;header.querySelector=()=>nav;
globalThis.ResizeObserver=class {observe(){} disconnect(){}};
const target={audience:'humano',section:'course'};
const content=new Element();content.ownerDocument=doc;
const lessonImage=makeImage('lesson');lessonImage.complete=true;lessonImage.naturalWidth=100;lessonImage.decode=async()=>{};
const visualRoot={ownerDocument:doc,querySelectorAll(){return [lessonImage];}};
const shell=mountNavigation({header,viewport,screen,loader,error,retry,marker,initial:target,
  resolve:value=>value,parseURL:()=>target,urlFor:value=>'/'+value.section,
  prepare:async()=>{prepared++;return {element:content,visualRoot,afterReady(){reveals++;},dispose(){disposed++;}};}
});
await shell.ready;assert.equal(viewport.dataset.state,'ready');
const pending=deferred();lessonImage.decode=()=>pending.promise;
const refresh=shell.refresh();await tick();
assert.equal(screen.hidden,false);assert.equal(screen.inert,false);assert.equal(loader.hidden,true);
assert.equal(viewport.dataset.state,'ready');assert.equal(win.scrollY,720);
pending.resolve();assert.equal(await refresh,true);assert.equal(reveals,1);assert.equal(disposed,0);
lessonImage.decode=async()=>{throw Error('image failed');};
assert.equal(await shell.refresh(),false);assert.equal(screen.children[0],content);assert.equal(screen.hidden,false);
assert.equal(viewport.dataset.state,'ready');assert.equal(win.scrollY,720);assert.equal(disposed,0);
assert.equal(await shell.navigate(target),true);assert.equal(prepared,1);assert.equal(scrollCalls,0);assert.equal(focusCalls,0);
lessonImage.decode=async()=>{};
const update=deferred();lessonImage.decode=()=>update.promise;const obsoleteRefresh=shell.refresh();await tick();
lessonImage.decode=async()=>{};await shell.navigate({audience:'humano',section:'other'});
update.resolve();assert.equal(await obsoleteRefresh,false);assert.equal(shell.current.section,'other');
assert.equal(viewport.dataset.state,'ready');assert.equal(prepared,2);assert.equal(scrollCalls,1);
shell.dispose();
console.log('PASS local decode, failure, replacement, cleanup, refresh, scroll, same route and navigation race');
