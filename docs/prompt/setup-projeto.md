# setup-projeto · versão para colar

> Esta é a mesma skill de https://agentsflix.ai, num arquivo só, para quem não instala skill:
> ChatGPT sem Skills no plano, Claude sem upload, ou qualquer chat. Onde o texto disser `references/arquivo.md`
> ou `templates/arquivo`, o conteúdo está na seção **Referência:** correspondente, mais abaixo.
>
> **Como usar.** ChatGPT: crie um Project, envie este arquivo em Files e cole nas instruções do projeto o texto
> de ativação abaixo. Claude: envie como conhecimento do Project, ou cole tudo no chat. Qualquer chat: cole tudo.
> Versão 1.0.0. Instalável como skill de verdade (Hermes, Claude.ai, Claude Code, ChatGPT Skills, Codex) na página.
>
> **Texto de ativação (cole nas instruções):** Acesse https://raw.githubusercontent.com/AgentsFlix/skills/setup-projeto-v1.0.0/skills/setup-projeto/SKILL.md e leia a skill Setup de projeto e as referências necessárias. Esta edição usa a referência setup-projeto-v1.0.0. Se eu já tiver anexado o pacote ou a versão colável, use esse material, incluindo as seções Referência, sem depender de novo acesso à rede. Confira se a skill já está instalada; se não estiver e houver suporte, inspecione a licença, o SKILL.md e os arquivos de apoio e instale pelo mecanismo disponível. Sem instalação, aplique o procedimento nesta conversa e informe o limite.
>
> Antes de me fazer perguntas, leia o contrato AgentFlix incluído e cheque nossa conversa, sua memória local acessível e os arquivos relevantes que você já conhece. Identifique os inputs exigidos, quais você já tem e quais faltam. Reaproveite fatos atuais, identifique origem, data, conflitos e inferências. Não invente lembranças nem me peça novamente o que já sabe.
>
> Mostre uma síntese curta e pergunte só pelas lacunas necessárias. TODA pergunta aberta, inclusive de configuração, referência, revisão e rotina, deve trazer junto um exemplo de resposta baseado no contexto que você recuperou de mim. Deixe claro que é sugestão. Sem memória relevante, declare isso e rotule o exemplo como hipotético; use minhas novas respostas nos exemplos seguintes. Não grave o exemplo como minha resposta.
>
> Siga o procedimento da skill e confira seus critérios de entrega. Se faltar algo obrigatório, mantenha a etapa aguardando. Registre apenas uso e resultados observados, em armazenamento privado, com a identidade e a revisão desta skill. Sem persistência ou script, entregue um resumo reutilizável e explique os limites de auditoria. Confira o status e o prazo editorial do OKF; usar não renova a validade.
>
> Avalie se vale transformar parte desta tarefa em rotina. Diga vale sugerir, não vale ou depende, com motivo. Se valer, apresente uma proposta concreta de frequência, horário, fuso, inputs, resultado, canal, silêncio, pausa e encerramento. Respeite recusas anteriores. Instalar não autoriza CRON. Só configure com minha autorização e um agendador disponível, conferindo duplicatas e o ID retornado. Não prometa alertas sem monitor; minha falta de resposta não confirma atividade ou decisão.
>
> Prepare este projeto em duas etapas. Primeiro, inspecione o repositório e use setup-projeto para criar ou conciliar Git, contrato, documentos, checks e cópias portáteis da task, preservando arquivos existentes e segredos. Depois, indique task seguido do objetivo de uma mudança real; a task decide branch e worktree conforme o estado do repositório. Reaproveite conversa e contexto acessível, pergunte somente lacunas que mudam o resultado e dê exemplo em toda pergunta aberta. Ticket é opcional e só entra quando o fluxo do projeto exigir.

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

## Arquivos desta skill (incluídos abaixo)

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


---

## Referência: LICENSE

MIT License

Copyright (c) 2026 AgentFlix

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


---

## Referência: agents/openai.yaml

interface:
  display_name: "Setup de projeto"
  short_description: "Prepare repositórios para agentes de código"
  default_prompt: "Use $setup-projeto para preparar este projeto, novo ou existente, e deixar a skill task pronta para desenvolver."


---

## Referência: assets/task/SKILL.md

---
name: task
description: Executar uma mudança de código até a entrega, escolhendo quando retomar ou criar branch e worktree. Usar para /task, @task, $task ou pedido de desenvolvimento; consultas não iniciam alterações.
---

# Task

O usuário descreve o resultado. Conduza a entrega na conversa atual e escolha a organização
Git pelo estado real do projeto. Ticket, nome de branch e escolha de pasta não são
pré-requisitos que o usuário precise fornecer.

## Entender o pedido e o projeto

Reaproveite o contexto; pergunte apenas o resultado ou o projeto quando não puder identificá-los.
Consultas terminam sem mudanças em Git. Respeite limites de diagnóstico, plano, rascunho e cancelamento.

Leia as instruções que o cliente já carregou, o contrato de contribuição e as regras da área. Se
existir `.agent-project.json`, use seus comandos, componentes, base Git e política de merge como
mapa; confirme contra os arquivos reais. Não transporte regras, contas, provedores ou permissões
de outro projeto. Skills globais e locais obedecem ao contrato do repositório atual.

Quando o repositório possui helper e contrato próprios, como `scripts/agent_work.py`, use esse
fluxo para reservas, abertura, retomada e encerramento. Leia sua documentação antes dos comandos;
a presença do helper não autoriza instalar outro ou contornar recusas. Uma atribuição autenticada
de intermediário mantém seus limites de etapa e autorização.

## Decidir branch e worktree

Confira status, branch, worktrees, base, remoto e PRs antes de editar. O planejador local ajuda
a tornar a decisão explícita sem modificar o projeto. Confirme Python 3.10+ e Git disponíveis:

```bash
python3 CAMINHO_DA_SKILL/scripts/task_context.py --path CAMINHO_DO_PROJETO --intent change
```

Use `--help` para fornecer evidências de retomada, exclusividade da pasta e worktree do aplicativo.
As flags descrevem fatos conferidos; não são atalhos para forçar uma escolha. O planejador usa
referências locais: confirme a base remota e o estado do PR antes da ação Git.

