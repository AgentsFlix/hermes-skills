# Diagnóstico e metodologia ECF

PR: https://github.com/AgentsFlix/skills/pull/67
Branch: `codex/diagnostico-ecf`
Estado: prévia, sem merge ou publicação em produção.

## Resultado

Quatro páginas visuais ensinam a metodologia com a história dos dois perfis do autor, as três moedas, exemplos de desequilíbrio, formatos e tratamentos editoriais. O final encaminha à coleta Zernio e ao diagnóstico determinístico já implementado no contrato v4.

Cada card didático tem uma barra. São exemplos independentes das nove medições reais do diagnóstico. Creator = Atenção, Expert = Autoridade e Founder = Ação na metodologia; métricas de Expert continuam sinais de interesse e métricas de Founder, ações observadas. Não há inferência automática de doença, autoridade ou vendas a partir dos scores.

## Escopo

- `site/assistir/hermes-em-operacao/diagnostico-ecf/`
- `tests/test_ecf_diagnostic.py`
- `design-review/diagnostico-ecf/`
- Este registro individual.

Os prints foram fornecidos para a história e têm origem documentada junto aos assets. Dados JSON reais de diagnóstico e conteúdo de mensagens não fazem parte do PR.

## Verificação

90 testes locais executados, 1 omitido pela versão do Python e os demais aprovados. Sintaxe do site, validação das 52 skills, scanner com zero bloqueios e build_docs sem diferenças nos arquivos gerados. QA Chrome em 1440, 768 e 390 px das quatro páginas e suas variações, imagens/modal, teclado, navegação/foco, recarga e movimento reduzido. Regressão do importador, compatibilidade v3/v4, CLI extraído do prompt, notas, hash e exportação/reimportação também aprovada.

Evidências: `design-review/diagnostico-ecf/method-resultado.json`, capturas `method-*` e registros de cálculo/compatibilidade anteriores no mesmo diretório. As verificações automáticas não constituem revisão independente por outro agente nem autenticação das fontes de Instagram.

## Limites e publicação

A nova abertura aguarda revisão visual conforme `design.md`. O PR segue rascunho. Os exemplos de tratamento explicam a metodologia e não implementam um plano editorial automático.

90 testes e QA locais aprovados antes do envio; o resultado dos checks do HEAD final deve ser consultado no PR. A worktree e a prévia ficam disponíveis para revisão.
