---
name: setup-projeto
description: Prepara ou organiza um projeto para agentes com Git, documentos reais, validação e a skill task. Use para /setup-projeto, @setup-projeto, $setup-projeto ou pedido de setup de repositório.
license: MIT
version: 1.0.0
compatibility: Requer Python 3.10+, Git e acesso local ao projeto. A CLI do provedor só é necessária quando houver operação remota.
metadata:
  author: AgentFlix
  version: 1.0.0
  tags: git, repositorio, codex, claude-code, hermes
---

# Setup de projeto

Prepare o projeto para duas entradas: `setup-projeto` na preparação e `task` em cada mudança.
O resultado é um repositório utilizável por Codex, Claude Code e Hermes, com documentação
preenchida a partir do projeto real, critérios de validação e a skill `task`.

Os helpers usam Python 3.10+ e biblioteca padrão; a inspeção Git exige Git instalado.
Confirme essas dependências. A CLI do provedor só é necessária quando houver operação remota.

## When to Use

Use em um projeto novo que precisa nascer como repositório operável ou em uma pasta existente
que ficou confusa, incompleta ou sem contrato para agentes. Também use quando o projeto ainda não
tem a skill `task`, comandos reais de validação ou documentação suficiente para Codex, Claude Code
e Hermes trabalharem sem inventar estrutura. Uma consulta sobre Git ou fluxo profissional pode
terminar em explicação; só altere o projeto quando o pedido incluir preparação ou organização.

## Descobrir antes de perguntar

Use o projeto atual ou o caminho informado. Inspecione sem executar código desconhecido:

```bash
python3 CAMINHO_DA_SKILL/scripts/setup_project.py inspect --project CAMINHO_DO_PROJETO
```

Complete com a leitura dos arquivos relevantes de código, manifests, lockfiles e instruções.
Não leia valores de `.env`, chaves ou bancos para montar a documentação. Projetos aninhados,
múltiplos remotos ou mudanças em andamento exigem diagnóstico antes de migração. Para projeto
existente, leia [references/existing-project.md](references/existing-project.md).

Pergunte somente o que não puder inferir e muda o resultado. Agrupe perguntas essenciais:

- Projeto e objetivo: qual resultado entrega e onde deve ficar? Exemplo: aplicativo local para
  organizar aulas, aproveitando a pasta aberta.
- Do zero: que tipo de produto e restrições existem? Recomende a menor stack que atenda ao
  objetivo; preserve stack e gerenciador existentes quando funcionam.
- Remoto: manter local ou criar/conectar repositório; quando remoto, dono/nome e visibilidade.
  Privado é a sugestão inicial, nunca uma conversão silenciosa de repositório existente.

Não peça escolhas de pastas internas, nomes de branch ou arquivos de instrução que o agente
pode determinar. Decisões já dadas não são perguntadas de novo. Se a stack não foi definida,
conclua o contrato de trabalho e registre a decisão faltante; não invente aplicação ou deploy.

## Preparar os artefatos

Leia [references/project-contract.md](references/project-contract.md), faça um briefing JSON
com fatos e escolhas da conversa em arquivo temporário fora do repositório e rode o plano:

```bash
python3 CAMINHO_DA_SKILL/scripts/setup_project.py render --project CAMINHO_DO_PROJETO --brief BRIEF_JSON
```

O gerador usa a `task` empacotada em `assets/task`; na fonte, usa a skill irmã. `--task-source`
permite uma fonte explícita. Confira o plano e aplique com os mesmos argumentos mais `--apply`.
Isso autoriza somente as escritas locais declaradas pelo gerador.

O gerador prepara documentos, mapa, templates e cópias portáteis da `task`. Ele não executa
Git, cria remoto, instala dependências nem configura CI. O agente conduz as etapas seguintes
e resolve conflitos preservando o projeto. Reexecução reaproveita somente bytes idênticos; qualquer
arquivo diferente exige conciliação explícita, mesmo que um manifesto local declare seu hash.

As cópias locais atendem `.agents/skills/task` e `.claude/skills/task`. Mantenha-as iguais à fonte
escolhida, sem caminhos pessoais do instalador. `CONTRIBUTING.md` e `.agent-project.json` formam
o contrato portátil criado pelo setup. Preserve instruções próprias que o projeto já possua e
deixe cada cliente carregar seus arquivos nativos; não instale uma ponte global por conta própria.

## Tornar o repositório operável

