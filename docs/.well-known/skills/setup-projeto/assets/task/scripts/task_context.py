#!/usr/bin/env python3
"""Planeja o isolamento de uma tarefa usando apenas evidências locais e explícitas.

Não cria branches, não muda arquivos, não executa helpers e não acessa a rede.
As recomendações são condicionais: o agente deve ler os contratos e conferir PRs
e a base remota antes de executar uma alteração.
"""

import argparse
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
from urllib.parse import urlsplit, urlunsplit


class InspectionError(Exception):
    """Erro seguro: nunca inclui stderr do Git ou conteúdo de configuração."""


REPARSE_POINT = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)
REPARSE_NAME_SURROGATE = 0x20000000


def path_redirects(path):
    try:
        info = os.lstat(path)
    except FileNotFoundError:
        return False
    except OSError as exc:
        raise InspectionError("Não foi possível validar um caminho local.") from exc
    if stat.S_ISLNK(info.st_mode):
        return True
    if not getattr(info, "st_file_attributes", 0) & REPARSE_POINT:
        return False
    tag = getattr(info, "st_reparse_tag", None)
    return True if tag is None else bool(tag & REPARSE_NAME_SURROGATE)


def safe_resolve(path, *, strict=False):
    try:
        return Path(path).resolve(strict=strict)
    except (OSError, RuntimeError) as exc:
        raise InspectionError("Não foi possível validar um caminho local.") from exc


def path_within(path, root):
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


def repository_root_hint(path):
    current = Path(path).absolute()
    for candidate in (current, *current.parents):
        marker = candidate / ".git"
        if marker.exists() or path_redirects(marker):
            return candidate
    return current


def safe_executable_path(root):
    root_lexical = Path(os.path.abspath(root))
    try:
        root_resolved = root.resolve(strict=False)
    except (OSError, RuntimeError) as exc:
        raise InspectionError("Não foi possível validar o caminho local.") from exc
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


def executable_names(name, windows=None):
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


def program_from_path(name, executable_path, root):
    try:
        root_resolved = root.resolve(strict=False)
    except (OSError, RuntimeError) as exc:
        raise InspectionError("Não foi possível validar o caminho local.") from exc
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


def git_program(path):
    root = repository_root_hint(path)
    executable_path = safe_executable_path(root)
    candidate = program_from_path("git", executable_path, root)
    if candidate is None:
        raise InspectionError("Git não foi encontrado fora da pasta do projeto.")
    return str(candidate), executable_path