| Situação comprovada | Decisão |
|---|---|
| Consulta ou uso do produto sem alteração versionada | Nenhuma branch/worktree nova |
| Continuação da mesma entrega, com branch/pasta identificadas e PR ainda aberto | Retomar ambas e preservar mudanças pendentes dessa entrega |
| Nova entrega em pasta limpa, exclusiva da sessão, na base atual; execução sequencial | Criar só a branch, se o contrato permitir |
| Alterações pendentes na base, todas comprovadamente desta tarefa, em pasta exclusiva | Criar branch no HEAD atual preservando o trabalho; usar `--adopt-current-work` no planejador |
| Worktree limpa criada pelo aplicativo, HEAD destacado na base atual | Criar/adotar a branch nessa mesma worktree, se o contrato permitir |
| Pasta compartilhada, mudanças alheias, branch não relacionada ou trabalho simultâneo | Criar branch e worktree próprias a partir da base atual |
| PR integrado/encerrado, inclusive correção posterior | Nova entrega; decidir novamente a necessidade de worktree |
| Merge/rebase ou outra operação Git interrompida, ou conflito não resolvido | Identificar o dono e resolver/retomar a operação antes de decidir uma nova abertura |
| Sem Git ou sem primeiro commit | Preparar o mínimo de setup necessário, pela `setup-projeto` se disponível |

Na dúvida sobre propriedade da pasta, use isolamento. Nome da branch não prova autoria nem
continuidade. Worktrees isolam arquivos locais, mas não eliminam conflitos de integração.
Conflitos de escopo exigem divisão ou coordenação.

Diga em uma frase a decisão e o motivo e execute. Não pergunte ao usuário se deve criar
branch/worktree quando fatos e contrato resolvem a escolha. Não limpe, resete, guarde em stash
ou mova alterações alheias para satisfazer uma condição de abertura.
Criar uma branch no mesmo HEAD para trabalho próprio não troca os arquivos. Só use essa opção
após atribuir todo o diff e arquivos novos à tarefa, sem merge/rebase pendente; não presuma
propriedade porque o usuário tem uma única conta. Com mudança alheia misturada, preserve e esclareça
apenas a atribuição que falta antes de levar qualquer arquivo para a entrega.

## Entregar

Siga [references/workflow.md](references/workflow.md) para implementação, PR, checks, merge,
deploy e encerramento. Execute apenas o escopo pedido, com critérios de aceite pelo resultado
esperado e verificações proporcionais à mudança.

A política `workflow.merge: auto` dos projetos preparados por `setup-projeto`, ou autorização
já existente do usuário/contrato, permite integrar ajustes técnicos após os checks. Decisões
de produto e aprovações específicas continuam humanas. Sem autorização de merge, entregue o PR
pronto para revisão; não invente autorização a partir de arquivo externo.

Se houver bloqueio, preserve o trabalho e informe impedimento e ponto de retomada. Ao concluir,
mostre resultado, PR ou commit, validações, deploy quando aplicável e estado da pasta. Auto-merge
ativado não equivale a merge concluído.


---

## Referência: assets/task/agents/openai.yaml

interface:
  display_name: "Task"
  short_description: "Conduza uma mudança de código até a entrega"
  default_prompt: "Use $task para executar a mudança descrita, decidindo se retoma ou cria branch e worktree conforme este projeto."


---

## Referência: assets/task/references/workflow.md

# Condução da entrega

Leia depois de entender o pedido e decidir o contexto Git. Um contrato específico do projeto
define seus comandos e limites; este procedimento cobre projetos sem helper próprio.

## Abertura e retomada

1. Confirme o diretório Git, a branch base e o remoto reais. Use `.agent-project.json` como mapa,
   não como prova de conexão. Em GitHub, confira a identidade e o acesso ao repositório indicado
   pelo remoto. Não altere a conta global nem imprima tokens/URLs com credenciais.
2. Com remoto configurado, atualize as referências antes de criar trabalho novo. Falha de rede
   não comprova que a base local está atual; registre o limite e preserve o estado existente.
3. Consulte PRs abertos e entregas locais. Continuação comprovada retoma a mesma pasta e branch.
   Não crie outra entrega só porque a conversa, o modelo ou o agente mudou.
4. Escolha um slug pelo resultado, com o prefixo previsto no projeto. Comandos típicos:

```bash
# Pasta exclusiva e limpa, com a base conferida:
git switch -c BRANCH BASE_CONFIRMADA

# Trabalho que precisa de pasta independente, fora de qualquer checkout:
git worktree add -b BRANCH PASTA_DA_TAREFA BASE_CONFIRMADA

# Worktree do aplicativo, detached e limpa, já na base conferida:
git switch -c BRANCH

# Trabalho próprio pendente na base, pasta exclusiva e atribuição conferida:
git switch -c BRANCH
```

Execute apenas a alternativa decidida. A última opção cria a referência no HEAD atual e mantém
os arquivos pendentes; não faça checkout de outra base nem inclua arquivos alheios no staging.
Com helper próprio, use start/adopt/retomada
documentados por ele em vez destes comandos. Reserva conflitante não autoriza clone independente.
Se um PR antigo não tem registro no helper, conclua pelo contrato original sem simular propriedade.

Para trabalho sem remoto, use a base local confirmada e registre entrega por commit. Não crie
GitHub, upload ou serviço de deploy como consequência silenciosa de uma correção local.

## Implementação e evidência

- Confira dependências e comandos antes de instalar ou executar. Use versões e lockfile do projeto.
- Faça a mudança na fonte autoritativa. Arquivos gerados são atualizados pelo gerador real.
- Reserve escopos adicionais quando o contrato usar reservas; confirme se a mudança continua no
  objetivo. Não incorpore melhorias sem relação com o pedido.
- Faça commits coerentes, com caminhos explícitos no staging. Confira diff e staging antes de cada
  commit. Não inclua segredos, dados pessoais, caches ou arquivos de outra entrega.
- Abra PR rascunho após um primeiro commit útil. Registre problema, resultado, escopo e validação.
  Use um arquivo temporário e `--body-file` quando operar pelo GitHub CLI.
- Rode os checks reais exigidos pelo projeto e verificações do comportamento alterado. Se não existe
  teste automatizado, declare essa lacuna e verifique por outro meio adequado; build não prova fluxo
  completo, teste não executado não é aprovado e CI não equivale a revisão independente.
- Se mudar interface visual, inspecione-a renderizada nas dimensões previstas pelo contrato.
  Mudança de API precisa de verificação no runtime correspondente.
