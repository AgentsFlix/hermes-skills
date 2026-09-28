#!/usr/bin/env python3
"""Registro privado e auditoria local. Não agenda, não notifica e não acessa a rede."""
from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
import tempfile
from functools import wraps
from pathlib import Path
import re
import sys
import uuid

# Identidade vem do pacote; o mesmo runtime atende skills diferentes sem editar código.
IDENTITY = json.loads((Path(__file__).resolve().parents[1] / 'references/identidade.json').read_text(encoding='utf-8'))
if IDENTITY.get('schema_version') != 1 or IDENTITY.get('contract_version') != '1.0.0':
    raise ValueError('Contrato de identidade incompatível')
SKILL_ID = IDENTITY.get('skill_id')
if not isinstance(SKILL_ID, str) or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', SKILL_ID):
    raise ValueError('Identidade de skill inválida')
OPERATIONS = {'create', 'record', 'adjust', 'resume', 'review', 'audit'}
RESULTS = {'started', 'waiting', 'completed', 'cancelled', 'error'}
TERMINAL = {'completed', 'cancelled', 'error'}
POLICY_KEYS = {'inactive_days', 'personal_review_at', 'paused'}
EVENT_KEYS = {'schema_version', 'event_id', 'run_id', 'skill_id', 'at', 'origin', 'operation',
              'result', 'version', 'content_revision', 'artifact_ref', 'verification'}


def instant(value):
    if not isinstance(value, str):
        raise ValueError('Instante deve ser string ISO 8601 com fuso')
    dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if dt.tzinfo is None:
        raise ValueError('Instante sem fuso')
    return dt.astimezone(timezone.utc)


def utcnow():
    return datetime.now(timezone.utc).isoformat()


def read_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def write_new(path, data):
    # Publicação atômica e exclusiva: leitores nunca veem JSON parcial.
    path = Path(path)
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent, delete=False) as f:
        tmp = Path(f.name)
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')
    try:
        os.link(tmp, path)
    finally:
        tmp.unlink()


def serialized(fn):
    @wraps(fn)
    def wrapped(root, *args, **kwargs):
        lock = Path(root).expanduser().resolve() / '.mutation-lock'
        try:
            lock.mkdir()
        except FileExistsError as exc:
            raise ValueError('Outra escrita está em curso; tente novamente após ela terminar') from exc
        try:
            return fn(root, *args, **kwargs)
        finally:
            lock.rmdir()
    return wrapped


def safe_id(value):
    if not isinstance(value, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,100}', value):
        raise ValueError('ID inválido')
    return value


def validate_event(e):
    if set(e) != EVENT_KEYS or e['schema_version'] != 1 or e['skill_id'] != SKILL_ID:
        raise ValueError('Schema de evento inválido')
    safe_id(e['event_id']); safe_id(e['run_id']); instant(e['at'])
    if e['origin'] not in {'human', 'routine', 'monitor'} or e['operation'] not in OPERATIONS or e['result'] not in RESULTS:
        raise ValueError('Origem/operação/resultado inválido')
    if e['origin'] == 'monitor' and e['operation'] != 'audit':
        raise ValueError('Monitor só pode auditar')
    for key in ('version', 'content_revision'):
        if not isinstance(e[key], str) or not re.fullmatch(r'\d+\.\d+\.\d+', e[key]):
            raise ValueError('Versão deve ter formato major.minor.patch')
    if e['verification'] not in {'passed', 'failed', 'not_checked'}:
        raise ValueError('Verificação inválida')
    if e['artifact_ref'] is not None and (not isinstance(e['artifact_ref'], str) or not e['artifact_ref'].strip()):
        raise ValueError('Referência de entrega inválida')
    if e['result'] == 'completed' and (e['verification'] != 'passed' or not e['artifact_ref']):
        raise ValueError('Conclusão exige aceite aprovado e referência à entrega')


def validate_policy(p):
    if set(p) != POLICY_KEYS or type(p['paused']) is not bool:
        raise ValueError('Política inválida')
    days = p['inactive_days']
    if days is not None and (type(days) is not int or days <= 0):
        raise ValueError('Intervalo deve ser inteiro positivo ou null')
    if p['personal_review_at'] is not None:
        instant(p['personal_review_at'])


def init(root, version, revision, continuous=False):
    root = Path(root).expanduser().resolve()
    # O pacote distribuído nunca é destino dos registros pessoais.
    package = Path(__file__).resolve().parents[1]
    if root == package or package in root.parents:
        raise ValueError('Escolha armazenamento privado fora da skill instalada')
    for ancestor in (root, *root.parents):
        if (ancestor / '.git').exists():
            raise ValueError('Armazenamento deve ficar fora de repositórios Git')
    if not re.fullmatch(r'\d+\.\d+\.\d+', version) or not re.fullmatch(r'\d+\.\d+\.\d+', revision):
        raise ValueError('Versão inválida')
    root.mkdir(parents=True, exist_ok=True)
    (root / 'events').mkdir(exist_ok=True)
    (root / 'acks').mkdir(exist_ok=True)
    config = {'schema_version': 1, 'skill_id': SKILL_ID, 'installed_version': version,
              'content_revision': revision, 'observed_since': utcnow(),
              'observation': 'continuous' if continuous else 'partial',
              'policy': {'inactive_days': None, 'personal_review_at': None, 'paused': False}}
    write_new(root / 'config.json', config)
    return config


