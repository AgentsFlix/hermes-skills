# Diagnóstico ECF: métricas nativas do Zernio

Página independente em `/assistir/hermes-em-operacao/diagnostico-ecf/`. Apresenta três cards, nove barras, médias e régua ajustável. O método atual é **ecf-zernio-v4**, solicitado em 10/09/2026 para usar somente métricas disponibilizadas pelo Zernio. A classificação de posts, comentários e DMs e a pesquisa de percepção deixam de ser pré-requisitos. A pedido do usuário, v4 substitui Novos seguidores por Contas engajadas para usar uma contagem nativa de conta sem interpretação de breakdown.

Creator organiza atenção, Expert organiza interesse e Founder organiza ações no perfil. São indicadores operacionais, não prova de expertise, intenção de compra, leads qualificados ou receita. A página não chama uma IA nem consulta o Instagram; lê o JSON local em memória.

## Metodologia em quatro páginas

A abertura ensina o modelo com comparações, prints e exemplos interativos antes da coleta.

1. **A história:** um perfil para curtidas/seguidores versus três ativos; os dois perfis de José Carlos e a experiência de vendas, com os três prints fornecidos e ampliação. CTA: Confio, vamo nessa.
2. **As três moedas:** Atenção = Creator, Autoridade = Expert e Ação = Founder. Harmonia e três desequilíbrios alternam uma única barra por card. São combinações ilustrativas, independentes dos scores importados.
3. **O conteúdo:** escolha do ativo mostra três formatos e sua função. São exemplos de roteamento editorial, sem promessa de resultado; o mesmo formato pode servir a outro ativo conforme a pauta.
4. **O raio-x:** três exemplos de tratamento editorial e botão Fazer meu raio-x para o formulário Zernio existente. Não classifica automaticamente um perfil real como uma doença.

`method.js` e `method.css` isolam essa experiência. As quatro páginas usam estado em memória e hash `#metodo-1` a `#metodo-4`; não gravam respostas. Artes existentes ficam em templates compartilhados com o diagnóstico. A coleta, o contrato v4, as fórmulas e o validador continuam separados. A metodologia fala em autoridade; os números de Expert continuam indicadores de interesse, sem atestar autoridade ou vendas.

Os prints autorizados e suas fontes estão em `art/README.md`. Visualizações não recebem rótulo de alcance. O número de vendas é relato pessoal. A audiência da TV é apresentada em pontos domiciliares, sem conversão não demonstrada para pessoas.

## Métricas e régua proposta

| Card | Variável | Cálculo | Ideal inicial proposto |
|---|---|---|---|
| Creator | Alcance por seguidor | alcance total da conta na janela / base atual de seguidores | 300% |
| Creator | Curtidas | soma de likes / soma de reach dos mesmos posts | 5% |
| Creator | Compartilhamentos | soma de shares / soma de reach dos mesmos posts | 1% |
| Expert | Salvamentos | soma de saves / soma de reach dos mesmos posts | 2% |
| Expert | Comentários | soma de comments / soma de reach dos mesmos posts | 1% |
| Expert | Tempo assistido de Reels | mediana de tempo médio em ms / (duração em s × 1.000) | 50% |
| Founder | Cliques no perfil | profile_links_taps / alcance da conta na janela | 1% |
| Founder | Contas engajadas | accounts_engaged / alcance da conta na janela | 10% |
| Founder | Conversas no inbox | summary.uniqueConversations / alcance da conta na janela | 1% |

Os ideais são parâmetros propostos e ajustáveis; não são benchmarks de mercado. Nota = `min(100, 80 * observado / ideal)`. Atingir o ideal vale 80; notas podem subir até 100. Cada média usa pesos iguais entre variáveis disponíveis e explicita a cobertura. Zero medido vale zero; campo ausente não recebe nota. O Founder v4 muda uma variável e não é comparável ao Founder v3 como evolução de desempenho. Creator e Expert mantêm os cálculos nativos; as escalas v1/v2 permanecem diferentes.

Os posts não são separados por suposto eixo editorial. FEED, REELS e UNKNOWN entram nas taxas de conteúdo; STORY e AD identificados ficam de fora. Cada taxa usa o subconjunto com ambos os campos; ausência de campo nesse conjunto indica cobertura parcial. A falta de duração de um Reel afeta somente tempo assistido. UNKNOWN/video não prova REELS. A base atual de seguidores é identificada como snapshot, não substitui a base histórica de uma publicação.

## Fontes verificadas