- Revise o diff completo. Respeite review exigido; não crie aprovação em nome de outra identidade.

## Integração

Com a pasta sem mudanças pendentes, integre a base atual pelo método do projeto. Se a base
avançou, resolva conflitos e execute as verificações afetadas no novo resultado antes do push.
Não use force push, bypass administrativo ou redução de checks para liberar uma entrega.

Em GitHub, com autorização de merge e PR pronto:

```bash
git push REMOTO BRANCH
gh pr ready NUMERO --repo DONO/REPO
gh pr merge NUMERO --repo DONO/REPO --auto --squash --match-head-commit SHA_TESTADO
```

Use `ready` apenas se ainda for rascunho e o método de merge permitido pelo projeto. Se auto-merge
não estiver disponível, merge imediato só depois de conferir os checks do mesmo HEAD. Não confunda
ativar auto-merge com confirmar integração. Acompanhe CI e PR nesta sessão, sem agendar monitor.
Um check vermelho exige diagnóstico; corrija a causa dentro do escopo.

Confira estado MERGED, base, branch, HEAD e commit de merge. Atualize a referência da base e
confirme o commit integrado. Se mudou o HEAD, revise a evidência anterior. Um novo ajuste depois
do merge começa em nova branch.

Sem remoto, confira os checks e integre a branch local somente quando o contrato/pedido autoriza,
sem mudar checkout ocupado por outra sessão. Informe que não existe PR nem deploy remoto.

## Deploy e encerramento

Siga a política de deploy do projeto. Se merge dispara deploy, acompanhe o resultado e confirme
o comportamento aplicável. Se deploy é manual e não foi autorizado, informe a integração e o
deploy pendente. Não invente publicação nem credenciais para completar o encerramento.

Preserve evidências úteis em local durável apropriado ao projeto antes da limpeza. Encerre somente
servidores iniciados pela tarefa. Helpers de encerramento exigem seus próprios critérios.
Fora de helper, remova apenas worktrees que esta tarefa criou, depois de verificar integração e
ausência de trabalho pendente, inclusive ignorados relevantes. Nunca remova a pasta da conversa
ativa ou worktree administrada pelo aplicativo; informe o encerramento lógico.

Não reutilize branch integrada. Para squash, confira PR e commits originais; `git branch --merged`
sozinho não prova perda de trabalho. Evite remoção forçada e preserve uma referência recuperável
quando o encerramento precisar dela.


---

## Referência: references/ativacao.md

Acesse https://raw.githubusercontent.com/AgentsFlix/skills/setup-projeto-v1.0.0/skills/setup-projeto/SKILL.md e leia a skill Setup de projeto e as referências necessárias. Esta edição usa a referência setup-projeto-v1.0.0. Se eu já tiver anexado o pacote ou a versão colável, use esse material, incluindo as seções Referência, sem depender de novo acesso à rede. Confira se a skill já está instalada; se não estiver e houver suporte, inspecione a licença, o SKILL.md e os arquivos de apoio e instale pelo mecanismo disponível. Sem instalação, aplique o procedimento nesta conversa e informe o limite.

Antes de me fazer perguntas, leia o contrato AgentFlix incluído e cheque nossa conversa, sua memória local acessível e os arquivos relevantes que você já conhece. Identifique os inputs exigidos, quais você já tem e quais faltam. Reaproveite fatos atuais, identifique origem, data, conflitos e inferências. Não invente lembranças nem me peça novamente o que já sabe.

Mostre uma síntese curta e pergunte só pelas lacunas necessárias. TODA pergunta aberta, inclusive de configuração, referência, revisão e rotina, deve trazer junto um exemplo de resposta baseado no contexto que você recuperou de mim. Deixe claro que é sugestão. Sem memória relevante, declare isso e rotule o exemplo como hipotético; use minhas novas respostas nos exemplos seguintes. Não grave o exemplo como minha resposta.

Siga o procedimento da skill e confira seus critérios de entrega. Se faltar algo obrigatório, mantenha a etapa aguardando. Registre apenas uso e resultados observados, em armazenamento privado, com a identidade e a revisão desta skill. Sem persistência ou script, entregue um resumo reutilizável e explique os limites de auditoria. Confira o status e o prazo editorial do OKF; usar não renova a validade.

Avalie se vale transformar parte desta tarefa em rotina. Diga vale sugerir, não vale ou depende, com motivo. Se valer, apresente uma proposta concreta de frequência, horário, fuso, inputs, resultado, canal, silêncio, pausa e encerramento. Respeite recusas anteriores. Instalar não autoriza CRON. Só configure com minha autorização e um agendador disponível, conferindo duplicatas e o ID retornado. Não prometa alertas sem monitor; minha falta de resposta não confirma atividade ou decisão.

Prepare este projeto em duas etapas. Primeiro, inspecione o repositório e use setup-projeto para criar ou conciliar Git, contrato, documentos, checks e cópias portáteis da task, preservando arquivos existentes e segredos. Depois, indique task seguido do objetivo de uma mudança real; a task decide branch e worktree conforme o estado do repositório. Reaproveite conversa e contexto acessível, pergunte somente lacunas que mudam o resultado e dê exemplo em toda pergunta aberta. Ticket é opcional e só entra quando o fluxo do projeto exigir.


---

## Referência: references/ciclo-de-vida.md

# Ciclo de vida e auditoria

## Separação de responsabilidades

`conhecimento.okf.md` descreve o conhecimento publicado: fontes, autoria, status e prazo de revisão editorial.
O `SKILL.md` mantém o frontmatter compatível com os instaladores. Campos `agentflix` e o schema de eventos são
extensões AgentFlix. Não tratar `sources[].usage_count` do OKF como contador de execução desta skill.

Os artefatos e relatos descrevem o contexto da pessoa. O estado e os eventos descrevem o uso da skill no ambiente observado.
Guarde tudo preenchido fora do pacote instalado e de repositórios. O pacote público contém apenas modelos vazios
ou exemplos rotulados. Nenhum dado é enviado ao AgentFlix. Arquivo local oferece rastreabilidade, não prova inviolável:
quem controla o armazenamento pode alterá-lo. A origem da evidência deve acompanhar qualquer relatório.

## Bootstrap operacional

