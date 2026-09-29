# Saída da conta com alterações pendentes

O logout deixa de ser recusado por conflitos de sincronização. Antes de encerrar
a autenticação, o cliente tenta sincronizar e verifica uma cópia local das
pendências vinculada à conta. O cache ativo é limpo após sucesso; somente a mesma
conta recupera rascunhos, conflitos e exclusões ao entrar novamente.

Exportação limitada a `site/memory.js`. Sem alteração visual ou comercial.
Testes de confiabilidade cobrem gravação normal, conflito, falha de sincronização,
dados grandes, isolamento entre contas e falhas de autenticação/armazenamento.
O armazenamento de recuperação é local ao navegador e não equivale a cópia na
nuvem. Integração e deploy serão confirmados no PR.
