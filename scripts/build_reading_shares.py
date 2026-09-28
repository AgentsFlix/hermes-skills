#!/usr/bin/env python3
"""Gera links com Open Graph e a mesma vitrine, sem leitor paralelo."""
import argparse
import html
import json
from pathlib import Path
import re
from build_lessons import image_info

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'https://agentsflix.ai'


def render(template, entry, site):
    slug = entry['slug']
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', slug):
        raise ValueError('Slug inválido')
    share = entry.get('share', {})
    for field in ('title', 'description', 'image', 'preview_image', 'alt'):
        if not isinstance(share.get(field), str) or not share[field].strip():
            raise ValueError(f'{slug}: falta share.{field}')
    revision = share.get('revision')
    if type(revision) is not int or revision < 1:
        raise ValueError('Revisão da prévia precisa ser um inteiro positivo')
    for field in ('image', 'preview_image'):
        path = share[field]
        if not re.fullmatch(r'/leitura/[a-zA-Z0-9/_.-]+\.(jpg|jpeg|png)', path) or '..' in path.split('/'):
            raise ValueError('Capa deve ser um arquivo público local')
        if not (site / path.lstrip('/')).is_file():
            raise ValueError(f'{field} indisponível')
    image = share['preview_image']
    raw = (site / image.lstrip('/')).read_bytes()
    width, height, mime = image_info(raw)
    if width < 600 or height < 315 or mime != 'image/jpeg' or len(raw) >= 300_000:
        raise ValueError('Prévia precisa ser JPEG com ao menos 600 × 315 px e menos de 300 KB')
    url = f'{ORIGIN}/compartilhar/{slug}/?v={revision}'
    esc = lambda value: html.escape(str(value), quote=True)
    values = {
        'og:title': share['title'], 'og:description': share['description'],
        'og:type': 'article', 'og:url': url,
        'og:image': ORIGIN + image, 'og:image:secure_url': ORIGIN + image,
        'og:image:type': mime, 'og:image:width': width, 'og:image:height': height,
        'og:image:alt': share['alt'],
    }
    # Replace existing tags rather than append competing generic previews.
    result = template
    for key, value in values.items():
        result, count = re.subn(r'<meta property="' + re.escape(key) + r'" content="[^"]*">',
            lambda _: f'<meta property="{key}" content="{esc(value)}">', result)
        if count != 1: raise ValueError(f'Template precisa de um {key}')
    for key, value in {'description':share['description'], 'twitter:title':share['title'],
                       'twitter:description':share['description'], 'twitter:image':ORIGIN + image}.items():
        result, count = re.subn(r'<meta name="' + re.escape(key) + r'" content="[^"]*">',
            lambda _: f'<meta name="{key}" content="{esc(value)}">', result)
        if count != 1: raise ValueError(f'Template precisa de um {key}')
    result = re.sub(r'<title>[^<]*</title>', lambda _: f'<title>{esc(share["title"])} | AgentFlix</title>', result, count=1)
    result = re.sub(r'<link rel="canonical" href="[^"]*">', lambda _: f'<link rel="canonical" href="{url}">', result, count=1)
    if '<base href="/">' not in result:
        result = result.replace('<head>', '<head>\n<base href="/">', 1)
    result = result.replace('<html lang="pt-BR">', f'<html lang="pt-BR" data-shared-reading="{slug}">', 1)
    return '<!-- Gerado por scripts/build_reading_shares.py a partir da vitrine e do manifest. -->\n' + result


def outputs(root=ROOT):
    site = root / 'site'
    template = (site / 'index.html').read_text()
    manifest = json.loads((site / 'leitura/manifest.json').read_text())
    result = {}
    for entry in manifest['readings']:
        page = render(template, entry, site)
        path = site / 'compartilhar' / entry['slug'] / 'index.html'
        if path in result: raise ValueError('Leitura duplicada')
        result[path] = page
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    expected = outputs()
    stale = set((ROOT / 'site/compartilhar').glob('*/index.html')) - expected.keys()
    if stale: raise ValueError(f'Páginas sem leitura registrada: {stale}')
    for path, text in expected.items():
        if args.check:
            if not path.exists() or path.read_text() != text:
                raise ValueError(f'{path.relative_to(ROOT)} desatualizado. Rode scripts/build_reading_shares.py')
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text)
    print(f'{len(expected)} links de leitura {"verificados" if args.check else "gerados"}.')


if __name__ == '__main__':
    main()