def load(root):
    root = Path(root).expanduser().resolve()
    c = read_json(root / 'config.json')
    if c.get('schema_version') != 1 or c.get('skill_id') != SKILL_ID:
        raise ValueError('Estado privado incompatível')
    if c.get('observation') not in {'continuous', 'partial'}:
        raise ValueError('Cobertura de observação inválida')
    instant(c['observed_since']); validate_policy(c['policy'])
    events = [read_json(p) for p in sorted((root / 'events').glob('*.json'))]
    for e in events:
        validate_event(e)
    events.sort(key=lambda e: (instant(e['at']), e['event_id']))
    # Reconstrução também detecta histórico adulterado/inconsistente; não inventa contagens.
    history = []
    for e in events:
        validate_transition(c, history, e)
        history.append(e)
    return root, c, events


def validate_transition(c, events, e):
    if any(x['event_id'] == e['event_id'] for x in events):
        raise ValueError('ID duplicado no histórico')
    if instant(e['at']) < instant(c['observed_since']):
        raise ValueError('Evento anterior ao início observado')
    run = [x for x in events if x['run_id'] == e['run_id']]
    if run:
        last = run[-1]
        if last['result'] in TERMINAL or instant(e['at']) <= instant(last['at']):
            raise ValueError('Execução encerrada ou transição fora de ordem')
        for field in ('origin', 'operation', 'version', 'content_revision'):
            if e[field] != last[field]:
                raise ValueError('Identidade da execução mudou')
        if e['result'] == 'started':
            raise ValueError('Execução já iniciada')
    elif e['result'] != 'started':
        raise ValueError('Primeiro evento precisa ser started')


@serialized
def append(root, e):
    validate_event(e)
    root, c, events = load(root)
    previous = next((x for x in events if x['event_id'] == e['event_id']), None)
    if previous is not None:
        if previous != e:
            raise ValueError('ID reutilizado com conteúdo diferente')
        return {'stored': False, 'event_id': e['event_id']}
    if instant(e['at']) > datetime.now(timezone.utc) + timedelta(minutes=1):
        raise ValueError('Evento no futuro')
    validate_transition(c, events, e)
    write_new(root / 'events' / (e['event_id'] + '.json'), e)
    return {'stored': True, 'event_id': e['event_id']}


@serialized
def configure(root, policy):
    validate_policy(policy)
    root, c, _ = load(root)
    # Configurações também são eventos imutáveis; a última política é derivada do histórico.
    item = {'at': utcnow(), 'policy': policy}
    (root / 'policies').mkdir(exist_ok=True)
    write_new(root / 'policies' / (str(uuid.uuid4()) + '.json'), item)
    return item


def knowledge(path):
    try:
        import yaml
    except ImportError as exc:
        raise ValueError('Auditoria OKF exige PyYAML instalado no ambiente') from exc
    text = Path(path).read_text(encoding='utf-8')
    if not text.startswith('---\n'):
        raise ValueError('Documento OKF sem frontmatter')
    # BaseLoader conserva instantes como strings para validação explícita.
    fm = yaml.load(text.split('---\n', 2)[1], Loader=yaml.BaseLoader)
    if not fm.get('type') or fm.get('agentflix', {}).get('skill_id') != SKILL_ID:
        raise ValueError('Documento OKF incompatível')
    instant(fm['generated']['at'])
    verified = fm.get('verified', [])
    if isinstance(verified, dict):
        verified = [verified]
    if not isinstance(verified, list):
        raise ValueError('verified deve ser lista ou objeto OKF')
    for item in verified:
        if not item.get('by'):
            raise ValueError('Verificação sem ator')
        instant(item['at'])
    fm['verified'] = verified
    if 'stale_after' in fm:
        instant(fm['stale_after'])
    return fm