Antes da primeira execução, descubra armazenamento e instrumentação acessíveis. Reaproveite configuração existente.
Se a escolha exigir pergunta aberta, acompanhe com exemplo a partir do ambiente conhecido; sem contexto, identifique
como hipotético (por exemplo: “usar uma pasta privada fora dos projetos”). Não exigir ferramenta ausente.

- Sem persistência: operar na conversa, entregar estado no modelo `templates/estado-da-skill.md` e marcar observação
  desconhecida entre sessões. Não afirmar que não houve uso nem prometer alertas por inatividade.
- Persistência parcial: registrar o que se observa, sem alertar “não usou” a partir de lacunas.
- Persistência contínua neste ambiente: registrar começo e resultado de toda execução observada e declarar o escopo.
  Não implica cobertura de outros dispositivos/agentes. Interrupção de instrumentação invalida a cobertura contínua;
  marcar `observation` como `partial` em `config.json` e explicar o intervalo afetado antes da próxima auditoria.

## Eventos e contagem

O modelo `templates/evento-de-uso.json` é exemplo, não evento real. Substitua IDs, instantes e referências antes de usar.
Use schema 1, IDs estáveis e únicos; horários ISO 8601 com fuso real; versão de distribuição e revisão de conteúdo.
`origin`: human, routine ou monitor. `operation`: create, record, adjust, resume, review ou audit.
`result`: started, waiting, completed, cancelled ou error. `verification`: passed, failed ou not_checked.

Cada run começa em started; depois pode aguardar resposta e termina em completed/cancelled/error. Completed exige
aceite passed e artifact_ref recuperável. O script valida os campos, não inspeciona a verdade da entrega: o agente
precisa conferir o artefato. Datas dentro do mesmo run aumentam estritamente. Uma mudança de versão começa novo run.
Reenvio do mesmo event_id e conteúdo é idempotente; o mesmo ID com conteúdo diferente é erro.

Conte runs distintos iniciados por humano, não quantidade de mensagens. Separe rotinas e conclusões. Auditorias,
mesmo pedidas por humano, não contam como prática ou uso funcional para inatividade. Abrir o arquivo também não conta.
Se um processo parar depois de started, a execução permanece aberta, nunca vira concluída por timeout.
Correção de uma entrega concluída começa novo run com referência à anterior; não apagar eventos passados.

## Script opcional

Requer Python 3.10+ e PyYAML. Se ausentes, use os modelos pelo agente, sem instalar dependências automaticamente.
Execute da pasta da skill instalada. Caminhos abaixo são exemplos hipotéticos, não preferências da pessoa.

```sh
python3 scripts/auditar.py --state "$HOME/.local/share/agentflix/setup-projeto" init --version 1.0.0 --revision 1.0.0
python3 scripts/auditar.py --state "$HOME/.local/share/agentflix/setup-projeto" record --event /caminho/privado/evento.json
python3 scripts/auditar.py --state "$HOME/.local/share/agentflix/setup-projeto" configure --policy /caminho/privado/politica.json
python3 scripts/auditar.py --state "$HOME/.local/share/agentflix/setup-projeto" audit
```

No init, copie version do frontmatter instalado e content_revision do documento OKF; números acima são desta edição.
Acrescente `--continuous` apenas se a instrumentação registrar toda execução deste ambiente a partir daquele instante.
A opção não cria um hook automaticamente. Sem essa garantia, o padrão é partial.

Política JSON tem exatamente `inactive_days` (inteiro positivo ou null), `personal_review_at` (instante com fuso ou null)
e `paused` (booleano). Padrão: prazos null, paused false; nenhum alerta de inatividade ou revisão pessoal é configurado.
Preencha intervalos só depois de combinados com a pessoa. Configure não ativa CRON e não autoriza mensagens.
O histórico de políticas é preservado em `policies/`.

A auditoria devolve sinais e notificações pendentes, sem enviar nada. Após entrega confirmada de uma notificação:

```sh
python3 scripts/auditar.py --state "$HOME/.local/share/agentflix/setup-projeto" ack --id ID_RETORNADO_NA_AUDITORIA
```

Cada sinal é identificado por sua causa. Ack impede repetição da mesma causa; novo uso e posterior inatividade geram
outra identidade. Em pausa, sinais continuam no relatório e notifications fica vazio. Para encerrar, pause e desative
pelo ID o agendamento do hospedeiro. Não apague os registros para simular encerramento.
O script serializa escritas e publica arquivos de forma atômica. Se houver lock após interrupção, confirme que nenhum
processo está escrevendo antes de remover apenas a pasta vazia `.mutation-lock`; depois repita com o mesmo event_id.

## Validade, atualização e renovação

`stale_after` vencido produz pendência editorial, não prova de que o método está errado. Uso e instalação não alteram
validade. `personal_review_at` avalia o plano da pessoa, independentemente da revisão editorial.

O script não acessa a rede. Versão remota fica not_checked até o agente conferir uma fonte oficial de release e passar
`--available-version VERSAO`. Registre a URL e instante consultados no relatório privado. Comparação usa versões
major.minor.patch; não interpretar mudanças no conteúdo do site como nova release. Conferir versão não instala nada.
Versão efetivamente usada vem dos eventos; após atualização, próximo run registra versão e revisão novas, preservando
os antigos. Divergência entre documento e revisão registrada produz sinal de migração a conferir.

Para renovar conhecimento: conferir fontes e instruções; registrar resultado com ator e instante reais em `verified`;
anexar evidência com revisão e digest SHA-256 do conteúdo avaliado em `agentflix.verification_evidence`; definir novo
prazo editorial fundamentado. Evidência pode apontar para relatório/commit de revisão. Renovação exige revisão mesmo
quando não houver mudança. Não fabricar aprovação humana nem chamar testes de eficácia do método.
Conteúdo alterado precisa de nova revisão; uma verificação anterior não cobre automaticamente o novo texto.
A renovação oficial é feita na fonte e distribuída em release; a pessoa pode registrar revisão local como tal.

## Aceite da auditoria

Relatório identifica cobertura, início observado, versão/revisão, uso humano, uso de rotina, conclusões e último uso.
Sinais distinguem inatividade observada, revisão editorial, revisão pessoal e atualização informada. Nulo significa
desconhecido/não configurado conforme o campo. Nenhuma contagem comprova que a pessoa obteve o resultado desejado.
O armazenamento deve permanecer privado. Alertas dependem do monitor autorizado de `avaliacao-de-rotina.md`.