1. **Git:** em projeto novo, inicialize no alvo confirmado, configure a base escolhida e faça
   um primeiro commit de bootstrap com caminhos revisados explicitamente. É a exceção inicial
   quando ainda não há commit/base para PR. Confira ignores e staging antes. Em projeto
   existente, use o contrato Git e uma branch de setup, decidindo sobre worktree sem perder
   acesso às mudanças locais; não faça commit global do estado bagunçado.
2. **Ambiente:** registre runtime, gerenciador, lockfile e comandos reais. Se a stack foi
   escolhida, prepare instalação reproduzível e uma verificação significativa. Inspecione
   scripts desconhecidos de uma pasta existente antes de executá-los.
3. **Qualidade:** use checks existentes ou crie os adequados ao esqueleto implementado.
   Configure CI com esses mesmos comandos. Projeto documental pode validar contrato e links;
   declare que isso não verifica produto inexistente. Nunca use `echo OK` como qualidade.
4. **Remoto:** quando solicitado e identificado, siga [references/github.md](references/github.md)
   para GitHub. Em outro provedor, use ferramenta e documentação oficial correspondentes sem
   trocar o alvo. Não envie arquivos privados a remoto público sem autorização para isso.
5. **Agentes:** confira descoberta local de `task`. No Hermes, verifique perfil e confiança
   do projeto; `hermes skills trust CAMINHO` altera a confiança desse perfil e integra o setup
   solicitado após inspecionar as skills locais. Não percorra todos os perfis nem copie
   credenciais. Se uma `task` global antiga tiver precedência, atualize sua instalação
   gerenciada ou reporte a colisão; não declare a versão nova ativa sem conferir.
6. **Conferência:** confirme documentos específicos, skills, Git, checks locais e CI real
   quando houver remoto. Atualize o mapa com fatos comprovados. Proteção pretendida é distinta
   de proteção ativa. Ausência de acesso/plano é pendência a relatar, sem contorno.

Política sugerida para projetos novos: uma mudança coerente por branch/PR; isolamento escolhido
pela `task`; integração automática de ajustes técnicos após checks; deploy conforme contrato.
Preserve políticas existentes e limites explícitos do usuário.

## Concluir e permitir crescimento

Complete a entrega Git do setup quando houver remoto, seguindo `task` e autorizações do projeto.
Não crie outra conversa ou automação para concluir esta execução.

Preencha arquitetura com o que existe e registre gatilhos de evolução: componente novo quando
houver responsabilidade real, contrato por pasta quando regras diferirem, release quando houver
consumidor de versão, coordenação de arquivos quando houver trabalho simultâneo. Não crie
departamentos, microserviços, pastas vazias ou ferramentas de gestão apenas por possibilidade futura.

Informe caminho e remoto, configuração, verificações e pendências concretas. Dê a próxima entrada
com um resultado real: `task` seguido do objetivo, sem exigir ticket. Invocação nativa: `/setup-projeto`
e `/task` em Claude Code/Hermes; `$setup-projeto` e `$task` no Codex CLI/IDE; seletor `@` onde disponível.
Um gatilho textual não registra comando nativo universal.

## Verification

- Confira que o plano e a aplicação apontam ao projeto certo e que nenhum conflito foi sobrescrito.
- Verifique os documentos específicos, `.agent-project.json` e as cópias completas de `task` em
  `.agents/skills/task` e `.claude/skills/task`.
- Execute os comandos reais registrados para o projeto e separe resultado local, CI, proteção de
  branch, PR e deploy; cada estado exige sua própria evidência.
- Inspecione Git, branch, worktrees e remoto depois da preparação. Não declare proteção, publicação
  ou descoberta da skill em Codex, Claude Code ou Hermes sem conferir o ambiente correspondente.
- Confirme que arquivos versionados e evidências não contêm valores de credenciais ou dados privados.

## Arquivos desta skill

- `LICENSE`
- `agents/openai.yaml`
- `assets/task/SKILL.md`
- `assets/task/agents/openai.yaml`
- `assets/task/references/workflow.md`
- `assets/task/scripts/task_context.py`
- `references/ativacao.md`
- `references/ciclo-de-vida.md`
- `references/conhecimento.okf.md`
- `references/contrato-agentflix.md`
- `references/existing-project.md`
- `references/github.md`
- `references/identidade.json`
- `references/project-contract.md`
- `scripts/auditar.py`
- `scripts/setup_project.py`
- `templates/estado-da-skill.md`
- `templates/evento-de-uso.json`
- `integrity.json`