def audit(root, document, now=None, available_version=None):
    root, c, events = load(root)
    now = instant(now) if now else datetime.now(timezone.utc)
    if now < instant(c['observed_since']) or any(instant(e['at']) > now for e in events):
        raise ValueError('Relógio da auditoria anterior aos registros')
    policies = [read_json(p) for p in (root / 'policies').glob('*.json')]
    for p in policies:
        instant(p['at']); validate_policy(p['policy'])
    policy = max(policies, key=lambda p: instant(p['at']))['policy'] if policies else c['policy']
    fm = knowledge(document)
    starts = [e for e in events if e['result'] == 'started' and e['operation'] != 'audit']
    human = [e for e in starts if e['origin'] == 'human']
    completed = [e for e in events if e['result'] == 'completed' and e['operation'] != 'audit' and e['origin'] != 'monitor']
    last = human[-1]['at'] if human else None
    latest = events[-1] if events else None
    version = latest['version'] if latest else c['installed_version']
    revision = latest['content_revision'] if latest else c['content_revision']
    signals = []

    def signal(kind, basis, message):
        identity = hashlib.sha256((kind + ':' + basis).encode()).hexdigest()[:24]
        signals.append({'id': identity, 'kind': kind, 'message': message})

    if policy['inactive_days'] is not None and c['observation'] == 'continuous':
        anchor = last or c['observed_since']
        if now >= instant(anchor) + timedelta(days=policy['inactive_days']):
            signal('inactive', anchor, 'Sem nova execução humana registrada no intervalo combinado; não inferir resultado na vida da pessoa.')
    if fm['verified'] and max(instant(v['at']) for v in fm['verified']) < instant(fm['generated']['at']):
        signal('verification_predates_content', fm['generated']['at'], 'As verificações precedem a alteração do conteúdo; revisar novamente.')
    if fm.get('stale_after') and now >= instant(fm['stale_after']):
        signal('knowledge_review_due', fm['agentflix']['content_revision'] + ':' + fm['stale_after'], 'Revisão editorial vencida; uso não renova validade.')
    if policy['personal_review_at'] and now >= instant(policy['personal_review_at']):
        signal('personal_review_due', policy['personal_review_at'], 'Revisão do plano pessoal chegou ao prazo combinado.')
    if fm['agentflix']['content_revision'] != revision:
        signal('revision_mismatch', revision + ':' + fm['agentflix']['content_revision'], 'Revisão registrada difere do documento instalado; conferir migração.')
    if available_version is not None:
        if not re.fullmatch(r'\d+\.\d+\.\d+', available_version):
            raise ValueError('Versão remota inválida')
        if tuple(map(int, available_version.split('.'))) > tuple(map(int, version.split('.'))):
            signal('update_available', version + ':' + available_version, 'Versão remota informada é mais recente; confirmar origem antes de atualizar.')
    acked = {p.stem for p in (root / 'acks').glob('*.json')}
    return {'skill_id': SKILL_ID, 'version': version, 'content_revision': revision,
            'knowledge_status': fm.get('status', 'stable'),
            'knowledge_generated': fm['generated'], 'knowledge_stale_after': fm.get('stale_after'),
            'knowledge_verified': fm['verified'],
            'verification_evidence': fm['agentflix'].get('verification_evidence', []),
            'knowledge_sha256': hashlib.sha256(Path(document).read_bytes()).hexdigest(),
            'observation': c['observation'], 'observed_since': c['observed_since'],
            'human_runs_observed': len(human), 'routine_runs_observed': sum(e['origin'] == 'routine' for e in starts),
            'completed_runs_observed': len(completed), 'last_human_use': last,
            'last_completed': completed[-1]['at'] if completed else None,
            'remote_version': available_version or 'not_checked', 'policy': policy,
            'signals': signals, 'notifications': [] if policy['paused'] else [s for s in signals if s['id'] not in acked],
            'scheduler': 'not_managed_by_this_script'}


@serialized
def ack(root, signal_id):
    if not re.fullmatch(r'[0-9a-f]{24}', signal_id):
        raise ValueError('ID de alerta inválido')
    root, _, _ = load(root)
    p = root / 'acks' / (signal_id + '.json')
    if p.exists():
        return {'stored': False}
    write_new(p, {'id': signal_id, 'delivered_at': utcnow()})
    return {'stored': True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--state', required=True, help='Pasta privada fora de repositórios')
    sub = parser.add_subparsers(dest='command', required=True)
    p = sub.add_parser('init'); p.add_argument('--version', required=True); p.add_argument('--revision', required=True)
    p.add_argument('--continuous', action='store_true', help='Só quando toda execução deste ambiente será registrada')
    p = sub.add_parser('record'); p.add_argument('--event', required=True, help='Arquivo JSON privado')
    p = sub.add_parser('configure'); p.add_argument('--policy', required=True, help='JSON com inactive_days, personal_review_at, paused')
    p = sub.add_parser('audit'); p.add_argument('--knowledge', default=str(Path(__file__).resolve().parents[1] / 'references/conhecimento.okf.md'))
    p.add_argument('--available-version'); p.add_argument('--now', help='Instante explícito para avaliação reproduzível')
    p = sub.add_parser('ack'); p.add_argument('--id', required=True)
    a = parser.parse_args()
    try:
        if a.command == 'init': result = init(a.state, a.version, a.revision, a.continuous)
        elif a.command == 'record': result = append(a.state, read_json(a.event))
        elif a.command == 'configure': result = configure(a.state, read_json(a.policy))
        elif a.command == 'audit': result = audit(a.state, a.knowledge, a.now, a.available_version)
        else: result = ack(a.state, a.id)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except (ValueError, OSError, KeyError, TypeError, IndexError) as exc:
        print('Auditoria interrompida: ' + str(exc), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
