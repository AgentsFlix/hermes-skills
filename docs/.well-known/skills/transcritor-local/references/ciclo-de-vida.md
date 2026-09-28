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
python3 scripts/auditar.py --state "$HOME/.local/share/agentflix/transcritor-local" init --version 1.2.0 --revision 1.2.0
python3 scripts/auditar.py --state "$HOME/.local/share/agentflix/transcritor-local" record --event /caminho/privado/evento.json
python3 scripts/auditar.py --state "$HOME/.local/share/agentflix/transcritor-local" configure --policy /caminho/privado/politica.json
python3 scripts/auditar.py --state "$HOME/.local/share/agentflix/transcritor-local" audit
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
python3 scripts/auditar.py --state "$HOME/.local/share/agentflix/transcritor-local" ack --id ID_RETORNADO_NA_AUDITORIA
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