Conferência da [OpenAPI pública do Zernio](https://zernio.com/openapi.yaml) em 10/09/2026:

- [Posts](https://docs.zernio.com/analytics/get-analytics): reach, likes, comments, shares, saves; igReelsAvgWatchTime em ms e videoDurationSeconds em segundos. completionRate é descrito para TikTok, não Instagram. engagementRate alterna o denominador e não é usado no cálculo.
- [Conta](https://docs.zernio.com/analytics/get-instagram-account-insights): reach, profile_links_taps e accounts_engaged como total_value da mesma janela, sem breakdown. Contas engajadas não é total_interactions, nem soma das interações dos posts. O método atual não consulta seguimentos, deixadas de seguir ou histórico de seguidores para Founder.
- [Inbox agregado](https://docs.zernio.com/inbox-analytics/get-inbox-volume): summary.uniqueConversations com accountId da conta selecionada, platform=instagram, fromDate e toDate. A consulta deste diagnóstico omite os filtros opcionais profileId e source para medir o agregado da conta. Um zero de consulta com filtros adicionais precisa ser conferido nesse escopo, mantendo accountId, plataforma e datas; nunca usar profileId isolado ou totais de outras contas, nem escolher o maior resultado. Campo ausente ou falha não é zero. Não soma faixas/dias, não inspeciona interlocutores ou mensagens e não afirma contar pessoas ou intenção qualificada. Esse ajuste não presume uma falha geral de profileId na API.
- [Contas conectadas](https://docs.zernio.com/accounts/list-accounts): followersCount e followersLastUpdated quando disponibilizados.

Disponibilidade depende de conta, permissões, plano, mídia e sincronização. Um campo documentado pode estar ausente. O prompt consulta apenas lacunas nos recursos necessários e preserva respostas anteriores; não tenta preencher ausências por classificação semântica. Dados de conta podem ter atraso de até 48 horas. A contagem do inbox reflete eventos registrados pelo serviço.

## Contrato e validação

O JSON v4 contém perfil, conta, janela, momento da coleta, régua e três recursos: `account`, `posts`, `inbox`. O Hermes extrai valores nativos e mantém metadados mínimos. `native.js` deriva as nove variáveis; nenhum campo `axes`, `score`, autoridade ou intenção é aceito como entrada v4.

Os recursos usam estados complete/partial/missing, origem e motivo. O validador confere IDs da mesma conta, paginação, unicidade dos posts, janela, campos e tipos, e mantém ausências explícitas. As origens e a autenticidade das respostas continuam dependendo da execução real do agente, não do validador. Resumos são limitados a 200 KB e 500 posts; recortes precisam indicar cobertura parcial.

O prompt incorpora `model.js`, `native.js`, `import.js` e `validator-cli.cjs` num executável local `validar-ecf.cjs`, sem dependências externas além de Node.js. A mesma lógica roda no navegador. O CLI grava um arquivo novo com permissão 0600 e não sobrescreve outro: saída 0 = completo; 2 = parcial com JSON criado; 1 = inválido/erro sem nova entrega. O recibo inclui notas e hash dos bytes escritos e declara que verifica estrutura/cálculo, não evidências privadas. Para v4, o recibo precisa identificar contract=ecf-zernio-v4. A orientação exige substituir e reexecutar um validador antigo, sem apenas editar o texto do recibo. Notas no recibo e na tela são arredondadas ao inteiro; zero exibido pode representar uma fração positiva.

`import.js` permite apenas reparos seguros de BOM, bloco Markdown e números decimais inequívocos. Recusa duplicatas, campos fora do contrato, contagens fracionárias/ambíguas, misturas de contas e divergência do perfil/janela/régua do pedido. Não inventa números a partir de frases.

## Compatibilidade e interface

Arquivos `ecf-metas-v1`, `ecf-inicial-v2` e `ecf-zernio-v3` continuam sendo exibidos nas escalas anteriores. Uma importação v3 mantém Novos seguidores e suas notas; a interface identifica o método e oferece **Atualizar métrica Founder**. Não transforma follows em accounts_engaged nem altera silenciosamente as notas antigas.

A ação v3 prepara uma cópia v4 com os demais valores e ideais preservados, remove follows/novos_seguidores e deixa accounts_engaged ausente até receber a fonte nativa. O novo ideal proposto é 10%. O prompt de continuação leva essa cópia e sua régua correspondente. JSONs v1/v2 sem dados nativos completos geram um pedido para reaproveitar as respostas originais, sem transformar taxas semânticas em valores nativos.

No v4, **Completar métricas** reaproveita o JSON atual. **Ajustar régua** recalcula as notas em memória e os prompts seguintes usam essa régua. Fontes, critérios e exportação do JSON ficam recolhidos nos detalhes. Nove valores disponíveis podem continuar com cobertura parcial, por exemplo em Reels sem duração. Nenhum relatório real é incluído nas capturas ou no repositório público.

## Arquivos e testes

- `model.js`: métodos históricos v1/v2, preservados.
- `native.js`: contrato, validação, cálculo e exemplo fictício v4, com leitura v3 preservada e migração explícita.
- `import.js`, `validator-cli.cjs`: importação segura e entrega executável.
- `ecf.js`, `index.html`, `ecf.css`: três cards, formulário e geração do prompt.
- `prompt.md`: coleta dos recursos nativos e resolução limitada de credencial no perfil Hermes.
- `tests/test_ecf_diagnostic.py`: médias, fontes, unidades, cobertura, compatibilidade e CLI.

Executar a suíte do repositório, check_site, validação/scanner de skills, build_docs sem diferença, agent_work check e QA em Chrome real em 1440, 768 e 390 px. Capturas de demonstração ficam em `design-review/diagnostico-ecf/`; dados reais ficam locais.
