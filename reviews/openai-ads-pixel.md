# Medição OpenAI Ads

O pixel usa o transporte oficial Image Tag, com consentimento próprio inicialmente recusado. Eventos explícitos na vitrine pública: visita, item aberto e início de checkout; compras e assinaturas dependem de pagamento e confirmação do webhook verificados no backend autenticado. Não carrega o SDK de correspondência automática e não lê formulários.

A loja continua desligada e em modo de teste. Não cria campanhas. Publicação e confirmação de ingestão pendentes no momento deste registro.

## Verificação

- Testes funcionais da fonte autoritativa: consentimento, exclusão de QA/previews, campos permitidos, preservação do checkout, propriedade da compra, pagamento pendente e reembolso, configuração sem segredo.
- QA local em 1440, 768 e 390 px com adaptador sintético, sem enviar eventos externos. Novos controles com 44 px; nenhuma rolagem horizontal. Recusa, revogação e reabertura verificadas.
- Capturas em `design-review/openai-ads-pixel/`: `before-*` usa a vitrine local sem o adaptador de consentimento; `consent-*` mostra a nova escolha; `privacy-*` mostra a seção e os controles. Todos os estados usam dados locais, sem conta de aluno.

## Limites

Recebimento pelo pixel não prova atribuição. Ausência de consentimento, bloqueadores e abandono podem impedir envio. Pagamentos assíncronos precisam de visita na mesma aba em até 48 horas. Compra real ainda não testada.
