#!/usr/bin/env python3
"""Gera as três distribuições e a superfície publicada, a partir de skills/ e catalog.json.

  skills/<slug>/                         fonte, frontmatter do Hermes (não é tocada)
  dist/portable/<slug>/ + <slug>.zip     frontmatter ESTRITO ao spec agentskills.io: Claude.ai, ChatGPT, npx skills add
  docs/.well-known/skills/               a versão portable (é o que `npx skills add <url>` e outros agentes leem)
  docs/prompt/<slug>.md                  versão COLÁVEL: SKILL.md + referências podadas num arquivo só
  docs/catalog.json                      cópia do catálogo

Só stdlib + PyYAML. Idempotente. Rode depois de mudar qualquer skill.
"""
from __future__ import annotations

import hashlib, io, json, re, shutil, zipfile
from pathlib import Path

import yaml

from hub_common import HUB_URL, REPO_SLUG, activation_text, cap200

ROOT = Path(__file__).resolve().parents[1]
SKILLS, DOCS, DIST = ROOT / "skills", ROOT / "docs", ROOT / "dist" / "portable"
WK, PROMPT = DOCS / ".well-known" / "skills", DOCS / "prompt"
SPEC_KEYS = ("name", "description", "license", "compatibility", "metadata", "allowed-tools")
PROMPT_CAP = 250_000  # chars; acima disso a versão colável para e aponta para o zip

# ───────────── frontmatter estrito ─────────────
def strict_frontmatter(fm: dict, slug: str, version: str) -> dict:
    original_meta = fm.get("metadata") or {}
    h = original_meta.get("hermes") or {}
    desc = cap200(fm["description"])
    compat = []
    if h.get("requires_toolsets"): compat.append("Requer: " + ", ".join(h["requires_toolsets"]) + ".")
    if fm.get("required_environment_variables"):
        compat.append("Antes de usar, defina no ambiente: " + ", ".join(e["name"] for e in fm["required_environment_variables"]) + ".")
    if h.get("blueprint"): compat.append("No Hermes roda agendada; em outros agentes, sob demanda.")
    compat.append("Agent Skills (agentskills.io). Funciona em Claude, ChatGPT, Codex, Cursor, Copilot e agentes compatíveis.")
    meta = {"author": str(fm.get("author", original_meta.get("author", ""))), "version": version, "hub": HUB_URL,
            "source": f"https://github.com/{REPO_SLUG}/tree/main/skills/{slug}",
            "tags": ", ".join(h["tags"]) if "tags" in h else str(original_meta.get("tags", "")),
            "related": ", ".join(h.get("related_skills", []))}
    identity_path = SKILLS / slug / "references/identidade.json"
    if identity_path.exists():
        identity = json.loads(identity_path.read_text())
        if identity["skill_id"] != slug or identity["distribution_version"] != version:
            raise ValueError("Identidade/versão diverge da distribuição: " + slug)
        meta.update({"source": f"https://github.com/{REPO_SLUG}/tree/{identity['distribution_ref']}/skills/{slug}",
                     "contract_version": identity["contract_version"], "content_revision": identity["content_revision"],
                     "distribution_ref": identity["distribution_ref"]})
    if h.get("config"):
        meta["config"] = "; ".join(f"{c['key']}: {c['description']}" for c in h["config"])
    return {"name": fm["name"], "description": desc, "license": fm.get("license", "MIT"),
            "compatibility": (fm.get("compatibility") or " ".join(compat))[:500],
            "metadata": {k: v for k, v in meta.items() if v}}

def dump_fm(d: dict) -> str:
    return "---\n" + yaml.safe_dump(d, allow_unicode=True, sort_keys=False, width=1000).strip() + "\n---\n"

# ───────────── adaptação do corpo para fora do Hermes ─────────────
BODY_FIX = [
    (re.compile(r"\[Skill directory\]/"), ""),
    (re.compile(r"\s*\(o valor já está no seu contexto\)"), " (pergunte ao usuário, se ainda não souber)"),
    (re.compile(r"\s*\(valor já no seu contexto\)"), " (pergunte ao usuário, se ainda não souber)"),
    (re.compile(r"\(config injetada\)"), "(pergunte ao usuário)"),
    (re.compile(r"Configure-a pelo Hermes \(required_environment_variables\) e abra nova sessão"), "Defina-a no ambiente onde o script roda"),
    (re.compile(r"pelo Hermes e abrir nova sessão"), "no ambiente onde o script roda"),
    (re.compile(r"que o Hermes preenche a partir de `required_environment_variables` e nunca mostra ao modelo"), "definida no ambiente onde o script roda, nunca no chat"),
    (re.compile(r"\(required_environment_variables\)"), "(variável de ambiente)"),
]
def adapt_body(body: str) -> str:
    for rx, rep in BODY_FIX: body = rx.sub(rep, body)
    return body

