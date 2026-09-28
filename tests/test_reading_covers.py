"""Small delivery images preserve approved full-resolution cover sources."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import unittest
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'apps/web' if (ROOT / 'apps/web').is_dir() else ROOT / 'site'


class ReadingCovers(unittest.TestCase):
    def test_copies_fit_budget_preserve_framing_and_pin_original_bytes(self):
        manifest = json.loads((SITE / 'leitura/assets/responsive/manifest.json').read_text())
        readings = json.loads((SITE / 'leitura/manifest.json').read_text())['readings']
        self.assertEqual({entry['source'] for entry in manifest['covers']}, {entry['cover'] for entry in readings})
        for entry in manifest['covers']:
            original = SITE / entry['source'].lstrip('/')
            self.assertEqual(hashlib.sha256(original.read_bytes()).hexdigest(), entry['sha256'])
            with Image.open(original) as image:
                self.assertEqual(image.size, (entry['width'], entry['height']))
            self.assertEqual([item['width'] for item in entry['copies']], [640, 960])
            for copy in entry['copies']:
                path = SITE / copy['src'].lstrip('/')
                self.assertEqual(path.stat().st_size, copy['bytes'])
                self.assertLess(copy['bytes'], 200_000)
                self.assertLess(copy['bytes'], original.stat().st_size)
                self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), copy['sha256'])
                with Image.open(path) as image:
                    self.assertEqual(image.size, (copy['width'], copy['height']))
                    self.assertLessEqual(abs(image.height - entry['height'] * image.width / entry['width']), 1)

    def test_catalog_has_safe_optional_delivery_and_original_fallback(self):
        node = shutil.which('node')
        if not node:
            self.skipTest('Node unavailable')
        script = """
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const manifest={schemaVersion:1,readings:[{slug:'flow',reader:'leitura/flow.json',cover:'/leitura/flow.webp'}]};
const delivery={schemaVersion:1,covers:[{source:'/leitura/flow.webp',width:1672,copies:[{src:'/leitura/assets/responsive/flow-640.webp',width:640},{src:'https://bad.invalid/x.webp',width:960},{src:'/leitura/assets/responsive/flow-big.webp',width:2000}]}]};
for (const failure of [false,true]) {
  const context={window:{},AbortController,fetch:async url=>{
    if(url.includes('responsive')) {if(failure) throw Error('offline');return {ok:true,json:async()=>delivery};}
    return {ok:true,json:async()=>manifest};
  }};
  vm.runInNewContext(fs.readFileSync(SOURCE,'utf8'),context);
  const result=await context.window.AgentFlixReader.catalogSkills([{name:'flow'}]);
  assert.equal(result[0].reading_cover,'/leitura/flow.webp');
  assert.equal(result[0].reading_sources?.length||0,failure?0:1);
}
""".replace('SOURCE', json.dumps(str(SITE / 'human-reader.js')))
        result = subprocess.run([node, '--input-type=module', '-e', script], capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == '__main__':
    unittest.main()
