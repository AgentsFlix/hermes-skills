# Carregamento local sem reiniciar a tela

Correção técnica autorizada: loader de tela somente na entrada e navegação para
outro destino. Atualizações locais não escondem nem descartam a rota, não pausam
o player e não reenviam foco ou rolagem. Clique no mesmo destino não o remonta.

Banner mantém a composição anterior até a próxima capa decodificar; imagem, texto
e seleção mudam juntos. Falha mantém o destaque anterior, troca rápida cancela a
preparação antiga e a rotação oculta fica suspensa. Novas imagens de uma página
aberta aguardam localmente, reservando seu espaço. Hover mantém preparação própria.
Hero legado não força troca por timeout, não apaga a capa durante o preparo e não
sobrepõe carregamentos. Capas, conteúdo, permissões e autenticação são preservados.

Arquivos Web exportados da fonte autorizada; compartilhamentos regenerados pelo
gerador da vitrine. Testes portáveis cobrem decode, falha, recuperação, cancelamento,
refresh sem ocultar a página, preservação de rolagem e navegação concorrente.

QA focado local: 11 segundos / 1.397 frames, incluindo troca automática do banner:
zero frames de loader global, página escondida ou imagem incompleta; scroll 300 px
preservado. Clique físico no menu já selecionado conservou scroll 350 px.
Login real e matriz de dispositivos dispensados pelo usuário para este incidente;
isso não certifica o fluxo autenticado completo. Produção será conferida após merge.

Validação local do export: 175 testes (1 skip previsto), `check_site.py` sem erros,
paridade dos nove arquivos Web com a fonte e reserva de escopo válidas.

Sem dependência de outras alterações de catálogo ou de conteúdo. Não publicar
credenciais, dados de alunos ou artefatos internos. Rollback por PR de revert.
