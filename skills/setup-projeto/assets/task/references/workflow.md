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
