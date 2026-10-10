# Revisão visual do diagnóstico ECF

Primeira parte: três eixos, prompt de coleta com Zernio e conferência do resumo do agente.

As capturas `referencia-*` documentam a jornada de marca existente na base desta tarefa. A página ECF é nova, portanto não existe uma versão anterior da mesma rota. `depois-*` mostram a entrada ECF; `coleta-*`, a preparação; `diagnostico-*`, o relatório fictício.

QA realizado em Google Chrome real, em sessão isolada, com larguras de 1440, 768 e 390 px. Detalhes em `resultado.json`. Cópia testada com sucesso e rejeição simulados; conteúdo baixado conferido integralmente. Importações testadas por arquivo e texto, incluindo relatório vazio, componente ausente, texto malformado e tentativa de HTML dentro de uma fonte. Nenhum pedido externo partiu da página ECF. Dados de demonstração não representam nenhuma conta real.

O resumo permanece somente em memória na página; recarga remove a visualização. O navegador recalcula as notas, mas não autentica evidências do Instagram. A conferência de origem acontece na conversa do agente.

As capturas estão prontas para a revisão visual prevista no contrato de design. Não representam aprovação humana já concedida.


## Revisão após a primeira coleta

`antes-analise-*` mostra a entrada de relatório anterior. `depois-analise-*` mostra a ação **Gerar análise e conferir scores**, os indicadores descritivos e as interpretações por eixo, todos com dados fictícios. A continuação oferece um prompt para reutilizar a coleta na mesma conversa. As capturas cobrem 1440, 768 e 390 px.

O arquivo recebido foi validado somente em sessão local isolada, sem ser incluído no repositório ou nas capturas. O QA conferiu importação do formato estruturado de cobertura, ação explícita, indicadores sem meta, classificação com evidências, cópia/download de continuação, troca de arquivo/texto, exemplo anterior, rejeição de JSON inválido, escape de HTML e ausência de pedidos externos. Evidência resumida em `analysis-resultado.json`. A análise é produzida pelo Hermes; a página a organiza e calcula apenas os scores sustentados pelo contrato.


## Revisão: três cards e régua inicial

A pedido do usuário, o resultado principal passou a ter apenas Creator, Expert e Founder, com três barras por card, média, cobertura e marcador do ideal. `depois-analise-*` registra a apresentação anterior; `cards-*` registra a revisão em 1440, 768 e 390 px. Todas as capturas usam o exemplo fictício.

O usuário escolheu uma régua ECF inicial ajustável, identificada como proposta. O método v2 usa pesos iguais nas médias, informa medições parciais e permite editar os ideais. O formulário transporta a régua ajustada no prompt. Os testes cobrem nove barras, três cards, médias, edição/restauração, geração/cópia do prompt v2, continuação da coleta, compatibilidade local com arquivo anterior, ausência de dados, escape de HTML, erro de JSON e ausência de overflow ou requisições externas. Detalhes em `cards-resultado.json`.

A escolha da régua não é uma aprovação visual do resultado final. O PR continua disponível para revisão.


## Revisão: contas engajadas no Founder

`accounts-before-*` registra o exemplo v3 com Novos seguidores; `accounts-after-*` registra o exemplo v4 com Contas engajadas, em 1440, 768 e 390 px. As demais oito variáveis e o layout dos três cards permanecem. O ideal proposto da nova variável é 10%, ajustável na mesma régua. Todas as capturas usam dados fictícios.

O QA em Chrome conferiu ajuste/restauração, contrato v4 no prompt copiado, execução do validador extraído do prompt, notas e hash, leitura v3 na escala original, migração explícita com preservação dos valores e ideais, importação de nove valores com cobertura parcial e exportação/reimportação sem alterações. A migração não converte seguidores em contas engajadas. Sem overflow nas três larguras, erros de página ou chamadas externas. Detalhes em `accounts-resultado.json`.


## Metodologia em quatro páginas

`method-before-*` mostra a abertura anterior em 1440, 768 e 390 px. `method-after-1-*` a `method-after-4-*` mostram história, três moedas, formatos e raio-x nessas larguras. Os três prints da história foram fornecidos pelo autor para esta peça; origens em `site/assistir/hermes-em-operacao/diagnostico-ecf/art/README.md`. Os demais exemplos e barras são ilustrativos, sem JSON ou dados privados da coleta.

As capturas `method-scenario-*`, `method-format-*` e `method-treatment-*` mostram estados alternativos. QA Chrome em sessão isolada: navegação/foco, retorno/recarga, ampliação de cada print, Escape, teclado, movimento reduzido, uma barra por card, nove formatos e três tratamentos. A ação Fazer meu raio-x chega ao formulário existente. O prompt conserva o contrato v4 e o diagnóstico mantém nove variáveis, artes e notas. Sem overflow, erros de página ou requisições externas. Resultados em `method-resultado.json`.

Visualizações permanecem identificadas como visualizações. A experiência de vendas é relato pessoal; a audiência de TV usa pontos domiciliares sem estimar pessoas. A nova abertura está em prévia para revisão visual.
