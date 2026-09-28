# Transcritor AgentFlix 1.2.0

## Entrega

Exportação gerada pelo pacote autoral `transcritor-local` como aplicativo desktop: `.app` na Mesa do macOS ou `.exe` na Área de Trabalho do Windows. A interface é embutida no aplicativo e servida apenas pelo loopback local; não há hospedagem web. Inclui dois vídeos de orientação tratados para distribuição pública, conclusão do onboarding persistida no computador e entrada de URL do YouTube na etapa 02. O caminho de URL obtém a legenda disponível com yt-dlp, sem baixar áudio nem chamar Whisper. Legendas em português ficam prontas imediatamente, com o botão opcional **Melhorar legenda com IA**; legendas em outro idioma são traduzidas para português com Luna. Arquivos locais continuam usando Whisper.

## Privacidade

Os vídeos distribuídos estão sem áudio e têm máscaras opacas sobre dados de conta, código e endereço de autenticação. Os arquivos de origem, credenciais, modelos de voz e mídias de uso não entram no pacote. O ZIP e as cópias portáveis são gerados da mesma allowlist da skill. A `.skillignore` cobre exclusivamente os dois MP4 tratados para o scanner de texto; os vídeos continuam presentes na distribuição e foram inspecionados separadamente.

## Verificação

O app macOS foi instalado e aberto na Mesa. A primeira conclusão do onboarding gravou o marcador local; a abertura seguinte foi diretamente à tela de uso. Os dois cartões ilustrados, a colagem de URL e o botão centralizado foram conferidos em desktop. A legenda de um vídeo público em português foi obtida e exibida sem revisão obrigatória. O pacote privado passou em 20 testes; o repositório público passou em 167 testes, incluindo a presença dos ativos no ZIP e na cópia portátil. O scanner classificou a skill como `safe`.

## Limites

URLs precisam de legenda manual ou automática acessível. O fluxo completo de transcrição no Windows ainda não foi ensaiado.


## Atualização da distribuição em 28/09/2026

O catálogo oficial ainda apontava para a release 1.1.0. A release 1.2.0 inclui o HTML, as fontes,
as duas ilustrações, os vídeos tratados e o motor no repositório, na cópia portátil e no ZIP.
Os hashes confirmaram bytes idênticos nessas três distribuições e no aplicativo macOS aprovado.
A orientação manda obter o pacote completo e executar o instalador oficial; se recebeu somente
um documento ou algum ativo faltar, aponta para o ZIP 1.2.0 e seu recibo de integridade.

Interface compartilhada conferida em 1440, 768 e 390 px: ilustrações carregadas, texto/botão legíveis
sem rolagem horizontal. Na janela desktop, o cartão YouTube revelou o campo, aceitou colagem e
habilitou Transcrever vídeo. A atualização deve ser reinstalada para alterar apps já existentes.