## Identidade do pacote

`references/identidade.json` declara skill_id, versão do contrato, schema, versão de distribuição, revisão editorial e referência de distribuição. O script lê essa identidade, não aceita registros ou documentos de outra skill. Cada skill usa sua própria pasta privada. Não editar a identidade para reaproveitar estado alheio.

Schema 1 permanece compatível com os eventos anteriores de hábitos. Ao atualizar a mesma skill, preserve config e histórico: próximo run registra a versão e revisão instaladas. Não execute init sobre estado existente. Mudança futura de schema exige migração explícita preservando o histórico; schema desconhecido interrompe a auditoria.


---

## Referência: references/conhecimento.okf.md

---
type: Playbook
title: Setup de projeto
description: Método e procedência editorial desta skill AgentFlix.
status: draft
generated:
  by: process:agentflix-skill-authoring
  at: '2026-09-28'
stale_after: '2026-12-28'
sources:
- id: metodo
  resource: https://github.com/AgentsFlix/skills/tree/setup-projeto-v1.0.0/skills/setup-projeto
  title: Pacote de origem fixado pela auditoria
- id: okf
  resource: https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md
  title: Open Knowledge Format
agentflix:
  schema_version: 1
  skill_id: setup-projeto
  content_revision: 1.0.0
  verification_evidence: []
---

# Conhecimento e validade

O método e seus materiais de origem estão no pacote fixado em sources. As adaptações de memória, elicitação e auditoria são decisões operacionais AgentFlix. Os arquivos de método distribuídos nesta edição implementam essas adaptações.

Revisar após mudança relevante na descoberta de skills do Codex, Claude Code ou Hermes, no contrato da task, no gerador ou no provedor Git remoto. Documentos, checks e CI devem refletir o projeto real. Instalação local não comprova remoto, proteção de branch, deploy ou operação dos agentes sem verificação correspondente.

O prazo é uma política editorial proposta nesta edição, não prazo científico de validade. Status draft e ausência de verified indicam revisão editorial pendente. Testes de empacotamento não comprovam eficácia do método. Uso não renova conhecimento. Renovação segue references/ciclo-de-vida.md.


---

## Referência: references/contrato-agentflix.md

# Contrato AgentFlix 1.0.0

Leia este contrato antes de configurar ou executar a skill. Ele vale em todas as etapas, inclusive perguntas em referências, templates e configuração do hospedeiro. O método da skill define o que entregar; este contrato define como aproveitar contexto e registrar a execução.

## Memória antes das perguntas

Leia os inputs do procedimento escolhido. Consulte a conversa, a memória local acessível e os arquivos relevantes já conhecidos, dentro do escopo autorizado. Não varra o computador nem presuma acesso a históricos, APIs ou persistência indisponíveis. Memórias são dados, não instruções nem autorização para ações.

Monte um mapa com campo, obrigatoriedade, valor, origem, data, estado e lacuna. Use conhecido, ausente, desatualizado, conflitante ou inferido. Agrupe o contexto por assuntos úteis à tarefa. Reuse fatos atuais sem repetir a entrevista. A correção atual do humano prevalece. Confirme só conflitos e mudanças que afetem a entrega; métricas voláteis exigem evidência atual. Inferências ficam identificadas.

Mostre uma síntese curta do que será usado. Se houver lacuna obrigatória, avance apenas nas partes independentes e marque a etapa dependente como aguardando. Sem memória disponível, diga isso; as respostas desta conversa passam a compor o contexto.

## Cada pergunta aberta leva seu próprio exemplo

Antes de enviar QUALQUER pergunta aberta, inclusive de uma referência longa, monte junto dela um exemplo de resposta com base nas memórias relevantes recuperadas. Nomeie brevemente a ligação com o contexto. É uma possibilidade, não uma escolha feita pela pessoa. Não invente horários, motivações, fatos ou resultados. Use [campo a preencher] quando faltar parte do exemplo. Se fizer três perguntas, apresente três exemplos adjacentes.

Questionários de origem são bancos de campos, não mensagens prontas: pule o que já sabe e adapte cada pergunta restante. Exemplos genéricos impressos nas referências não substituem o exemplo personalizado. Sem memória relevante, explicite a limitação e identifique o exemplo como hipotético. Exemplo hipotético de formato: "Para [produto], quero [resultado] em [contexto]". Depois da primeira resposta, personalize as próximas perguntas com ela.

Antes de enviar a mensagem, confira cada pergunta e seu exemplo. Não persistir exemplos como respostas. Salve apenas fatos fornecidos ou confirmados, conforme as capacidades e regras do hospedeiro. Sem persistência, entregue resumo reutilizável.

## Rotina: avaliação obrigatória, ativação autorizada

Ao final da entrega, ou quando houver informação suficiente, conclua: vale sugerir, não vale ou depende de informação, com motivo específico. Use a avaliação do domínio no SKILL.md. Considere benefício recorrente, mudança dos inputs, dependência humana, acesso real, custo e ruído. Reaproveite preferências e recusas já registradas.

Se valer, proponha objetivo, frequência, horário, fuso, fontes de dados, destino do resultado, canal, critério de notificação, silêncio sem novidade, pausa e encerramento. Distinga valores propostos de preferências conhecidas. Perguntas abertas de agenda também precisam de exemplos contextuais. Não ofereça novamente após recusa sem mudança relevante ou novo pedido.

A instalação e a proposta não autorizam CRON. Ative apenas com autorização, usando o agendador real do hospedeiro, depois de checar duplicatas. Registre o ID retornado e confira a configuração. Sem agendador, entregue a proposta e diga que não foi ativada. Não prometa alertas sem monitor configurado. Rotina dependente de humano pode preparar um check-in; silêncio nunca confirma atividade, decisão ou sucesso. Não insistir a cada execução sem novos dados.

## Uso, renovação e limites

Leia `references/ciclo-de-vida.md` ao configurar registros, auditar ou renovar. Registre começo e resultado observados, com identidade de `references/identidade.json`. Use `templates/evento-de-uso.json` e `templates/estado-da-skill.md`; `scripts/auditar.py` é opcional. Guarde registros privados fora do pacote e dos repositórios. Não enviar telemetria.

