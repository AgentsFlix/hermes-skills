# Dashboard executivo da AgentFlix

## Resultado

Nova rota `/admin/metricas/` com filtros7/30/90 dias, contagens de comandos copiados,
leituras, modos e aparência, aulas iniciadas/engajadas/concluídas, atividade diária e
observações para orientar a próxima decisão. Acesso por Minha conta para administradores.

Exportação da fonte autorizada pelo gerador oficial, limitada aos caminhos reservados.
Depende de migração do produto com agregação protegida por administrador e MFA AAL2.
Nenhum registro pessoal, exercício, credencial ou fonte privada é exportado.

## QA visual e comportamento

A rota não existia na base desta entrega. Capturas de dados exclusivamente sintéticos:

- [Desktop1440](../design-review/dashboard-ceo/dashboard-1440.png)
- [Tablet768](../design-review/dashboard-ceo/dashboard-768.png)
- [Celular390](../design-review/dashboard-ceo/dashboard-390.png)
- [Vazio](../design-review/dashboard-ceo/empty-390.png)
- [Erro](../design-review/dashboard-ceo/error-390.png)
- [Sem sessão](../design-review/dashboard-ceo/signed-out-390.png)
- [Sem permissão](../design-review/dashboard-ceo/forbidden-390.png)
- [Segundo fator](../design-review/dashboard-ceo/mfa-390.png)

Playwright/Chromium: sem overflow da página em1440/768/390, sem erroJavaScript,
filtros7/90, expandir ranking, tabela equivalente ao gráfico, teclado e movimento
reduzido. RPC interceptada com dados sintéticos exclusivamente no teste externo;
não existe modo demonstrativo na rota publicada.

## Medição e limites

Visita é uma sessão por aba de até24 horas, não pessoa única. Skills contam comandos
copiados com sucesso; execução fora do site é desconhecida. Vídeo inicia em `playing`,
engaja por30 segundos de conteúdo ou90% de aula curta e conclui por90% de cobertura
única. Saltos e repetição não somam cobertura. Coleta independe da loja e exclui QA.
Dias anteriores à coleta dizem Sem coleta; comparação exige períodos completos.

Checks locais e estado de publicação serão confirmados no PR.