def split(md: str):
    parts = md.split("---\n", 2)
    return yaml.safe_load(parts[1]), parts[2]

# ───────────── poda das referências para a versão colável ─────────────
YAML_DROP = ("activation-instructions", "commands", "IDE-FILE-RESOLUTION", "REQUEST-RESOLUTION")
def prune(text: str, path: str) -> str:
    if path.endswith(".py") or path.endswith(".json"): return text
    lines = text.splitlines(); out = []; skip = False
    for ln in lines:
        top = re.match(r"^([A-Za-z_-]+):", ln)
        if top and top.group(1) in YAML_DROP: skip = True; continue
        if top and skip: skip = False
        if skip: continue
        if ln.startswith("ACTIVATION-NOTICE") or ln.startswith("CRITICAL: Read the full YAML BLOCK") or ln.startswith("## COMPLETE AGENT DEFINITION FOLLOWS"): continue
        if ln.startswith("## MMOS Integration Note"): break
        out.append(ln)
    return "\n".join(out).strip() + "\n"

def referenced_files(body: str) -> list[str]:
    m = re.search(r"## Arquivos desta skill\n\n((?:- `[^`]+`\n?)+)", body)
    return re.findall(r"- `([^`]+)`", m.group(1)) if m else []

def build_prompt(slug: str, fm: dict, body: str, files: list[str], version: str, act: str = "") -> tuple[str, str, list[str]]:
    if "references/ativacao.md" in files:
        act = (SKILLS / slug / "references/ativacao.md").read_text(encoding="utf-8").strip()
    if not act:
        desc = fm["description"]; trig = desc.split("Use quando")[-1].strip(": .…") if "Use quando" in desc else "isso"
        act = activation_text(slug, trig)
    act_display = "\n".join(line.rstrip() for line in act.replace("\n", "\n> ").split("\n"))
    head = f"""# {fm['name']} · versão para colar

> Esta é a mesma skill de {HUB_URL}, num arquivo só, para quem não instala skill:
> ChatGPT sem Skills no plano, Claude sem upload, ou qualquer chat. Onde o texto disser `references/arquivo.md`
> ou `templates/arquivo`, o conteúdo está na seção **Referência:** correspondente, mais abaixo.
>
> **Como usar.** ChatGPT: crie um Project, envie este arquivo em Files e cole nas instruções do projeto o texto
> de ativação abaixo. Claude: envie como conhecimento do Project, ou cole tudo no chat. Qualquer chat: cole tudo.
> Versão {version}. Instalável como skill de verdade (Hermes, Claude.ai, Claude Code, ChatGPT Skills, Codex) na página.
>
> **Texto de ativação (cole nas instruções):** {act_display}

---
"""
    doc = head + adapt_body(body).replace("## Arquivos desta skill", "## Arquivos desta skill (incluídos abaixo)")
    left, truncated = [], []   # truncated: o que ficou fora só pelo teto de tamanho (vai para o catálogo, a página avisa)
    base = (SKILLS / slug).resolve()
    for rel in files:
        p = (SKILLS / slug / rel).resolve()
        if not str(p).startswith(str(base) + "/"): left.append(rel + " (fora da skill: ignorado)"); continue
        if not p.exists(): continue
        if rel.endswith((".py", ".zip", ".png", ".jpg")): left.append(rel + " (script: só no zip)"); continue
        if rel.endswith((".jpeg", ".webp", ".ico", ".icns", ".ttf", ".otf", ".woff", ".woff2", ".mp3", ".mp4", ".wav")):
            left.append(rel + " (arquivo: só no zip)"); continue
        chunk = f"\n\n---\n\n## Referência: {rel}\n\n" + prune(p.read_text(encoding="utf-8", errors="replace"), rel)
        if len(doc) + len(chunk) > PROMPT_CAP: left.append(rel); truncated.append(rel); continue
        doc += chunk
    if left:
        doc += "\n\n---\n\n## Não incluído neste arquivo (está no zip da skill)\n\n" + "\n".join(f"- `{r}`" for r in left) + "\n"
    return doc, act, truncated

