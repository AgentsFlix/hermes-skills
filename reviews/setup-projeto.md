# Setup de projeto 1.0.0

## Preparação da publicação

A fonte autoritativa permanece no monorepo privado AgentFlix, em
`ferramentas/setup-projeto/`. Esta branch contém a exportação gerada para
`skills/setup-projeto/`, o ZIP, a versão colável, a descoberta well-known e os
metadados do catálogo. A referência pública é `setup-projeto-v1.0.0`.
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

## Publicação e uso do artefato público

O PR #172 foi integrado no commit `97facc5a50bde3347e094289c74b18128f4be173`.
A tag imutável `setup-projeto-v1.0.0` aponta para esse commit; a release foi publicada
com ZIP e arquivo de SHA-256. O marcador público de build confirmou esse mesmo commit,
e o workflow de verificação de produção passou.

Na vitrine https://agentsflix.ai/, o card Setup de projeto abre a ficha. Card/ficha foram
conferidos em 1440, 768 e 390 px, sem overflow ou erro JavaScript, com capa inteira e
comando Codex copiado literalmente. Catálogo, prompt e descoberta well-known responderam
HTTP 200 pelo domínio de produção. O fragmento `#setup-projeto` em uma abertura fria
não abriu a ficha automaticamente; o caminho verificado é clicar no card.

Os ZIPs da tag e da release retornaram HTTP 200, 53.038 bytes e SHA-256
`2abe1c7c0422259daf976fc1ecca31f09ec2add8a719474aa4db10ffcd47bf91`.
O CTA ChatGPT apontou para esse mesmo ZIP. Os helpers do ZIP público baixado foram
executados em dois projetos sintéticos no macOS/Python 3.11.15: 15 documentos por caso,
cópias da task idênticas, arquivo existente preservado e recomendação somente leitura
de nova branch após comprovar checkout exclusivo. Não equivale a sessões completas
nos três clientes.

Release: https://github.com/AgentsFlix/skills/releases/tag/setup-projeto-v1.0.0

