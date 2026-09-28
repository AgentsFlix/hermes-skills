# Leitura visual do dashboard executivo

Pedido: compreender atividades, conteúdos líderes, preferências e ritmo de uso por
proporções e gráficos. Exportação gerada dos arquivos autorizados de administração,
sem alteração de banco, permissões ou coleta.

## Evidência anterior

Capturas com dados exclusivamente sintéticos, injetados apenas no navegador de QA:

- [1440 px](../design-review/dashboard-visual/before/dashboard-1440.png)
- [768 px](../design-review/dashboard-visual/before/dashboard-768.png)
- [390 px](../design-review/dashboard-visual/before/dashboard-390.png)

Implementação e evidências posteriores serão incluídas após conclusão da fonte.

## Resultado e evidência posterior

- Mapa proporcional de cópias/aberturas/inícios; visitas como contexto.
- Anéis de participação de modos e aparência de leitura.
- Rankings com barras largas, cinco primeiros itens e expansão para todos.
- Três trilhas diárias na mesma escala, hachura para dias sem coleta.
- Eventos de aulas comparados visualmente em escala comum; detalhes sob demanda.

Capturas sintéticas posteriores:

- [1440 px](../design-review/dashboard-visual/after/dashboard-1440.png)
- [768 px](../design-review/dashboard-visual/after/dashboard-768.png)
- [390 px](../design-review/dashboard-visual/after/dashboard-390.png)
- [Baixo volume1440](../design-review/dashboard-visual/after/low-1440.png)
- [Baixo volume768](../design-review/dashboard-visual/after/low-768.png)
- [Baixo volume390](../design-review/dashboard-visual/after/low-390.png)
- [Coleta parcial](../design-review/dashboard-visual/after/partial-390.png)
- [Vazio](../design-review/dashboard-visual/after/empty-390.png)
- [Erro](../design-review/dashboard-visual/after/error-390.png)
- [Carregando](../design-review/dashboard-visual/after/loading-390.png)
- [Sem sessão](../design-review/dashboard-visual/after/signed-out-390.png)
- [Sem permissão](../design-review/dashboard-visual/after/forbidden-390.png)
- [MFA](../design-review/dashboard-visual/after/mfa-390.png)

## Verificação e limites

Chromium sem overflow/erroJS nos três tamanhos; períodos7/90, expansão, tabela91 dias,
limpeza após erro/logout, teclado e movimento reduzido. Especialista revisou layout,
proporções, eixo e baixo volume. Dados injetados externamente no teste; produto não
inclui modo demonstrativo nem escreve eventos sintéticos no banco.

Proporções de atividade representam os três tipos somados; preferências representam
acessos, não pessoas. Rankings se comparam ao líder. Eventos de vídeo não são uma
coorte; engajamentos podem superar inícios na janela. Fluxo de autorização/RPC e
modelo preservados; banco e coleta permanecem os mesmos.

Checks locais:166 testes aprovados (1 skip), scanner de site sem erros, validação e
scanner de skills aprovados; geração de docs/catalog sem diferenças. Integração e
publicação serão confirmadas após os checks remotos.