def git(path, *args, required=True):
    executable, executable_path = git_program(path)
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
        result = subprocess.run(
            [executable, "--no-optional-locks", "-c", "core.fsmonitor=false",
             "-c", "core.hooksPath=" + os.devnull, "-c", "protocol.allow=never",
             "-C", str(path), *args],
            stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
            stderr=subprocess.PIPE, env=env, check=False, timeout=30,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise InspectionError("Não foi possível executar a inspeção local do Git.") from exc
    if result.returncode:
        if required:
            raise InspectionError("O Git recusou uma etapa de inspeção local; nenhum arquivo foi alterado.")
        return None
    return result.stdout.decode("utf-8", errors="replace").rstrip("\n")


def safe_remote(value):
    """Exibe a localização sem usuário, senha, query ou fragmento de autenticação."""
    if not value:
        return None
    if "://" in value:
        try:
            parsed = urlsplit(value)
            if parsed.scheme not in ("https", "http", "ssh", "git") or not parsed.hostname:
                return "<remote omitido>"
            host = parsed.hostname
            if ":" in host:
                host = "[" + host + "]"
            if parsed.port:
                host += ":" + str(parsed.port)
            return urlunsplit((parsed.scheme, host, parsed.path, "", ""))
        except ValueError:
            return "<remote omitido>"
    scp = re.fullmatch(r"(?:[^/@:\s]+@)?([A-Za-z0-9.-]+):([^\s?#]+)(?:[?#].*)?", value)
    if scp:
        return scp.group(1) + ":" + scp.group(2)
    return "<caminho local ou remote não convencional>"


def config_at(root):
    target = root / ".agent-project.json"
    if not target.exists() and not path_redirects(target):
        return {}, []
    if path_redirects(target):
        return {}, [".agent-project.json redireciona para outro caminho; seu destino não foi lido."]
    try:
        if target.stat().st_size > 256_000:
            raise ValueError
        config = json.loads(target.read_text(encoding="utf-8"))
        if not isinstance(config, dict) or config.get("version") != 1:
            raise ValueError
        if not isinstance(config.get("git", {}), dict):
            raise ValueError
        return config, []
    except (OSError, ValueError, UnicodeError):
        return {}, [".agent-project.json inválido ou com versão não suportada; corrija o contrato antes de editar."]


def branch_is_valid(root, name):
    return isinstance(name, str) and git(root, "check-ref-format", "refs/heads/" + name, required=False) is not None


def default_branch(root, config):
    selected = config.get("git", {}).get("default_branch")
    if selected is not None:
        if not branch_is_valid(root, selected):
            raise InspectionError("git.default_branch não contém um nome válido de branch.")
        return selected, ".agent-project.json"
    symbolic = None
    if config.get("git", {}).get("remote", "origin") is not None:
        symbolic = git(root, "symbolic-ref", "--quiet", "refs/remotes/origin/HEAD", required=False)
    if symbolic and symbolic.startswith("refs/remotes/origin/"):
        return symbolic[len("refs/remotes/origin/"):], "refs/remotes/origin/HEAD"
    for candidate in ("main", "master"):
        if git(root, "show-ref", "--verify", "--quiet", "refs/heads/" + candidate, required=False) is not None:
            return candidate, "branch local"
    return None, "não identificada"


def worktrees_at(root):
    raw = git(root, "worktree", "list", "--porcelain", "-z")
    found = []
    for block in raw.split("\0\0"):
        if not block:
            continue
        entry = {}
        for item in block.split("\0"):
            key, _, value = item.partition(" ")
            if key == "worktree":
                entry["path"] = value
            elif key == "HEAD":
                entry["head"] = value
            elif key == "branch":
                entry["branch"] = value.removeprefix("refs/heads/")
            elif key in ("detached", "locked", "prunable", "bare"):
                entry[key] = True
        if "path" in entry:
            entry["current"] = safe_resolve(entry["path"]) == root
            found.append(entry)
    return found


def status_at(root):
    raw = git(root, "status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignore-submodules=all")
    fields = iter(raw.split("\0"))
    entries = []
    for field in fields:
        if not field:
            continue
        code, path = field[:2], field[3:]
        entry = {"status": code, "path": path}
        if "R" in code or "C" in code:
            entry["original_path"] = next(fields, "")
        entries.append(entry)
    return {"clean": not entries, "entries": entries,
            "unmerged": any(e["status"] in ("DD", "AU", "UD", "UA", "DU", "AA", "UU") for e in entries)}


def inspect(path):
    path = safe_resolve(Path(path).expanduser())
    if path.is_file():
        path = path.parent
    inside = git(path, "rev-parse", "--is-inside-work-tree", required=False)
    if inside != "true":
        return None, []
    root = safe_resolve(git(path, "rev-parse", "--show-toplevel"))
    config, warnings = config_at(root)
    base, source = default_branch(root, config)
    remote_name = config.get("git", {}).get("remote", "origin")
    if remote_name is not None and (not isinstance(remote_name, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", remote_name)):
        raise InspectionError("git.remote deve ser null ou o nome de um remote, por exemplo origin; não uma URL.")
    remote = git(root, "remote", "get-url", remote_name, required=False) if remote_name else None
    refs_raw = git(root, "for-each-ref", "--format=%(refname) %(objectname)", "refs/heads/", "refs/remotes/")
    refs = dict(line.split(" ", 1) for line in refs_raw.splitlines() if " " in line)
    # Prefira o último retrato remoto disponível. Não afirme que ele está atualizado.
    candidates = ([f"refs/remotes/{remote_name}/{base}"] if remote_name and base else [])
    if base:
        candidates.append(f"refs/heads/{base}")
    base_ref = next((ref for ref in candidates if ref in refs), None)
    current = git(root, "symbolic-ref", "--quiet", "--short", "HEAD", required=False)
    head = git(root, "rev-parse", "--verify", "HEAD", required=False)
    git_dir = safe_resolve(git(root, "rev-parse", "--absolute-git-dir"))
    common_dir = Path(git(root, "rev-parse", "--git-common-dir"))
    if not common_dir.is_absolute():
        common_dir = root / common_dir
    common_dir = safe_resolve(common_dir)
    contract_paths = [name for name in ("CONTRIBUTING.md",) if (root / name).is_file()]
    has_helper = bool(contract_paths) and (root / "scripts/agent_work.py").is_file()
    # Só presença de marcadores; não leia mensagens, patches ou arquivos da operação.
    operation_markers = {
        "MERGE_HEAD": "merge", "rebase-merge": "rebase", "rebase-apply": "rebase/apply",
        "CHERRY_PICK_HEAD": "cherry-pick", "REVERT_HEAD": "revert",
        "sequencer": "sequencer", "BISECT_LOG": "bisect",
    }
    operations = sorted({operation for marker, operation in operation_markers.items()
                         if (git_dir / marker).exists() or path_redirects(git_dir / marker)})
    return {
        "root": str(root), "branch": current, "head": head,
        "linked_worktree": git_dir != common_dir,
        "default_branch": base, "default_branch_source": source,
        "base_ref": base_ref, "base_commit": refs.get(base_ref),
        "remote_name": remote_name, "remote": safe_remote(remote),
        "remote_verified": False, "status": status_at(root), "operations_in_progress": operations,
        "worktrees": worktrees_at(root),
        "refs": {name: oid for name, oid in refs.items() if name.startswith("refs/heads/") or name == base_ref},
        "contracts": contract_paths, "helper_contract": has_helper,
    }, warnings


def plan(args):
    try:
        repo, warnings = inspect(args.path)
    except InspectionError as exc:
        if args.intent != "inspect":
            raise
        repo, warnings = None, [str(exc)]
    output = {
        "version": 1, "read_only": True, "action": None, "reasons": [],
        "repository": repo, "warnings": warnings,
        "evidence": {"intent": args.intent, "same_task": args.same_task,
                     "resume_branch": args.resume_branch, "pr_state": args.pr_state,
                     "exclusive_checkout": args.exclusive_checkout,
                     "adopt_current_work": args.adopt_current_work,
                     "app_worktree": args.app_worktree},
        "verification_required": [],
    }

    def recommend(action, reason, **details):
        output.update(action=action, reasons=[reason], **details)
        return output

    if args.intent == "inspect":
        return recommend("none", "Consulta: não precisa criar branch ou worktree.")
    if repo is None:
        return recommend("needs_setup", "O caminho não pertence a uma pasta de trabalho Git; execute setup-projeto.")
    output["verification_required"] = [
        "Leia CONTRIBUTING.md, as instruções carregadas pelo cliente e os contratos da área antes de editar.",
    ]
    if repo["remote"]:
        output["verification_required"].extend([
            "Confira a base remota antes de criar ou integrar trabalho: esta inspeção não executa fetch.",
            "Confira PRs remotos, estado e autoria antes de retomar ou abrir uma tarefa; flags são evidência declarada pelo agente.",
        ])
    else:
        output["verification_required"].append(
            "Confira a base local e a propriedade da tarefa; não há remoto a consultar nem PR obrigatório neste modo."
        )
    if repo["helper_contract"]:
        return recommend(
            "repository_contract", "O repositório possui contrato e scripts/agent_work.py; siga esse contrato, que prevalece sobre a estratégia genérica.",
            delegate={"helper": "scripts/agent_work.py", "next_step": "Leia os contratos e inspecione status/reservas pelo helper antes de escolher start, adopt ou retomada."},
        )
    if warnings:
        return recommend("needs_setup", "O contrato de projeto precisa ser corrigido antes de decidir o isolamento.")
    base = repo["default_branch"]
    branch = repo["branch"]
    if not repo["head"]:
        return recommend("needs_setup", "O repositório ainda não tem commit inicial; conclua o bootstrap antes de abrir uma worktree.")
    if repo["status"]["unmerged"] or repo["operations_in_progress"]:
        return recommend("needs_coordination", "Há conflitos ou uma operação Git em andamento. Identifique a tarefa responsável e resolva ou continue essa operação antes de criar branch; preserve os arquivos.")
    resume = args.resume_branch
    prior_task_closed = args.pr_state in ("merged", "closed")
    if resume and not branch_is_valid(Path(repo["root"]), resume):
        raise InspectionError("--resume-branch não contém um nome válido de branch.")
    if args.same_task and resume and resume != base and not prior_task_closed:
        if "refs/heads/" + resume in repo["refs"]:
            existing = next((w for w in repo["worktrees"] if w.get("branch") == resume), None)
            if existing and (existing.get("locked") or existing.get("prunable")):
                return recommend("new_worktree", "A pasta da tarefa está bloqueada ou indisponível; preserve-a e resolva sua propriedade antes de retomar.")
            return recommend(
                "resume", "A mesma tarefa e sua branch foram declaradas explicitamente; reutilize a branch e preserve seus arquivos.",
                resume={"branch": resume, "worktree": existing.get("path") if existing else None,
                        "worktree_action": "reuse" if existing else "create_for_existing_branch"},
            )
    if prior_task_closed:
        output["warnings"].append("O PR informado foi integrado ou encerrado; sua branch não será retomada. A nova tarefa seguirá o estado atual da pasta.")
    if args.adopt_current_work and args.exclusive_checkout and branch == base and not repo["status"]["clean"]:
        return recommend(
            "new_branch", "Todo o diff e os arquivos novos foram atribuídos explicitamente a esta tarefa, em pasta exclusiva na branch base. Crie uma nova branch no HEAD atual, preservando o trabalho pendente sem trocar arquivos ou base.",
            start_ref="HEAD", preserve_work=True,
        )
    if not prior_task_closed and (args.same_task or resume):
        return recommend("new_worktree", "A retomada não foi comprovada: forneça --same-task e uma --resume-branch local correspondente, sem reutilizar a branch principal.")
    if not repo["status"]["clean"]:
        return recommend("new_worktree", "Há alterações locais sem atribuição explícita à mesma tarefa; preserve esta pasta.")
    if not base or not repo["base_commit"] or not repo["head"]:
        return recommend("needs_setup", "A branch base ou seu commit inicial não foi identificado; conclua o setup do repositório.")
    fresh = repo["head"] == repo["base_commit"]
    if branch is None:
        if args.app_worktree and repo["linked_worktree"] and fresh:
            return recommend("adopt_branch", "Worktree do aplicativo declarada, limpa, vinculada e no commit base local: crie apenas a branch nessa pasta.")
        return recommend("new_worktree", "HEAD destacado sem comprovação de worktree do aplicativo limpa e na base atual; preserve a pasta existente.")
    other_worktrees = [w for w in repo["worktrees"] if not w["current"]]
    if branch == base and fresh and args.exclusive_checkout and not other_worktrees:
        return recommend("new_branch", "Pasta declarada exclusiva, limpa, na branch base e sem outras worktrees: uma nova branch na mesma pasta atende ao trabalho sequencial.")
    if other_worktrees:
        return recommend("new_worktree", "Existem outras worktrees; isole a nova tarefa e confira sobreposição de escopo antes de editar.")
    if branch != base:
        return recommend("new_worktree", "A branch atual pertence a trabalho não identificado como esta tarefa; não infira propriedade pelo nome.")
    if not fresh:
        return recommend("new_worktree", "A pasta atual diverge do commit base conhecido; preserve seus commits e confira a base remota.")
    return recommend("new_worktree", "A exclusividade da pasta não foi declarada; preserve o checkout e isole a nova tarefa.")


def parser():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--path", default=".", help="Pasta do projeto ou arquivo dentro dela (padrão: pasta atual).")
    cli.add_argument("--intent", choices=("inspect", "change"), default="change", help="inspect é consulta; change planeja alteração (padrão).")
    cli.add_argument("--same-task", action="store_true", help="Afirma, com base na conversa/PR, que a branch informada e seu trabalho pendente pertencem à mesma tarefa. Não deduza pelo nome.")
    cli.add_argument("--resume-branch", help="Branch local cuja propriedade foi comprovada; use junto de --same-task. O agente ainda verifica o PR remoto.")
    cli.add_argument("--pr-state", choices=("unknown", "draft", "open", "merged", "closed"), default="unknown", help="Estado de PR já verificado pelo agente; nenhum PR é consultado por este script.")
    cli.add_argument("--exclusive-checkout", action="store_true", help="Afirma que nenhum outro agente usa esta pasta e que o trabalho será sequencial; permite nova branch na base limpa.")
    cli.add_argument("--adopt-current-work", action="store_true", help="Afirma, após conferir a conversa e o diff, que TODAS as alterações staged/unstaged e arquivos novos pertencem a esta tarefa. Junto de --exclusive-checkout, permite nova branch no HEAD atual da base, preservando o trabalho. Não infira propriedade pelo nome; não transporta nem faz commit dos arquivos.")
    cli.add_argument("--app-worktree", action="store_true", help="Afirma que esta worktree vinculada foi criada para a tarefa pelo aplicativo; permite adotar HEAD destacado limpo na base.")
    return cli


def main(argv=None):
    args = parser().parse_args(argv)
    try:
        result = plan(args)
    except InspectionError as exc:
        print(json.dumps({"version": 1, "read_only": True, "action": "inspection_error", "error": str(exc)}, ensure_ascii=False))
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
