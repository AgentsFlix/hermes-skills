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