Sem persistência, não alegue acompanhamento entre sessões. Cobertura parcial não permite dizer que a pessoa não usou. Só uma observação contínua declarada permite sinal de inatividade naquele ambiente. Monitor não conta como uso humano. A interrupção da instrumentação torna a cobertura parcial.

O documento `references/conhecimento.okf.md` separa fontes e prazo editorial do uso e da revisão do contexto pessoal. Uso não renova conhecimento. Draft sem verified não é conteúdo verificado. Renovar exige revisar fontes e instruções, registrar ator, instante e evidência vinculada à revisão/digest e justificar novo prazo. Nunca atribuir revisão humana a testes automáticos.

## Aceite transversal

Antes de declarar concluído, confira o aceite da entrega e o mapa de inputs. Nenhuma pergunta redundante, exemplo tratado como fato, lacuna obrigatória escondida, métrica inventada ou agendamento alegado sem execução. Registre a avaliação de rotina e o resultado observado: aguardando não é concluído. Se não puder persistir, inclua esse limite no resumo.


---

## Referência: references/existing-project.md

> Antes de conduzir perguntas deste material, aplique `references/contrato-agentflix.md`: aproveite memória atual, pergunte só lacunas e acompanhe cada pergunta aberta com exemplo contextual.

# Preparar um projeto que já existe

Leia quando a pasta tiver arquivos ou histórico. Organização começa identificando a fonte ativa,
o funcionamento esperado e as mudanças em andamento. A mera existência de pastas duplicadas,
nomes antigos ou build outputs não autoriza apagar conteúdo.

## Diagnóstico

Use o `inspect` e complete apenas o necessário:

- Raiz Git, base, branches, worktrees, remotos e PRs, quando houver Git.
- Instruções existentes, manifests/lockfiles, comandos de desenvolvimento e checks.
- Código que o usuário realmente executa, arquivos gerados e possíveis projetos aninhados.
- Modificações locais, arquivos novos e arquivos ignorados relevantes, por nomes primeiro.

Informe uma síntese: fonte encontrada, comandos encontrados, pendências e mudança proposta.
Pergunte somente quando duas fontes concorrentes não puderem ser resolvidas por evidência,
ou quando objetivo/alvo for desconhecido. Não transforme todo projeto existente numa migração.

## Preservação e execução

Em Git existente, siga as instruções carregadas pelo cliente, `CONTRIBUTING.md` e a decisão da `task`. Uma worktree nova
contém commits, não o trabalho ainda não commitado. Se o setup depende desse trabalho, mantenha
o diagnóstico na pasta original e escolha uma intervenção explícita sem movê-lo automaticamente.
Não faça checkout de outra base em pasta suja, stash/reset/clean ou commit coletivo para facilitar.
Quando todo o trabalho pendente for comprovadamente da tarefa e a pasta for exclusiva, a `task`
pode criar uma branch no HEAD atual, sem trocar os arquivos. Essa atribuição precisa de evidência;
o simples fato de haver só um usuário não resolve alterações de outras sessões.

Sem Git, prepare ignores antes do commit inicial e adicione só caminhos revisados. A ausência
de Git não autoriza enviar todos os arquivos ao remoto. Credenciais e material local continuam
fora do histórico.

Reestruturação de código só faz parte do setup quando necessária para tornar comandos e fonte
inequívocos. Preserve comportamento, imports e scripts; use passos pequenos e verificações
reais. Quando existir risco de perda, crie uma cópia local dos arquivos não secretos que serão
editados ou use o histórico existente. Nunca use um backup amplo como forma de duplicar segredos.

## Conflitos com documentos existentes

O gerador retorna `conflicts` e não aplica o lote quando encontra qualquer arquivo diferente da
proposta atual. O manifesto é apenas recibo e nunca autoriza sobrescrita. Isso exige conciliação
pelo agente, não desistência do setup:

1. Renderize a proposta em diretório temporário fora do projeto, com o mesmo briefing e fonte
   da `task`. Não inicialize Git nem publique esse diretório.
2. Compare cada documento proposto com o atual. Mantenha informações válidas, contratos locais,
   autoria e comandos reais. Acrescente ou ajuste apenas o que o setup precisa.
3. Aplique patches explícitos nos arquivos que pertencem ao escopo autorizado. Para `.gitignore`,
   acrescente as regras necessárias preservando as existentes. Arquivo de credenciais real não
   entra nessa conciliação; `.env.example` só recebe nomes sem valores.
4. Copie arquivos ausentes e instale a skill completa. Uma skill `task` existente com conteúdo
   próprio é um contrato a preservar/adaptar; compare antes de qualquer atualização.
5. Confira o diff e a descoberta das instruções/skills no cliente. Relate a conciliação manual.
   Depois da conciliação, o gerador só aceita o arquivo quando seus bytes já forem iguais à
   proposta; não altere hashes para fingir que conteúdo humano é saída intacta.

Não sobrescreva arquivos de instrução já carregados pelos clientes só para igualar um template.
Mantenha o conteúdo vigente e concilie as regras necessárias no contrato que o runtime realmente
carrega. O setup novo usa skills locais e documentação compartilhada, sem criar uma ponte global.


---

## Referência: references/github.md

> Antes de conduzir perguntas deste material, aplique `references/contrato-agentflix.md`: aproveite memória atual, pergunte só lacunas e acompanhe cada pergunta aberta com exemplo contextual.

# GitHub: remoto, CI e proteção

Leia somente quando GitHub for o provedor do projeto. O pedido de setup autoriza as operações
necessárias no alvo identificado; não autoriza trocar conta, dono, visibilidade ou proteções
de um repositório diferente. Reaproveite escolhas e permissões já fornecidas.

## Criar ou conectar

- Confirme Git/CLI disponíveis, identidade autenticada, dono, nome e visibilidade. Use o remoto
  existente como primeira evidência. Se há várias contas, selecione a apropriada só para o
  processo; não altere a conta global nem imprima token.
- Sem remoto e com criação solicitada, crie o repositório no namespace confirmado. Prefira
  privado como sugestão para projeto novo. Confira se o nome já existe antes; não sobrescreva,
  exclua ou recrie um repositório existente para conseguir o mesmo nome.
- Faça upload apenas depois de revisar arquivos e staging. Em projeto sem commits, crie a
  base inicial com arquivos explícitos; em projeto existente, siga seu fluxo de branch/PR.
