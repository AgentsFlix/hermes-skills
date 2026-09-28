"""Regression: background visual updates preserve the mounted page and scroll."""
from pathlib import Path
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / 'apps/web' if (ROOT / 'apps/web').is_dir() else ROOT / 'site'


class LiveVisuals(unittest.TestCase):
    def test_local_images_and_same_route_refresh(self):
        node = shutil.which('node')
        if not node:
            self.skipTest('Node unavailable')
        result = subprocess.run([node, str(ROOT / 'tests/live_visuals.mjs'), str(WEB)],
                                text=True, capture_output=True, timeout=15)
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == '__main__':
    unittest.main()