# ───────────── principal ─────────────
def distribution_entries(cat: dict) -> dict[str, tuple[dict, str]]:
    """Distribuições autorais mantêm sua versão após virar card visível."""
    entries = {}
    for collection in ("skills", "packages"):
        for entry in cat.get(collection, []):
            slug = entry["name"]
            if slug in entries:
                raise ValueError("Nome repetido no catálogo: " + slug)
            version = entry["version"] if collection == "packages" or entry.get("distribution_ref") else cat["version"]
            if not isinstance(version, str) or not version:
                raise ValueError("Versão inválida no catálogo: " + slug)
            entries[slug] = (entry, version)
    return entries


def write_integrity(directory: Path, version: str) -> None:
    """Hash the final portable bytes, including its rewritten SKILL.md."""
    files = {path.relative_to(directory).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
             for path in sorted(directory.rglob("*"))
             if path.is_file() and path != directory / "integrity.json"
             and "__pycache__" not in path.parts and path.suffix not in (".pyc", ".pyo")}
    manifest = {"schema_version": 1, "version": version, "algorithm": "sha256", "files": files}
    (directory / "integrity.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def portable_ignores(directory: str, names: list[str], skill_root: Path) -> set[str]:
    ignored = set(shutil.ignore_patterns(".*", "__pycache__", "*.pyc", "*.pyo")(directory, names))
    if Path(directory).resolve() == skill_root.resolve():
        ignored.discard(".skillignore")
    return ignored


def main() -> None:
    cat = json.loads((ROOT / "catalog.json").read_text(encoding="utf-8"))
    entries = distribution_entries(cat)
    authored_names = {entry["name"] for entry in cat.get("packages", [])}
    authored_names.update(entry["name"] for entry in cat.get("skills", []) if entry.get("distribution_ref"))
    for d in (DIST, WK, PROMPT, DOCS / "packages"):
        if d.exists(): shutil.rmtree(d)
        d.mkdir(parents=True)
    DOCS.mkdir(exist_ok=True); (DOCS / ".nojekyll").touch()
    index, n = [], 0
    for d in sorted(p for p in SKILLS.iterdir() if (p / "SKILL.md").exists()):
        slug = d.name; fm, body = split((d / "SKILL.md").read_text(encoding="utf-8"))
        entry, version = entries.get(slug, (None, cat["version"]))
        files = referenced_files(body)
        # portable: cópia da pasta com SKILL.md reescrito
        pd = DIST / slug; shutil.copytree(d, pd, ignore=lambda directory, names: portable_ignores(directory, names, d))
        (pd / "SKILL.md").write_text(dump_fm(strict_frontmatter(fm, slug, version)) + adapt_body(body), encoding="utf-8")
        if slug in authored_names:
            write_integrity(pd, version)
        with zipfile.ZipFile(DIST / f"{slug}.zip", "w", zipfile.ZIP_DEFLATED) as z:
            for f in sorted(pd.rglob("*")):
                if not f.is_file(): continue
                zi = zipfile.ZipInfo(f"{slug}/{f.relative_to(pd)}", date_time=(1980, 1, 1, 0, 0, 0))  # sem mtime: zip igual para fonte igual
                zi.compress_type = zipfile.ZIP_DEFLATED; zi.external_attr = 0o644 << 16
                z.writestr(zi, f.read_bytes())
        if (d / "references/identidade.json").exists():
            shutil.copyfile(DIST / f"{slug}.zip", DOCS / "packages" / f"{slug}.zip")
        # well-known serve a portable
        shutil.copytree(pd, WK / slug)
        index.append({"name": slug, "description": strict_frontmatter(fm, slug, version)["description"],
                      "files": sorted(str(f.relative_to(pd)) for f in pd.rglob("*") if f.is_file())})
        # colável
        doc, act, truncated = build_prompt(slug, fm, body, files, version, act=(entry or {}).get("activation_prompt", ""))
        if entry is not None:
            entry["prompt_truncated"] = truncated
            if "references/ativacao.md" in files:
                entry["activation_prompt"] = act
                entry["chat_cmd"] = act
        (PROMPT / f"{slug}.md").write_text(doc, encoding="utf-8")
        n += 1
    (WK / "index.json").write_text(json.dumps({"skills": index}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    # o catálogo ganha prompt_truncated por skill; raiz e docs/ ficam iguais
    cat_text = json.dumps(cat, ensure_ascii=False, indent=2) + "\n"
    (ROOT / "catalog.json").write_text(cat_text, encoding="utf-8"); (DOCS / "catalog.json").write_text(cat_text, encoding="utf-8")
    print(f"dist: {n} portable + {n} zips em dist/portable · well-known (portable) · {n} coláveis em docs/prompt · catálogo copiado")

if __name__ == "__main__":
    main()