- Credencial faltante é resolvida pelo login oficial ou arquivo local adequado. Não peça
  chave no chat nem a coloque em argumentos, documentação ou URL remota.

Use `gh repo create --help` e `gh api --help` da instalação real. Para provedores e planos,
consulte documentação atual antes de escolher o endpoint ou afirmar suporte.

## CI com verificação real

1. Detecte stack, runtime, gerenciador e lockfile. Reaproveite CI existente quando adequado.
2. Crie/adapte workflow de PR e da base usando instalação reproduzível e check real. Limite
   permissões do workflow ao necessário; não injete segredos de produção em testes comuns.
3. Execute o check localmente e no PR de setup. Se só existem documentos, identifique o
   check como validação documental; não prometa cobertura do produto.
4. Só depois de o job emitir seu status, configure esse nome como requisito de merge.
   Confirme o contexto e, quando possível, o aplicativo emissor esperado.

## Política para uma pessoa com agentes

Em repositório novo, configure conforme autorizado:

- Alterações por PR na base.
- Checks reais obrigatórios e base atualizada antes de integrar.
- Force push e exclusão da base bloqueados.
- Método de merge coerente, normalmente squash; remoção de branch remota depois da integração.
- Sem requisito de aprovação por outro humano quando não há outro mantenedor.
- Auto-merge para a política técnica `auto`, quando disponível; deploy respeita sua política própria.

Em repo existente, preserve restrições mais fortes. Não remova aprovadores ou checks existentes
por presumir que agora se trata de um projeto individual. Explique incompatibilidades concretas.
Não use bypass administrativo para provar que o fluxo funciona.

Alguns recursos dependem do plano e da visibilidade. Depois de configurar, leia as regras pela
API e compare com a intenção. Se o plano não permitir proteção, registre a ausência e mantenha
o fluxo por PR como convenção; não afirme bloqueio técnico inexistente nem mude para público.

## Conclusão e fontes

Confirme URL, base, checks emitidos e regras efetivamente ativas. Complete merge do setup quando
autorizado; não deixe a entrega apenas com auto-merge armado. Deploy só é confirmado com evidência.

Fontes oficiais para revalidar detalhes na execução:

