> Antes de conduzir perguntas deste material, aplique `references/contrato-agentflix.md`: aproveite memória atual, pergunte só lacunas e acompanhe cada pergunta aberta com exemplo contextual.

# Compatibilidade e validação

Base macOS validada localmente na revisão 1.2.0, setembro de 2026: `.app` na Mesa, onboarding só na
primeira abertura, cartões ilustrados, colagem da URL, legenda portuguesa pronta sem Luna e revisão
opcional exibida no app. A interface interna usa WebKit/WebView2 e servidor em loopback; não é um app web.
Windows 11 ARM64 em Parallels: bootstrap, dependências, build x64 por emulação, abertura do `.exe` e
exibição do código de autenticação verificados. A transcrição completa, cópia e download no Windows ainda
não foram validados; os testes foram encerrados a pedido do autor. Windows x64 e Mac Intel têm caminhos
de instalação implementados, sem teste de ponta a ponta documentado nesta revisão.

A criação de terminal extra no login Windows foi corrigida no código desta distribuição; sua regressão
foi verificada por testes de subprocesso, sem novo ensaio visual do `.exe` no Windows.

Não há garantia de exatidão. Reconhecimento local e revisão contextual podem errar nomes, números e termos.
A revisão usa o acesso da própria pessoa ao Codex, com seus limites e disponibilidade de GPT-5.6 Luna.
Nenhuma credencial do autor, mídia de usuário, modelo de voz ou dependência instalada vai no pacote.
URLs do YouTube dependem de legenda manual ou automática acessível e de compatibilidade atual do yt-dlp
com o vídeo. O app não baixa áudio nem executa Whisper para essa entrada; sem legenda, informa o limite.
Legenda em português aparece diretamente; a melhoria com Luna é opcional. Se a legenda acessível estiver
em outro idioma, Luna a traduz para português do Brasil, sujeita aos limites da conta e do modelo.
