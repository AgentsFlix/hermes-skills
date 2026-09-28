"""The desktop package must retain its media and scanner metadata in every distribution."""
import json
from pathlib import Path
from unittest import TestCase
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parents[1]
SLUG = 'transcritor-local'
MEDIA = (
    'assets/onboarding-como-acessar.mp4',
    'assets/onboarding-logar-codex.mp4',
    'assets/escolher-arquivo.webp',
    'assets/colar-youtube.webp',
)


class TranscritorDistributionTests(TestCase):
    def test_portable_zip_keeps_desktop_assets_and_narrow_scan_ignore(self):
        source = ROOT / 'skills' / SLUG
        portable = ROOT / 'docs/.well-known/skills' / SLUG
        ignore = (source / '.skillignore').read_bytes()
        self.assertEqual((portable / '.skillignore').read_bytes(), ignore)
        ignored = [line for line in ignore.decode().splitlines() if line and not line.startswith('#')]
        self.assertEqual(ignored, list(MEDIA[:2]))
        with ZipFile(ROOT / 'docs/packages/transcritor-local.zip') as archive:
            self.assertEqual(archive.read(f'{SLUG}/.skillignore'), ignore)
            for rel in MEDIA:
                with self.subTest(asset=rel):
                    original = (source / rel).read_bytes()
                    self.assertEqual((portable / rel).read_bytes(), original)
                    self.assertEqual(archive.read(f'{SLUG}/{rel}'), original)
            portable_integrity = json.loads(archive.read(f'{SLUG}/integrity.json'))
            self.assertIn('.skillignore', portable_integrity['files'])