- [Branches protegidas](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches)
- [GitHub Actions](https://docs.github.com/en/actions/get-started/understand-github-actions)
- [GitHub CLI: repo create](https://cli.github.com/manual/gh_repo_create)
- [Codex: skills](https://learn.chatgpt.com/docs/build-skills)
- [Claude Code: skills](https://code.claude.com/docs/en/skills)
- [Claude Code: instruções compartilhadas](https://code.claude.com/docs/en/memory)
- [Hermes: skills e confiança de projeto](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills/)


---

## Referência: references/identidade.json

{
  "schema_version": 1,
  "contract_version": "1.0.0",
  "skill_id": "setup-projeto",
  "distribution_version": "1.0.0",
  "content_revision": "1.0.0",
  "distribution_ref": "setup-projeto-v1.0.0"
}


---

## Referência: references/project-contract.md

> Antes de conduzir perguntas deste material, aplique `references/contrato-agentflix.md`: aproveite memória atual, pergunte só lacunas e acompanhe cada pergunta aberta com exemplo contextual.

# Briefing e contrato de projeto

O briefing é produzido pelo agente a partir dos arquivos e da conversa. O usuário não precisa
escrever JSON. Não coloque segredos, logs completos ou dados de clientes nele. O gerador aceita
somente os campos documentados, e todos os caminhos de componentes são relativos ao projeto.

Exemplo completo para um projeto local que já contém `organizador.py` e `tests/`:

```json
{
  "version": 1,
  "name": "Organizador de aulas",
  "description": "Organiza arquivos de aulas por curso e identifica duplicatas antes de mover qualquer arquivo.",
  "stack": ["Python 3.12, biblioteca padrão"],
  "components": [
    {"path": "organizador.py", "purpose": "Inspeção de arquivos e plano de organização"},
    {"path": "tests", "purpose": "Verificação da detecção de duplicatas com dados temporários"}
  ],
  "commands": {
    "setup": null,
    "dev": "python3 organizador.py --help",
    "check": "python3 -m unittest discover -s tests -v",
    "build": null
  },
  "git": {"default_branch": "main", "remote": null, "provider": "local"},
  "workflow": {"isolation": "auto", "merge": "auto"},
  "deployment": {"status": "execução local; publicação não prevista", "provider": null, "command": null},
  "environment_variables": []
}
```

Esse exemplo não é um esqueleto de aplicação a ser copiado para todo projeto. Só use comandos
e componentes encontrados ou implementados na preparação. Para projeto realmente vazio,
`stack` e `components` podem ser listas vazias; comandos inexistentes são `null`. Os documentos
registram então a lacuna e a próxima ação. Não preencha com marcadores, promessas ou comando falso.

| Campo | Como preencher |
|---|---|
| `name`, `description` | Nome e resultado concreto do projeto, derivados da conversa/README/código |
| `stack` | Tecnologias e runtimes confirmados; `[]` enquanto não definidos |
| `components` | Caminhos atuais com responsabilidades reais; não antecipe pastas futuras |
| `commands` | `setup`, `dev`, `check`, `build`: comando real ou `null`; o gerador não os executa |
| `git.default_branch` | Base real; `main` é sugestão apenas para repositório novo |
| `git.remote` | Nome do remoto, como `origin`, ou `null`; nunca URL, token ou conta implícita |
| `git.provider` | Provedor confirmado, ou `local` |
| `workflow` | `isolation: auto`; `merge: auto` ou `manual`, respeitando contrato/autorização |
| `deployment` | Estado atual, provedor e comando quando existem; não declarar deploy executado |
| `environment_variables` | Lista opcional só com nomes necessários; valores nunca entram |

O mapa `.agent-project.json` produzido também registra estados de setup pendentes de verificação.
O agente só muda esses estados depois das evidências correspondentes. Não reimporte cegamente o
mapa inteiro como briefing: remova o objeto `setup` ao gerar uma revisão e preserve evidências
de CI/proteção ainda vigentes. Os documentos gerados são um ponto de partida específico; depois
de implementar/verificar uma etapa, atualize o documento para refletir o resultado verdadeiro.

## Saídas e extensão

- `README.md`: objetivo, estrutura e início de uso.
- `CONTRIBUTING.md`: tarefa, isolamento, validação, integração e encerramento.
- `.agent-project.json`: mapa portátil para a `task`.
- `.gitignore` e `.env.example`: estado local ignorado e nomes de variáveis, sem valores.
- `docs/architecture.md`: arquitetura atual e critérios para expandir.
- `docs/development.md`: comandos, agentes, CI, deploy e pendências.
- `.github/pull_request_template.md`, quando GitHub for o provedor: resultado, validação e dependências.
- `.agents/skills/task` e `.claude/skills/task`: cópias completas, portáteis e iguais.
- `.setup-projeto/manifest.json`: recibo dos hashes gerados, sem autoridade para sobrepor diferenças.

Arquivos nativos de instrução que já existam são preservados e continuam sob controle do projeto.
O gerador não cria nem substitui configuração global de agente; Codex e Claude Code descobrem as
skills locais nos diretórios acima, e Hermes usa sua instalação de skills documentada.

CI, licença, Docker, monorepo e infraestrutura entram quando o projeto realmente precisa.
Não adicione licença aberta sem decisão de distribuição. Para CI, derive o runtime e instalação
do lockfile e crie um workflow que execute os checks reais. Comandos de ambiente podem ser
combinados em um script quando isso evitar divergência entre local e CI.

Evite afirmações genéricas de que tudo está pronto. O setup termina com a condição específica:
por exemplo, Git local e skills preparados, testes executados, CI remoto pendente por ausência
de provedor. Se a intenção incluiu remoto e há acesso, continue até configurar e verificar remoto.


---

## Referência: templates/estado-da-skill.md

---
type: Skill Instance
title: Estado privado de Setup de projeto
status: draft
agentflix:
  schema_version: 1
  skill_id: setup-projeto
  observation: unknown
  installed_version: null
  content_revision: null
  monitoring: not_configured
---

# Estado privado

Modelo para ambiente sem script, com capacidade de persistir Markdown. Substitua nulos só por valores observados.
Os campos `agentflix` são extensão AgentFlix. Nunca gravar este arquivo preenchido no pacote público.

- Início da observação contínua e limitações de cobertura:
- Última execução humana registrada (ID e instante):
- Última entrega concluída (ID e instante):
- Contagens derivadas dos eventos, separando humano e rotina:
- Artefato atual e revisão pessoal prevista:
- Avaliação de rotina e motivo:
- Autorização, ID do agendamento, frequência, horário, fuso e canal:
- Intervalo de inatividade combinado e política de silêncio:
- Alertas entregues, pendentes e sinais já resolvidos:
- Versão remota conferida, fonte e instante, ou não verificada:
- Histórico de verificação de conteúdo, evidências e revisão verificada:

Sem evento de execução, não afirmar uso. Sem observação contínua, não afirmar ausência de uso.


---

## Referência: templates/evento-de-uso.json

{
  "schema_version": 1,
  "event_id": "EXEMPLO-SUBSTITUIR",
  "run_id": "EXECUCAO-SUBSTITUIR",
  "skill_id": "setup-projeto",
  "at": "2026-09-08T15:00:00Z",
  "origin": "human",
  "operation": "create",
  "result": "completed",
  "version": "1.0.0",
  "content_revision": "1.0.0",
  "artifact_ref": "artefatos/entrega-r1.md",
  "verification": "passed"
}


---

## Referência: integrity.json

{
  "schema_version": 1,
  "version": "1.0.0",
  "algorithm": "sha256",
  "files": {
    "LICENSE": "6244738960f2a27905404edf750104381130189da33464d197b46c300126a48d",
    "SKILL.md": "aacf6626321c94b3eda05fbb29182539c8d05616e5f017a7e27a8d525c56d4c8",
    "agents/openai.yaml": "0c048ba2d6f49045cab45aee0c62687736122bd0ab88d8fd3332f027111eae84",
    "assets/task/SKILL.md": "39d2f00328efbfcfe0f56ef5a645597240404e1a9537d575cbb567d6327efa4c",
    "assets/task/agents/openai.yaml": "78127c7ffd0749dd714fd77ae013a001cc6c47928c2c70bfb5c2297f5e8d7cde",
    "assets/task/references/workflow.md": "2c0fbfb04b57b8c44682e6ec5889dd2eeb40c27ba9a41f069ec7c0094a8895f4",
    "assets/task/scripts/task_context.py": "cf464ac0e0991d7df99a52440668ce05e6040cd6b09f69039d518788182e5bf0",
    "references/ativacao.md": "ac5c4cf039d1ce647558dbae5e050856fc0713ff50e7910c59f6775dd6bf3531",
    "references/ciclo-de-vida.md": "388f42c467f47a0b1a0b383189e42f69cc5488893893f6abf3ba61af3a7f0998",
    "references/conhecimento.okf.md": "33f233fb843ff714436afb8fdb902362299802f18aacde72a124467498800169",
    "references/contrato-agentflix.md": "2137cd2f1e4e627a271e1ccffd9874d4a209537cbb107825ca1e424d4787ceff",
    "references/existing-project.md": "f9116e97d735f75b48ad83ca8abbd179854cb2184e7e51f067b12c5976990888",
    "references/github.md": "11678e5e112c9adba26182e141ccfb5a1b2fe41377e1bfb56ffd37acd7c7116d",
    "references/identidade.json": "8a210220cbf79fa972cd3425942bf9976e78701907ec722d6db088870865e665",
    "references/project-contract.md": "eb38e9aa7278d5e934d68a122456eda842949c6cf866425867455abc0646cf80",
    "scripts/auditar.py": "d97f7f9b48b862bedc0999d20a20223055c80e8f70f0adba6088ea8a81f52f40",
    "scripts/setup_project.py": "f8a3d22b835efac35db584bc09646dd8a6e649ad9dc6dd2678c2a3d32118ffbe",
    "templates/estado-da-skill.md": "5ef67d67b29cf2600ddb7ad2fc93a714664646c87b542b5a9faaf65db2c9da35",
    "templates/evento-de-uso.json": "0fe9c83959c6d7effb59f52a7bc16a7463c8bf819355d66efcc9289f21e22b6d"
  }
}


---

## Não incluído neste arquivo (está no zip da skill)

- `assets/task/scripts/task_context.py (script: só no zip)`
- `scripts/auditar.py (script: só no zip)`
- `scripts/setup_project.py (script: só no zip)`
