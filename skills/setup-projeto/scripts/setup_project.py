#!/usr/bin/env python3
"""Inspect and prepare agent project documents without running project code.

The default render is a dry run. Git/network mutations belong to the calling
agent. Existing files with different bytes always require explicit
reconciliation; every conflict is checked before the first write.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import sys
import tempfile
from urllib.parse import urlsplit


TASK_FILES = (
    "SKILL.md", "agents/openai.yaml", "scripts/task_context.py",
    "references/workflow.md",
)
MANIFEST = ".setup-projeto/manifest.json"
SKIP_DIRS = {".git", "node_modules", ".venv", "venv", "__pycache__", ".next", "dist", "build"}
MANIFEST_NAMES = {
    "package.json": "JavaScript/TypeScript", "pyproject.toml": "Python",
    "requirements.txt": "Python", "Cargo.toml": "Rust", "go.mod": "Go",
    "Package.swift": "Swift", "Gemfile": "Ruby", "composer.json": "PHP",
    "pom.xml": "Java", "build.gradle": "JVM", "pubspec.yaml": "Dart",
}
LOCK_NAMES = {
    "package-lock.json": "npm", "pnpm-lock.yaml": "pnpm", "yarn.lock": "yarn",
    "bun.lock": "bun", "bun.lockb": "bun", "uv.lock": "uv",
    "poetry.lock": "poetry", "Cargo.lock": "cargo", "Gemfile.lock": "bundler",
    "composer.lock": "composer",
}


class SetupError(ValueError):
    """A refusal whose message contains no input values or secrets."""


REPARSE_POINT = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)
REPARSE_NAME_SURROGATE = 0x20000000


def path_redirects(path: Path) -> bool:
    """Detect symlinks and Windows junction/reparse points without following them."""
    try:
        info = os.lstat(path)
    except FileNotFoundError:
        return False
    except OSError as error:
        raise SetupError("Não foi possível validar um caminho; nenhum arquivo foi escrito.") from error
    if stat.S_ISLNK(info.st_mode):
        return True
    if not getattr(info, "st_file_attributes", 0) & REPARSE_POINT:
        return False
    tag = getattr(info, "st_reparse_tag", None)
    # Python 3.10+ exposes the tag on Windows. Name-surrogate tags include
    # junctions and symlinks; cloud placeholders such as OneDrive do not.
    return True if tag is None else bool(tag & REPARSE_NAME_SURROGATE)


def allowed_system_alias(path: Path) -> bool:
    """Allow only the fixed root aliases shipped by macOS."""
    if sys.platform != "darwin":
        return False
    expected = {
        Path("/tmp"): Path("/private/tmp"),
        Path("/var"): Path("/private/var"),
        Path("/etc"): Path("/private/etc"),
    }.get(path)
    if expected is None:
        return False
    try:
        return path.resolve(strict=True) == expected
    except (OSError, RuntimeError):
        return False


def path_within(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        pass
    try:
        root_stat = os.stat(root)
    except OSError:
        return False
    current = path
    while True:
        try:
            if os.path.samestat(os.stat(current), root_stat):
                return True
        except OSError:
            pass
        parent = current.parent
        if parent == current:
            return False
        current = parent


def safe_executable_path(root: Path) -> str:
    """Keep only absolute PATH entries outside the inspected project."""
    root_lexical = Path(os.path.abspath(root))
    try:
        root_resolved = root.resolve(strict=False)
    except (OSError, RuntimeError) as error:
        raise SetupError("Não foi possível validar o caminho do projeto.") from error
    entries = []
    for raw in os.environ.get("PATH", "").split(os.pathsep):
        entry = Path(raw).expanduser()
        if not raw or not entry.is_absolute():
            continue
        lexical = Path(os.path.abspath(entry))
        try:
            resolved = entry.resolve(strict=False)
        except (OSError, RuntimeError):
            continue
        if path_within(lexical, root_lexical) or path_within(resolved, root_resolved):
            continue
        value = str(resolved)
        if value not in entries:
            entries.append(value)
    return os.pathsep.join(entries)


def executable_names(name: str, *, windows: bool | None = None) -> tuple[str, ...]:
    """Return executable file names without shell-backed Windows scripts."""
    windows = os.name == "nt" if windows is None else windows
    if not windows:
        return (name,)
    extensions = []
    for raw in os.environ.get("PATHEXT", "").split(";"):
        extension = raw.strip().upper()
        if extension in {".EXE", ".COM"} and extension not in extensions:
            extensions.append(extension)
    for fallback in (".EXE", ".COM"):
        if fallback not in extensions:
            extensions.append(fallback)
    return tuple(name + extension for extension in extensions)


def program_from_path(name: str, executable_path: str, root: Path) -> Path | None:
    """Resolve a program only from explicit, already-filtered PATH entries."""
    try:
        root_resolved = root.resolve(strict=False)
    except (OSError, RuntimeError) as error:
        raise SetupError("Não foi possível validar o caminho do projeto.") from error
    for raw in executable_path.split(os.pathsep):
        if not raw:
            continue
        directory = Path(raw)
        for filename in executable_names(name):
            candidate = directory / filename
            try:
                if not candidate.is_file():
                    continue
                if os.name != "nt" and not os.access(candidate, os.X_OK):
                    continue
                resolved = candidate.resolve(strict=True)
            except (OSError, RuntimeError):
                continue
            if path_within(resolved, root_resolved):
                continue
            return resolved
    return None


def git_program(root: Path) -> tuple[str, str] | None:
    executable_path = safe_executable_path(root)
    candidate = program_from_path("git", executable_path, root)
    if candidate is None:
        return None
    return str(candidate), executable_path


def project_root(value: str | Path) -> Path:
    path = Path(value).expanduser()
    if ".." in path.parts:
        raise SetupError("O caminho do projeto não pode conter '..'.")
    path = path.absolute()
    for item in (path, *path.parents):
        if path_redirects(item) and not allowed_system_alias(item):
            raise SetupError("O caminho do projeto não pode atravessar links ou pontos de redirecionamento.")
    try:
        path = path.resolve(strict=False)
    except (OSError, RuntimeError) as error:
        raise SetupError("Não foi possível validar o caminho do projeto.") from error
    for item in (path, *path.parents):
        if path_redirects(item):
            raise SetupError("O caminho do projeto não pode atravessar links ou pontos de redirecionamento.")
    if path.exists() and not path.is_dir():
        raise SetupError("O alvo do projeto precisa ser um diretório.")
    return path


def relative_path(value: str, label: str = "path") -> str:
    if not isinstance(value, str) or not value or "\\" in value or "\x00" in value:
        raise SetupError(f"{label}: caminho relativo inválido.")
    path = PurePosixPath(value)
    if path.is_absolute() or ".." in path.parts or value != str(path):
        raise SetupError(f"{label}: caminho relativo inválido.")
    if path.parts and path.parts[0] == ".git":
        raise SetupError(f"{label}: metadados Git não são um componente.")
    return value


def safe_target(root: Path, relative: str) -> Path:
    relative_path(relative)
    target = root / relative
    for item in (target, *target.parents):
        if item == root.parent:
            break
        if path_redirects(item):
            raise SetupError("Um destino de geração atravessa link ou ponto de redirecionamento; nenhum arquivo foi escrito.")
        if item != target and item.exists() and not item.is_dir():
            raise SetupError("Um diretório de destino é arquivo; nenhum arquivo foi escrito.")
    if target.exists() and not target.is_file():
        raise SetupError("Um arquivo de destino é diretório; nenhum arquivo foi escrito.")
    try:
        target.resolve(strict=False).relative_to(root.resolve(strict=False))
    except (OSError, RuntimeError, ValueError):
        raise SetupError("Um destino de geração sai da raiz do projeto; nenhum arquivo foi escrito.") from None
    return target


def ancestor_git(root: Path) -> bool:
    return any((parent / ".git").exists() or path_redirects(parent / ".git") for parent in root.parents)


def clean_text(value: object, label: str, *, nullable: bool = False) -> str | None:
    if value is None and nullable:
        return None
    if not isinstance(value, str) or not value.strip():
        raise SetupError(f"{label}: informe texto específico do projeto ou null quando permitido.")
    value = value.strip()
    if any(ord(char) < 32 and char not in "\n\t" for char in value):
        raise SetupError(f"{label}: caracteres de controle não são permitidos.")
    if re.search(r"\{\{.*?\}\}|<[^>\n]+>|\b(?:TODO|TBD|FIXME|PLACEHOLDER|CHANGEME)\b", value, re.I):
        raise SetupError(f"{label}: substitua os marcadores por fatos e próximas ações.")
    if re.search(r"(?:[A-Za-z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|PRIVATE_KEY)[A-Za-z0-9_]*)\s*[:=]\s*\S+", value, re.I):
        raise SetupError(f"{label}: valores de credenciais não são permitidos.")
    for match in re.finditer(r"[A-Za-z][A-Za-z0-9+.-]*://[^\s`]+", value):
        try:
            url = urlsplit(match.group())
        except ValueError:
            raise SetupError(f"{label}: URL inválida.") from None
        if url.username or url.password or url.query or url.fragment:
            raise SetupError(f"{label}: URL com credencial, query ou fragmento não é permitida.")
    return value


def object_keys(value: object, required: set[str], optional: set[str], label: str) -> dict:
    if not isinstance(value, dict) or required - value.keys() or value.keys() - required - optional:
        raise SetupError(f"{label}: campos ausentes ou extras; use o contrato documentado.")
    return value


def validate_brief(raw: object) -> dict:
    data = object_keys(raw, {"version", "name", "description", "stack", "components", "commands", "git", "workflow", "deployment"}, {"environment_variables"}, "brief")
    if type(data["version"]) is not int or data["version"] != 1:
        raise SetupError("brief.version precisa ser 1.")
    result = {"version": 1, "name": clean_text(data["name"], "name"), "description": clean_text(data["description"], "description")}
    if not isinstance(data["stack"], list):
        raise SetupError("stack precisa ser uma lista; use [] se ainda não definida.")
    result["stack"] = [clean_text(item, "stack") for item in data["stack"]]
    if not isinstance(data["components"], list):
        raise SetupError("components precisa ser uma lista.")
    result["components"] = []
    for item in data["components"]:
        item = object_keys(item, {"path", "purpose"}, set(), "component")
        result["components"].append({"path": relative_path(item["path"], "component.path"), "purpose": clean_text(item["purpose"], "component.purpose")})
    commands = object_keys(data["commands"], {"setup", "dev", "check", "build"}, set(), "commands")
    result["commands"] = {key: clean_text(value, f"commands.{key}", nullable=True) for key, value in commands.items()}
    git = object_keys(data["git"], {"default_branch", "remote", "provider"}, set(), "git")
    branch = clean_text(git["default_branch"], "git.default_branch")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._/-]*", branch) or ".." in branch or "//" in branch or branch.endswith(("/", ".lock", ".")):
        raise SetupError("git.default_branch: nome de branch inválido.")
    remote = clean_text(git["remote"], "git.remote", nullable=True)
    if remote is not None and not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", remote):
        raise SetupError("git.remote é um nome como origin, nunca uma URL.")
    result["git"] = {"default_branch": branch, "remote": remote, "provider": clean_text(git["provider"], "git.provider")}
    workflow = object_keys(data["workflow"], {"isolation", "merge"}, set(), "workflow")
    if workflow["isolation"] != "auto" or workflow["merge"] not in ("auto", "manual"):
        raise SetupError("workflow requer isolation=auto e merge=auto ou manual.")
    result["workflow"] = dict(workflow)
    deploy = object_keys(data["deployment"], {"status", "provider", "command"}, set(), "deployment")
    result["deployment"] = {key: clean_text(value, f"deployment.{key}", nullable=key != "status") for key, value in deploy.items()}
    variables = data.get("environment_variables", [])
    if not isinstance(variables, list) or any(not isinstance(item, str) or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", item) for item in variables):
        raise SetupError("environment_variables aceita somente uma lista de nomes, sem valores.")
    result["environment_variables"] = sorted(set(variables))
    return result


def git_read(root: Path, *args: str) -> str | None:
    located = git_program(root)
    if located is None:
        return None
    executable, executable_path = located
    env = {
        "PATH": executable_path,
        "LANG": os.environ.get("LANG", "C.UTF-8"),
        "LC_ALL": os.environ.get("LC_ALL", ""),
        "SYSTEMROOT": os.environ.get("SYSTEMROOT", ""),
        "TMPDIR": os.environ.get("TMPDIR", "/tmp"),
        "GIT_OPTIONAL_LOCKS": "0",
        "GIT_TERMINAL_PROMPT": "0",
        "GIT_NO_LAZY_FETCH": "1",
    }
    try:
        completed = subprocess.run(
            [executable, "-c", "core.fsmonitor=false", "-c", "core.hooksPath=" + os.devnull, "-c", "protocol.allow=never", "-C", str(root), *args],
            stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=15, check=False, env=env,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    return completed.stdout.decode("utf-8", errors="replace").strip() if completed.returncode == 0 else None


def remote_summary(raw: str) -> dict:
    """Never return remote userinfo, path, query, or fragment."""
    try:
        if "://" in raw:
            parsed = urlsplit(raw)
            return {"transport": parsed.scheme, "host": parsed.hostname}
        match = re.match(r"(?:[^@/:]+@)?([^/:]+):", raw)
        if match:
            return {"transport": "ssh", "host": match.group(1)}
    except ValueError:
        pass
    return {"transport": "local-or-unknown", "host": None}


def inspect_project(project: str | Path) -> dict:
    root = project_root(project)
    result = {"project": str(root), "exists": root.exists(), "names": [], "manifests": [], "package_managers": [], "runtimes": [], "nested_repositories": [], "symlinks": [], "inside_parent_repository": ancestor_git(root), "truncated": False, "git": {"present": False}}
    if not root.exists():
        return result
    manager_names, runtimes = set(), set()
    for current, dirs, files in os.walk(root, followlinks=False):
        dirs.sort()
        files.sort()
        current_path = Path(current)
        if current_path != root and (".git" in dirs or ".git" in files):
            result["nested_repositories"].append(current_path.relative_to(root).as_posix())
            dirs[:] = []
            continue
        for name in dirs + files:
            path = current_path / name
            relative = path.relative_to(root).as_posix()
            if name == ".git":
                continue
            result["names"].append(relative)
            if path_redirects(path):
                result["symlinks"].append(relative)
            elif name in MANIFEST_NAMES:
                result["manifests"].append(relative)
                runtimes.add(MANIFEST_NAMES[name])
            elif name in LOCK_NAMES:
                result["manifests"].append(relative)
                manager_names.add(LOCK_NAMES[name])
            if len(result["names"]) >= 2000:
                result["truncated"] = True
                break
        if result["truncated"]:
            break
        dirs[:] = [name for name in dirs if name not in SKIP_DIRS and not path_redirects(current_path / name)]
    result["package_managers"] = sorted(manager_names)
    result["runtimes"] = sorted(runtimes)
    if (root / ".git").exists() and not path_redirects(root / ".git"):
        top = git_read(root, "rev-parse", "--show-toplevel")
        if top and Path(top).resolve() == root.resolve():
            status = git_read(root, "status", "--porcelain=v1", "-z", "--untracked-files=normal", "--ignore-submodules=all")
            names = git_read(root, "remote") or ""
            remotes = []
            for name in names.splitlines():
                url = git_read(root, "remote", "get-url", name)
                if url:
                    remotes.append({"name": name, **remote_summary(url)})
            result["git"] = {"present": True, "branch": git_read(root, "symbolic-ref", "--quiet", "--short", "HEAD"), "head": git_read(root, "rev-parse", "--verify", "HEAD"), "dirty": None if status is None else bool(status), "remotes": remotes}
    return result


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def command_description(brief: dict, command: str) -> str:
    value = brief["commands"][command]
    if value:
        return f"```sh\n{value}\n```"
    actions = {"setup": "Verificar se o projeto exige instalação; se não exigir, registrar setup como não aplicável. Se exigir, documentar a instalação reproduzível existente.", "dev": "Definir e verificar como iniciar o projeto localmente.", "check": "Definir verificações de comportamento adequadas ao código existente e executá-las localmente.", "build": "Verificar se o projeto precisa gerar uma saída distribuível; quando não precisar, registrar build como não aplicável. Documentar um comando somente quando houver essa etapa."}
    return f"Não configurado. Próxima ação: {actions[command]}"


def task_source_path(explicit: str | Path | None) -> Path | None:
    if explicit is not None:
        source = project_root(explicit)
        if not source.exists():
            raise SetupError("A fonte explícita da skill task não existe.")
        return source
    skill_root = Path(__file__).resolve().parents[1]
    for source in (skill_root / "assets/task", skill_root.parent / "task"):
        if source.is_dir():
            return project_root(source)
    return None


def task_payload(explicit: str | Path | None) -> dict[str, bytes]:
    source = task_source_path(explicit)
    if source is None:
        return {}
    files = {}
    for relative in TASK_FILES:
        target = safe_target(source, relative)
        if not target.is_file():
            raise SetupError("A fonte da skill task está incompleta; nenhum arquivo foi escrito.")
        files[relative] = target.read_bytes()
    return files


def local_workflow(brief: dict) -> bool:
    return brief["git"]["remote"] is None or brief["git"]["provider"].lower() == "local"


def documents(brief: dict, payload: dict[str, bytes]) -> dict[str, bytes]:
    name, description = brief["name"], brief["description"]
    stack = ", ".join(brief["stack"]) or "Não definida. Próxima ação: escolher a menor stack que atende ao primeiro resultado do projeto."
    components = "\n".join(f"- `{item['path']}`: {item['purpose']}" for item in brief["components"]) or "Nenhum componente definido. Próxima ação: localizar ou criar a primeira unidade funcional antes de ampliar a estrutura."
    branch = brief["git"]["default_branch"]
    local = local_workflow(brief)
    remote = brief["git"]["remote"] or "não configurado; o trabalho permanece local"
    task_state = "instalada em `.agents/skills/task` e `.claude/skills/task`" if payload else "pendente; próxima ação: instalar uma fonte portátil completa de task com `--task-source`"
    command_sections = "\n\n".join(f"### {label}\n\n{command_description(brief, key)}" for key, label in (("setup", "Instalar"), ("dev", "Desenvolver"), ("check", "Verificar"), ("build", "Build")))
    ci = "CI remoto e proteção de branch não se aplicam enquanto o projeto permanecer local. Execute as verificações reais na própria máquina e registre seus resultados no encerramento da tarefa." if local else ("CI não configurado por este gerador. Próxima ação: verificar o provedor e a automação existente, preparar o runtime real e executar o comando de check declarado em um PR antes de torná-lo obrigatório." if brief["commands"]["check"] else "CI de comportamento pendente porque não há comando de check definido. Próxima ação: implementar verificações adequadas ao primeiro código; não declarar verde um teste inexistente.")
    branch_rule = "Integre as branches locais somente após a validação e conforme a política de merge; preserve arquivos locais e mudanças de outras tarefas." if local else "Não faça push direto nela após o bootstrap; preserve arquivos locais e mudanças de outras tarefas."
    inspect_rule = "Consulte Git, worktrees e alterações. Continue a branch da mesma tarefa quando houver evidência" if local else "Consulte Git, worktrees, alterações e PRs. Continue a branch/PR da mesma tarefa quando houver evidência"
    integration_rule = "depois registre cada entrega por commit e integre a branch local conforme a autorização" if local else "depois use PR para integrar mudanças"
    contribution_result = "Registre objetivo, validação executada e limitações na entrega por commit." if local else "Abra PR com objetivo, validação executada e limitações."
    merge_rule = "Em `auto`, integre a branch local após os checks; em `manual`, deixe commits prontos e aguarde a decisão de integração. Preserve checkouts ocupados por outras sessões e o histórico existente." if local else "Em `auto`, integre ajustes técnicos autorizados após checks e proteções; em `manual`, deixe PR pronto e aguarde a decisão de integração. Nunca use bypass, force push ou reduza proteções para concluir."
    remote_rule = "A entrega ocorre por commit e integração local. Criar remoto, PR ou automação externa depende de uma necessidade e pedido posteriores." if local else "Proteção da base não verificada pelo gerador. Próxima ação: verificar recursos do plano/provedor; exigir PR e checks reais, impedir force push/exclusão, sem exigir aprovação de uma segunda pessoa inexistente. Se o plano não suportar a regra, registre o limite."
    operational_rule = f"Confirme a base local `{branch}` e as evidências de validação antes de integrar. Não há etapa remota obrigatória no contrato atual." if local else f"O gerador não cria remoto nem configura proteção. Verifique remoto `{remote}`, base `{branch}` e permissões do provedor. Registre checks obrigatórios somente depois de emitidos com sucesso."
    deploy_provider = brief["deployment"]["provider"] or "não configurado; nenhum destino externo está definido no contrato atual"
    deploy_command = brief["deployment"]["command"] or "não configurado; publicação não é uma etapa obrigatória enquanto não fizer parte do objetivo"
    config = dict(brief)
    operational_state = "not_applicable_local" if local else "pending_verification"
    config["setup"] = {"task_skill": "installed" if payload else "pending", "ci": operational_state, "branch_protection": operational_state}
    texts = {
        "README.md": f"# {name}\n\n{description}\n\n## Estado atual\n\nStack: {stack}\n\n{components}\n\n{command_sections}\n\n## Trabalhar com agentes\n\nUse `setup-projeto` para preparar ou conciliar o repositório e `task` para descrever a mudança desejada. A forma de invocar depende do cliente: `/setup-projeto`, `$setup-projeto` ou menção pelo nome; `@` depende da interface. A skill task está {task_state}. Leia [CONTRIBUTING.md](CONTRIBUTING.md) para o fluxo e [docs/development.md](docs/development.md) para pendências operacionais.\n",
        "CONTRIBUTING.md": f"# Desenvolvimento de {name}\n\nO objetivo é {description}\n\n1. Descreva o resultado observável e o critério de término. Uma issue é opcional; uma mudança coerente é uma tarefa.\n2. {inspect_rule}; uma tarefa diferente recebe branch própria. Use a pasta atual se limpa e exclusiva; use outra worktree quando houver concorrência, alterações alheias ou propriedade incerta.\n3. Base declarada: `{branch}`. Remoto: `{remote}`. Provedor declarado: {brief['git']['provider']}. Confirme esses fatos no repositório antes de operar. Um repositório sem commits pode receber o commit inicial autorizado; {integration_rule}.\n4. Mantenha alterações e commits delimitados. Confira o diff e adicione caminhos explícitos. {contribution_result}\n5. Valide com os comandos documentados e checks reais da área. Sincronize a base e revalide se mudanças afetarem a entrega.\n6. Política de merge: `{brief['workflow']['merge']}`. {merge_rule}\n7. Confirme merge, SHA e deploy aplicável antes de encerrar. Preserve a pasta ativa; remova somente worktrees criadas pela própria tarefa, após confirmar ausência de trabalho restante.\n\n## Integração e validação\n\n{ci}\n\n{remote_rule}\n\nLeia [docs/development.md](docs/development.md) para comandos e [docs/architecture.md](docs/architecture.md) antes de ampliar a estrutura.\n",
        ".gitignore": "# Credenciais e estado local\n.env\n.env.*\n!.env.example\n*.pem\n*.key\n.DS_Store\n# Dependências e saídas locais comuns\nnode_modules/\n.venv/\n__pycache__/\n*.pyc\n.next/\ncoverage/\n# Estado de geração (local por checkout)\n.setup-projeto/\n",
        ".env.example": (f"# Variáveis de {name}. Preencha valores somente no arquivo local .env.\n" + "\n".join(f"{variable}=" for variable in brief["environment_variables"]) + "\n") if brief["environment_variables"] else f"# {name}: nenhuma variável de ambiente foi declarada.\n# Próxima ação: documentar apenas os nomes exigidos pelo código quando existirem.\n",
        ".agent-project.json": json.dumps(config, ensure_ascii=False, indent=2) + "\n",
        "docs/architecture.md": f"# Arquitetura de {name}\n\n{description}\n\n## Estrutura atual\n\nStack: {stack}\n\n{components}\n\nEsta descrição registra somente a estrutura informada no briefing. Confirme-a nos arquivos antes de editar; o gerador não cria componentes de aplicação nem move código existente.\n\n## Como ampliar\n\nComece pelo menor componente capaz de entregar o resultado. Separe módulos quando existir responsabilidade distinta, dependência conflitante ou mudança recorrente que justifique a fronteira. Acrescente documentação local quando a área tiver comandos ou limites próprios; preserve instruções nativas já existentes.\n\nRegistre decisões com alternativas e motivo quando forem difíceis de reverter. Introduza pacote, serviço, banco, fila ou microserviço somente com uma necessidade demonstrada e uma forma de operá-lo. Atualize este mapa junto da mudança de estrutura, no mesmo commit ou PR da entrega.\n",
        "docs/development.md": f"# Operação de desenvolvimento: {name}\n\n## Comandos declarados\n\nOs comandos abaixo vieram do briefing; este gerador não os executa. O agente deve confirmar os arquivos que os definem e registrar o resultado de sua execução.\n\n{command_sections}\n\n## Agentes\n\n`CONTRIBUTING.md` e `.agent-project.json` registram o contrato compartilhado. As cópias locais de task atendem Codex e Claude Code; Hermes e outros clientes devem usar sua instalação de skills documentada, apontando para a mesma versão. Arquivos nativos já existentes são preservados. Nenhum daemon ou conta de bot é exigido. Task: {task_state}.\n\n## CI e integração\n\n{ci}\n\n{operational_rule}\n\n## Deploy\n\nEstado declarado: {brief['deployment']['status']}.\n\nProvedor: {deploy_provider}.\n\nComando: {deploy_command}.\n\nNenhum deploy foi executado por este gerador. Merge, build, preview e confirmação em produção são estados distintos.\n\n## Evolução\n\nAdicione testes de comportamento conforme os fluxos reais, scripts reproduzíveis quando uma rotina se repetir e documentação local quando uma área crescer. Antes de reestruturar um projeto existente, inventarie arquivos e preserve trabalho não integrado. Evite criar camadas ou serviços sem uma necessidade observada.\n",
        ".github/pull_request_template.md": "## Resultado\n\nDescreva o problema observado e o comportamento entregue.\n\n## Validação\n\nRegistre os comandos executados e resultados; explique qualquer verificação pendente.\n\n## Integração\n\nInforme dependências, mudança de configuração ou migração, quando houver. Registre o estado real de deploy se aplicável.\n",
    }
    if brief["git"]["provider"].lower() != "github":
        texts.pop(".github/pull_request_template.md")
    result = {relative: content.encode("utf-8") for relative, content in texts.items()}
    for relative, data in payload.items():
        for destination in (".agents/skills/task", ".claude/skills/task"):
            result[f"{destination}/{relative}"] = data
    return result


def load_manifest(root: Path) -> dict:
    path = safe_target(root, MANIFEST)
    if not path.exists():
        return {}
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (ValueError, UnicodeError):
        raise SetupError("Manifesto de geração inválido; preserve-o para conciliação manual.") from None
    object_keys(value, {"version", "files"}, set(), "manifest")
    if value["version"] != 1 or not isinstance(value["files"], dict):
        raise SetupError("Manifesto de geração inválido.")
    for relative, saved in value["files"].items():
        relative_path(relative, "manifest.path")
        if not isinstance(saved, str) or not re.fullmatch(r"[0-9a-f]{64}", saved):
            raise SetupError("Manifesto contém hash inválido.")
    return value["files"]


def write_atomic(root: Path, relative: str, data: bytes) -> None:
    path = safe_target(root, relative)
    path.parent.mkdir(parents=True, exist_ok=True)
    path = safe_target(root, relative)
    descriptor, temporary = tempfile.mkstemp(prefix=".setup-write-", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(data)
        path = safe_target(root, relative)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def render_project(project: str | Path, brief: dict, *, task_source: str | Path | None = None, apply: bool = False) -> dict:
    root = project_root(project)
    normalized = validate_brief(brief)
    if ancestor_git(root):
        raise SetupError("O alvo está dentro de outro repositório Git; escolha sua raiz ou um projeto separado.")
    payload = task_payload(task_source)
    generated = documents(normalized, payload)
    # O manifesto é um recibo local, não autoridade para sobrescrever arquivos.
    load_manifest(root)
    plans, snapshots = [], {}
    for relative, content in generated.items():
        path = safe_target(root, relative)
        current = path.read_bytes() if path.exists() else None
        snapshots[relative] = current
        if current is None:
            action = "create"
        elif current == content:
            action = "unchanged"
        else:
            action = "conflict"
        plans.append({"path": relative, "action": action})
    conflicts = [item["path"] for item in plans if item["action"] == "conflict"]
    result = {"project": str(root), "mode": "apply" if apply else "dry-run", "files": plans, "conflicts": conflicts, "applied": False, "ready": False, "pending": ["Confirmar comandos declarados no ambiente real.", "Verificar ou configurar CI e proteção da base no provedor."]}
    if local_workflow(normalized):
        result["pending"] = ["Confirmar comandos e critérios de validação local no ambiente real."]
    if not payload:
        result["pending"].append("Instalar a skill task portátil com --task-source.")
    if conflicts:
        result["pending"].append("Conciliar os arquivos em conflito com patch revisado; nenhum arquivo deste lote foi escrito.")
        return result
    if apply:
        # Recheck all destinations after planning, before any directory creation.
        # Callers must still ensure exclusive ownership: this is not a cross-agent lock.
        for relative, current in snapshots.items():
            path = safe_target(root, relative)
            if (path.read_bytes() if path.exists() else None) != current:
                raise SetupError("Um destino mudou durante o planejamento; nenhum arquivo foi escrito.")
        root.mkdir(parents=True, exist_ok=True)
        for item in plans:
            if item["action"] != "unchanged":
                write_atomic(root, item["path"], generated[item["path"]])
        generated_hashes = {relative: digest(data) for relative, data in generated.items()}
        manifest_data = (json.dumps({"version": 1, "files": generated_hashes}, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
        manifest_path = safe_target(root, MANIFEST)
        if not manifest_path.exists() or manifest_path.read_bytes() != manifest_data:
            write_atomic(root, MANIFEST, manifest_data)
        result["applied"] = True
    result["documents_ready"] = bool(payload) and not conflicts
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    inspect_parser = commands.add_parser("inspect", help="Listar nomes e metadados sem ler conteúdo do projeto")
    inspect_parser.add_argument("--project", required=True)
    render_parser = commands.add_parser("render", help="Gerar plano de documentos; escrita somente com --apply")
    render_parser.add_argument("--project", required=True)
    render_parser.add_argument("--brief", required=True, help="Arquivo JSON do briefing validado")
    render_parser.add_argument("--task-source")
    render_parser.add_argument("--apply", action="store_true")
    args = parser.parse_args(argv)
    try:
        if args.command == "inspect":
            result = inspect_project(args.project)
        else:
            try:
                raw = json.loads(Path(args.brief).read_text(encoding="utf-8"))
            except (OSError, ValueError, UnicodeError):
                raise SetupError("Não foi possível ler o briefing JSON; confira arquivo e sintaxe sem expor valores.") from None
            result = render_project(args.project, raw, task_source=args.task_source, apply=args.apply)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 2 if result.get("conflicts") else 0
    except (SetupError, OSError) as error:
        message = str(error) if isinstance(error, SetupError) else "Falha de acesso ao sistema de arquivos; nenhuma credencial foi exibida."
        print(json.dumps({"error": message}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
