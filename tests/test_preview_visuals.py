"""Hover prepares locally without flashing the route loader."""
import json
from pathlib import Path
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / 'apps/web' if (ROOT / 'apps/web').is_dir() else ROOT / 'site'


class PreviewVisuals(unittest.TestCase):
    def test_preview_decode_cancel_failure_and_replacement(self):
        node = shutil.which('node')
        if not node:
            self.skipTest('Node unavailable')
        source = (WEB / 'design-system/preview-visuals.mjs').as_uri()
        script = """
import assert from 'node:assert/strict';
const {mountPreviewVisuals, isPreviewVisual, isDormantRouteVisual} = await import(SOURCE);
let changed, cleanup;
globalThis.MutationObserver = class { constructor(fn) { changed = fn; } };
const parent = new AbortController();
const life = {signal:parent.signal, observe(){}, onDispose(fn){cleanup=fn;}};
const tick = () => new Promise(resolve => setImmediate(resolve));
function image(src) {
  let resolve, reject;
  const promise = new Promise((a,b) => {resolve=a;reject=b;});
  return {src,srcset:'',currentSrc:src,complete:true,naturalWidth:8,
    getAttribute(name){return name==='src' ? src : null;},
    decode(){return promise;},resolve,reject};
}
let images = [image('first')];
const preview = {hidden:false,inert:false,style:{visibility:''},
  ownerDocument:{fonts:{ready:Promise.resolve()}},querySelectorAll(){return images;}};
mountPreviewVisuals(preview,life);
await tick();
assert.equal(preview.style.visibility,'hidden'); assert.equal(preview.inert,true);
images[0].resolve(); await tick(); await tick();
assert.equal(preview.style.visibility,''); assert.equal(preview.inert,false);
// Switching cards cancels the old decode; it cannot reveal the newer image early.
const old=image('old'), next=image('next'); images=[old]; changed(); await tick();
images=[next]; changed(); await tick(); old.resolve(); await tick();
assert.equal(preview.style.visibility,'hidden');
next.resolve(); await tick(); await tick(); assert.equal(preview.style.visibility,'');
// Failure stays local; the underlying card remains available.
const broken=image('broken'); images=[broken]; changed(); await tick();
broken.reject(Error('missing')); await tick(); await tick();
assert.equal(preview.hidden,true); assert.equal(preview.inert,false);
// Route disposal cancels pending work and restores the owned visibility.
preview.hidden=false; images=[image('late')]; changed(); await tick();
parent.abort(); cleanup(); images[0].resolve(); await tick();
assert.equal(preview.style.visibility,''); assert.equal(preview.inert,false);
assert.equal(isPreviewVisual({closest(){return preview;}}),true);
assert.equal(isPreviewVisual({closest(){return null;}}),false);
const hiddenSection={}, parkedRoute={};
const root={contains(el){return el===hiddenSection;}};
assert.equal(isDormantRouteVisual({closest(){return hiddenSection;}},root),true);
assert.equal(isDormantRouteVisual({closest(){return parkedRoute;}},root),false);
assert.equal(isDormantRouteVisual({closest(){return null;}},root),false);
console.log('PASS local decode, replacement, failure and route disposal');
""".replace('SOURCE', json.dumps(source))
        result = subprocess.run([node, '--input-type=module', '-e', script], capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_route_observer_keeps_hover_assets_outside_the_page_gate(self):
        source = (WEB / 'design-system/product-shell.mjs').read_text()
        self.assertIn("mountPreviewVisuals(root.querySelector('#preview'), life)", source)
        self.assertIn("event.target.tagName !== 'IMG' || isPreviewVisual(event.target)", source)
        self.assertIn("mountLiveVisuals(root, life)", source)
        self.assertNotIn("shell.refresh()", source)


if __name__ == '__main__':
    unittest.main()
