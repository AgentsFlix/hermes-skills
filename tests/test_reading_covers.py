"""Small delivery images preserve approved full-resolution cover sources."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'apps/web' if (ROOT / 'apps/web').is_dir() else ROOT / 'site'


def webp_size(data):
    """Read actual WebP dimensions without a CI-only imaging dependency."""
    if data[:4] != b'RIFF' or data[8:12] != b'WEBP':
        raise ValueError('Not a WebP image')
    offset = 12
    while offset + 8 <= len(data):
        kind = data[offset:offset + 4]
        length = int.from_bytes(data[offset + 4:offset + 8], 'little')
        chunk = data[offset + 8:offset + 8 + length]
        if len(chunk) != length:
            raise ValueError('Truncated WebP chunk')
        if kind == b'VP8X' and length >= 10:
            return (1 + int.from_bytes(chunk[4:7], 'little'),
                    1 + int.from_bytes(chunk[7:10], 'little'))
        if kind == b'VP8 ' and length >= 10 and chunk[3:6] == b'\x9d\x01\x2a':
            return (int.from_bytes(chunk[6:8], 'little') & 0x3fff,
                    int.from_bytes(chunk[8:10], 'little') & 0x3fff)
        if kind == b'VP8L' and length >= 5 and chunk[0] == 0x2f:
            packed = int.from_bytes(chunk[1:5], 'little')
            return ((packed & 0x3fff) + 1, ((packed >> 14) & 0x3fff) + 1)
        offset += 8 + length + (length & 1)
    raise ValueError('WebP dimensions missing')


class ReadingCovers(unittest.TestCase):
    def test_dimensions_cover_webp_headers_without_optional_packages(self):
        width, height = 640, 361
        chunks = [
            (b'VP8X', b'\x00' * 4 + (width - 1).to_bytes(3, 'little') + (height - 1).to_bytes(3, 'little')),
            (b'VP8 ', b'\x00' * 3 + b'\x9d\x01\x2a' + width.to_bytes(2, 'little') + height.to_bytes(2, 'little')),
            (b'VP8L', b'\x2f' + ((width - 1) | ((height - 1) << 14)).to_bytes(4, 'little')),
        ]
        for kind, payload in chunks:
            chunk = kind + len(payload).to_bytes(4, 'little') + payload + b'\x00' * (len(payload) & 1)
            data = b'RIFF' + (4 + len(chunk)).to_bytes(4, 'little') + b'WEBP' + chunk
            self.assertEqual(webp_size(data), (width, height))
            with self.assertRaises(ValueError):
                webp_size(data[:-2])
        with self.assertRaises(ValueError):
            webp_size(b'not an image')

    def test_copies_fit_budget_preserve_framing_and_pin_original_bytes(self):
        manifest = json.loads((SITE / 'leitura/assets/responsive/manifest.json').read_text())
        readings = json.loads((SITE / 'leitura/manifest.json').read_text())['readings']
        self.assertEqual({entry['source'] for entry in manifest['covers']}, {entry['cover'] for entry in readings})
        for entry in manifest['covers']:
            original = SITE / entry['source'].lstrip('/')
            self.assertEqual(hashlib.sha256(original.read_bytes()).hexdigest(), entry['sha256'])
            self.assertEqual(webp_size(original.read_bytes()), (entry['width'], entry['height']))
            self.assertEqual([item['width'] for item in entry['copies']], [640, 960])
            for copy in entry['copies']:
                path = SITE / copy['src'].lstrip('/')
                self.assertEqual(path.stat().st_size, copy['bytes'])
                self.assertLess(copy['bytes'], 200_000)
                self.assertLess(copy['bytes'], original.stat().st_size)
                self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), copy['sha256'])
                width, height = webp_size(path.read_bytes())
                self.assertEqual((width, height), (copy['width'], copy['height']))
                self.assertLessEqual(abs(height - entry['height'] * width / entry['width']), 1)

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
