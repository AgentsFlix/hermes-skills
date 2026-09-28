> Antes de conduzir perguntas deste material, aplique `references/contrato-agentflix.md`: aproveite memória atual, pergunte só lacunas e acompanhe cada pergunta aberta com exemplo contextual.

# Dependências, licença e efeitos da instalação

O código autoral do pacote está sob MIT (LICENSE). As fontes Archivo incluídas estão sob SIL OFL 1.1
(assets/archivo-OFL.txt). Nome, logo e ícone AgentFlix identificam o produto; a licença de software não
concede direitos de marca nem endosso a forks.

O bootstrap baixa ferramentas oficiais e modelos separadamente. Eles mantêm suas próprias licenças:
Homebrew, FFmpeg, whisper.cpp/Whisper, yt-dlp, Codex CLI, Python, Node.js, WebView2, Visual C++ Runtime,
faster-whisper/CTranslate2, imageio-ffmpeg, pywebview e PyInstaller. Os pacotes Python Windows têm
versões fixadas em scripts/requirements-windows.txt; os gerenciadores instalam as versões disponíveis
no momento para os outros componentes. Modelos não são incorporados ao ZIP da skill.

No Mac, cria cache Whisper, dados em Library/Application Support/Transcritor Codex e app na Mesa.
No Windows, cria ambiente Python, modelo e build em LOCALAPPDATA/Transcritor AgentFlix e exe na Área
de Trabalho. Downloads iniciais exigem rede e podem ocupar vários GB. O Windows requer pelo menos
4 GiB livres para modelo/build; a execução em CPU e por emulação pode ser lenta.

O servidor interno da janela de desktop escuta apenas em 127.0.0.1 com porta aleatória e token por sessão.
O arquivo é enviado para esse servidor local; apenas o texto reconhecido segue para o Codex. Para URL do
YouTube, yt-dlp busca somente a legenda disponível. Se estiver em português, o resultado aparece sem
chamada ao Codex e a revisão com Luna é opcional; se estiver em outro idioma, Luna traduz para português.
A legenda temporária é apagada após a extração ou tradução; áudio não é baixado nesse fluxo.
A conclusão do onboarding fica em um marcador local na pasta de dados e sobrevive à reinstalação do app.
A autenticação fica sob gestão
do Codex CLI. Não copie credenciais para a skill. A transcrição final é mantida na janela e no `.md`
que a pessoa salvar; o original de áudio/vídeo não é apagado.
