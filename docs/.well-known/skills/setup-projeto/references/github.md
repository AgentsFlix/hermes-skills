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
