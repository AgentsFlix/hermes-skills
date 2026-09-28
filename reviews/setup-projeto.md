# Setup de projeto 1.0.0

## Preparação da publicação

A fonte autoritativa permanece no monorepo privado AgentFlix, em
`ferramentas/setup-projeto/`. Esta branch contém a exportação gerada para
`skills/setup-projeto/`, o ZIP, a versão colável, a descoberta well-known e os
metadados do catálogo. A referência pública prevista é `setup-projeto-v1.0.0`.
A fonte foi integrada no commit privado `7100c471dd290d86e31c29b628bca21454f6f2d9`;
a exportação foi regenerada a partir desse snapshot, sem diferenças no pacote público.
Os checks privados `validate`, `orchestrator` e `monorepo` e os seis jobs da matriz
Ubuntu/macOS/Windows passaram no GitHub Actions.

O fluxo distribuído tem duas etapas: `setup-projeto` prepara ou concilia o
repositório, e a skill `task` decide branch e worktree para cada mudança. O pacote
preserva projetos existentes, não lê valores de credenciais e não cria configuração
global de agente. Codex e Claude Code recebem cópias locais de `task`; Hermes usa a
instalação de skills documentada pelo próprio ambiente.

## Verificações locais

- `validate_skills.py`: 57 skills válidas.
- `scan_skills.py`: 57 skills seguras e zero bloqueadas; `setup-projeto` tem duas
  ocorrências médias de subprocesso, restritas à leitura controlada do Git.
- `check_site.py`: zero erros.
- Suite pública: 178 testes passaram e um foi ignorado pelo próprio contrato.
- O pacote não contém caminhos pessoais, credenciais ou arquivos privados da fonte.
- ZIP, prompt, well-known e catálogos foram gerados a partir da mesma versão 1.0.0.

## Arte aprovada e QA

José aprovou os dois masters horizontal e vertical em 28/09/2026 pelos hashes apresentados.
Os quatro derivados abaixo de 400 KiB foram publicados no Cloudflare Images sem sobrescrita.
Card e ficha foram conferidos em 1440, 768 e 390 px: capa inteira, ações fora da arte, sem
overflow horizontal nem erros JavaScript observados. A cópia do comando Codex para o clipboard
foi literal nos três tamanhos.

O ZIP gerado foi executado em dois projetos sintéticos no macOS/Python 3.11, novo e existente:
15 documentos por caso, task portátil idêntica e arquivo existente preservado. A task recomendou
nova branch somente após comprovar checkout local exclusivo. Isso não certifica sessões completas
em Codex, Claude Code e Hermes.

A tag `setup-projeto-v1.0.0`, a release e a confirmação de produção dependem da integração
pública. Os links desta referência serão verificados depois da publicação.
