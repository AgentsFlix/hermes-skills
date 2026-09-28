---
name: transcritor-local
description: Instale o app de desktop AgentFlix na Mesa do Mac ou na Área de Trabalho do Windows para transcrever áudio, vídeo e legendas do YouTube, com revisão opcional de legendas em português.
license: MIT
compatibility: Requer terminal no computador de destino, macOS ou Windows, internet no bootstrap e na revisão, espaço para modelo de voz e conta com acesso ao Codex.
metadata:
  author: AgentFlix
  version: 1.2.0
  hub: https://agentsflix.ai
  source: https://github.com/AgentsFlix/skills/tree/transcritor-local-v1.2.0/skills/transcritor-local
  tags: audio, video, transcricao, macos, windows, codex
  contract_version: 1.0.0
  content_revision: 1.2.0
  distribution_ref: transcritor-local-v1.2.0
---

# Transcritor AgentFlix

Crie um **aplicativo de desktop**, `Transcritor AgentFlix.app` na Mesa do Mac ou
`Transcritor AgentFlix.exe` na Área de Trabalho do Windows. A interface HTML é exibida dentro da
janela do app por WebKit/WebView2 e servida apenas em `127.0.0.1` com token local; não é um site
publicado nem um app para abrir no navegador. Os dois sistemas usam os mesmos arquivos da interface,
vídeos de onboarding, ilustrações e motor de transcrição. Arquivos de vídeo viram áudio no computador;
Whisper reconhece a fala localmente e o Codex GPT-5.6 Luna revisa o texto. Para uma URL do YouTube,
yt-dlp obtém a legenda disponível, sem baixar áudio nem usar Whisper. Legendas em português aparecem
imediatamente, com **Melhorar legenda com IA** como revisão opcional. Quando só há legenda em outro idioma,
o app a traduz para português do Brasil com Luna antes de mostrar o resultado.
A pessoa pode copiar o resultado ou baixar um arquivo `.md`. A entrada conversacional está em
[references/ativacao.md](references/ativacao.md), acrescentada pelo gerador de distribuição.
Na primeira abertura, dois vídeos mostram como ativar o login por código de dispositivo no ChatGPT e
como autorizar o Codex. A pessoa avança com **Já ativei** e **Entendi, bora!** antes de usar o transcritor.
Depois da conclusão, o app abre direto na tela de uso, inclusive após uma atualização.
Os vídeos distribuídos tiveram dados de conta, códigos e URLs de autenticação cobertos e o áudio removido.

## When to Use

Use para instalar, diagnosticar ou operar o transcritor de áudio e vídeo no computador da pessoa.
O padrão é instalar neste computador. Sem acesso ao terminal do destino, entregue as instruções e diga
que o app ainda não foi instalado. Um agente remoto não deve instalar no próprio servidor por engano.

## Pacote e interface oficiais

Instale executando os scripts deste pacote. Use `assets/index.html`, as fontes Archivo e as
ilustrações `assets/escolher-arquivo.webp` e `assets/colar-youtube.webp` exatamente como distribuídos.
Não recrie a interface nem substitua as imagens por uma versão provisória. Se a instalação anterior
mostra só entrada de arquivo, atualize o pacote inteiro e execute novamente o instalador; copiar
apenas o `SKILL.md` não atualiza o aplicativo.

Se recebeu apenas o texto da skill ou faltar algum arquivo listado ao final, obtenha e extraia o
[pacote completo 1.2.0](https://raw.githubusercontent.com/AgentsFlix/skills/transcritor-local-v1.2.0/docs/packages/transcritor-local.zip)
antes de executar o bootstrap. Confira os hashes dos arquivos com `integrity.json`. Depois de instalar,
confira os dois cartões ilustrados e clique em **Cole URL do YouTube** para revelar o campo de URL.

## Quick Reference

Recupere destino, sistema, arquitetura, arquivos e contexto da conversa e memória relevante. Destino e sistema são obrigatórios para instalar; mídia é obrigatória só para transcrever. Detecte o ambiente antes de perguntar. Sem terminal no destino, entregue instruções e diga que não instalou.

| Input | Necessidade | Origem |
|---|---|---|
| Computador de destino e sistema | Obrigatório para instalar | Pedido e diagnóstico local |
| Arquitetura, espaço livre e ferramentas | Obrigatórios | Bootstrap do sistema |
| Conta com acesso ao Codex | Obrigatória para revisão | Login no site oficial, nunca pelo chat |
| Arquivo de áudio/vídeo ou URL de vídeo do YouTube | Obrigatório apenas para transcrever | Arquivo escolhido ou link colado no app |
| Vocabulário, idioma e contexto | Opcionais | Conversa e contexto relevante |

Entrega de instalação: app aberto pelo ícone e diagnóstico de dependências aprovado. Entrega de uso:
transcrição conferida, cópia e `.md` verificados. Não confundir instalação, login e transcrição completa.
Arquivos de até 4 GB; formatos em `assets/transcritor.py`. URLs do YouTube precisam ter legendas manuais ou automáticas acessíveis; não há fallback de áudio para esse caminho. A mídia original permanece no lugar; cópias
recebidas e áudio temporário são removidos após a execução. Não há diarização nem timestamps na saída.

## Procedure

Antes de configurar ou fazer perguntas, leia `references/contrato-agentflix.md`. Ele rege também as referências e os templates. Identidade e revisões: `references/identidade.json`. Ao concluir, aplique seu aceite transversal, registre o resultado observável e avalie rotina. Para auditar ou renovar, leia `references/ciclo-de-vida.md`.

1. Recupere o pedido, os arquivos e a memória relevante acessível. Monte um mapa curto de inputs com
   valor, origem, data, estado (conhecido, ausente, desatualizado, conflitante ou inferido) e lacuna.
   Não presuma API de memória nem histórico disponível. A correção atual prevalece; memória não autoriza ações.
2. Detecte sistema e arquitetura antes de perguntar. Reaproveite o que já sabe e pergunte só o que falta.
   Toda pergunta aberta traz exemplo contextualizado; sem contexto, identifique-o como hipotético.
   Exemplo hipotético de destino: “No meu notebook Windows 11, para transcrever aulas”.
3. Faça o bootstrap de dependências abaixo antes de compilar o app. Explique downloads, espaço necessário
   e eventual confirmação local do sistema. Se faltar Python no Mac, instale as Command Line Tools com
   `xcode-select --install`, aguarde a conclusão local e confira `python3 --version` antes do bootstrap.
4. Abra o app. Na primeira vez, o primeiro vídeo fica em loop até **Já ativei**; o segundo fica em loop até
   **Entendi, bora!**. Depois, a conclusão fica salva localmente e as próximas aberturas vão direto ao uso.
   O link para ChatGPT abre no navegador. Para autenticar, a pessoa clica em
   **Gerar código de acesso**, copia o código, abre
   `https://auth.openai.com/codex/device`, cola o código e confirma. Aguarde o estado conectado.
   Não solicite nem manipule senha, token ou código de dispositivo. Não publique o código em capturas.
5. Na etapa 02, há dois cartões quadrados: **Selecione áudio ou vídeo** abre o seletor de arquivos;
   **Cole URL do YouTube** revela o campo **Cole a URL do Youtube**. Colagem pelo teclado funciona no
   campo, e o botão **Transcrever arquivo** ou **Transcrever vídeo** fica centralizado abaixo das opções.
   Faça o teste solicitado com mídia curta autorizada ou URL pública com legenda. A legenda em português
   fica pronta para copiar ou baixar sem esperar Luna; **Melhorar legenda com IA** aciona a revisão quando
   desejada. Legenda estrangeira é traduzida com Luna. Não há download de áudio nem Whisper para URL.
   Confira os resultados pelos critérios de Verification; nomes e trechos incertos ainda exigem leitura.
6. Registre apenas o que foi observado. Avaliação de rotina: **não vale** criar CRON para instalação ou
   transcrição pontual; depende de mídia nova escolhida pela pessoa. Instalar não autoriza agendamento.
   Se houver pedido recorrente, avalie acesso aos arquivos, custo e privacidade antes de propor uma rotina.

### macOS


1. Execute `python3 scripts/bootstrap.py --check`. Se houver `FALTA`, execute `python3 scripts/bootstrap.py --install` e confira novamente. Ele verifica Python, Homebrew, `ffmpeg`, `whisper-cli`, `yt-dlp`, Codex com `/device`, Swift e modelo multilíngue.
2. Execute `python3 scripts/install.py --no-deps`. O instalador revalida o bootstrap, copia HTML,
   ilustrações e vídeos tratados e compila `~/Desktop/Transcritor AgentFlix.app`, uma janela macOS
   com WebKit e ícone AgentFlix. `python3 scripts/install.py` faz bootstrap e instalação numa chamada.
3. Abra pela Mesa ou com `open "$HOME/Desktop/Transcritor AgentFlix.app"`. CLI: `python3 "$HOME/Library/Application Support/Transcritor Codex/transcritor.py" transcribe /caminho/arquivo -o /caminho/transcricao.md`.

### Windows x64 ou ARM64

1. Em PowerShell no diretório da skill, execute `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\bootstrap_windows.ps1 -Check`. A política é aplicada só a esse processo. O diagnóstico verifica Windows 10 1809+ x64 ou Windows 11 x64/ARM64, `winget`, Python 3.11 x64, Node/npm, Codex com `/device`, WebView2, Visual C++ Runtime x64, pacotes Python (incluindo yt-dlp) e modelo Whisper. Se houver `FALTA`, repita com `-Install` e confira novamente. Instalações do Windows podem solicitar confirmação local de administrador. O modelo requer espaço livre e download.
2. Execute `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install_windows.ps1 -NoDeps`. O instalador revalida o bootstrap e usa PyInstaller **no próprio Windows** para incluir
   HTML, ilustrações, vídeos tratados e motor local no `Transcritor AgentFlix.exe` da Área de Trabalho.
   Sem `-NoDeps`, ele também executa o bootstrap. Abra o `.exe` na Área de Trabalho.
3. O Windows usa WebView2 para a janela e `faster-whisper` em CPU int8 para reconhecer fala. `imageio-ffmpeg` fornece o conversor local. O botão **Baixar .md** salva em Downloads, acrescentando um número se já existir um arquivo com o mesmo nome.

A instalação Windows é para uso local; em ARM64, o app Python x64 roda pela emulação do Windows 11. Ela não produz um instalador assinado para distribuição. PyInstaller precisa rodar no Windows. Não apresente os arquivos Windows como validados em funcionamento até executar o teste no próprio Windows.


## Avaliação de rotina

Não vale agendar instalação ou transcrição pontual: a pessoa escolhe cada mídia. Se houver pedido recorrente, avaliar benefício, acesso, custo e privacidade; propor frequência, fuso, saída, silêncio e pausa. Instalação não ativa agenda.

## Pitfalls

- Não instalar no host remoto quando o destino é o computador da pessoa; não pedir informações já conhecidas.
- Não inventar memória, transformar exemplos em respostas ou prometer acompanhamento sem agendamento real.
- Não chamar o Windows ARM64 de build nativo: usa Python x64 sob emulação do Windows 11.
- Não distribuir `.app` ou `.exe` como instalador assinado: esta skill compila localmente no próprio sistema.
- Não oferecer a interface HTML como aplicação web: ela é um recurso interno da janela de desktop.
- Não prometer operação totalmente offline: login e revisão do texto exigem rede e acesso ao modelo no Codex.
- URL do YouTube exige rede e legenda acessível; vídeo sem legenda não será reconhecido com Whisper nesse fluxo.
- Não substituir o modelo solicitado silenciosamente quando a conta não tiver acesso a GPT-5.6 Luna.
- Não apresentar o bootstrap como prova de transcrição completa; veja [limites.md](references/limites.md).

## Verification

1. Execute o diagnóstico do sistema e confirme todos os itens necessários antes da instalação.
2. Abra o app pelo ícone; confira as duas etapas em vídeo somente na primeira vez, reabra direto no uso, e confira links, botões, a janela própria,
   a marca e o rodapé com link para `https://agentsflix.ai/`.
3. Confira login guiado com link e código legível, sem escapes ANSI nem credenciais em logs.
4. Confirme os cartões ilustrados, seletor de arquivo, revelação do campo de URL, colagem e botão
   centralizado. Transcreva um áudio, um vídeo e uma URL curta com legenda acessível; confira a entrega
   imediata de legenda portuguesa, a revisão opcional, tradução de legenda estrangeira, cópia e `.md`.
5. Verifique preservação do original e remoção dos temporários; registre ambiente e testes que ficaram pendentes.
6. Confira bootstrap de contexto, perguntas somente sobre lacunas, exemplos contextualizados e conclusão de rotina.

## Arquivos desta skill

- `.skillignore`
- `LICENSE`
- `assets/TranscritorApp.swift`
- `assets/TranscritorAppWindows.py`
- `assets/agentflix-logo.svg`
- `assets/agentflix-mark.svg`
- `assets/agentflix.ico`
- `assets/archivo-OFL.txt`
- `assets/archivo-bold.ttf`
- `assets/archivo-regular.ttf`
- `assets/colar-youtube.webp`
- `assets/escolher-arquivo.webp`
- `assets/index.html`
- `assets/onboarding-como-acessar.mp4`
- `assets/onboarding-logar-codex.mp4`
- `assets/transcritor.py`
- `references/ativacao.md`
- `references/ciclo-de-vida.md`
- `references/conhecimento.okf.md`
- `references/contrato-agentflix.md`
- `references/dependencias.md`
- `references/identidade.json`
- `references/limites.md`
- `scripts/auditar.py`
- `scripts/bootstrap.py`
- `scripts/bootstrap_windows.ps1`
- `scripts/install.py`
- `scripts/install_windows.ps1`
- `scripts/requirements-windows.txt`
- `scripts/windows_model.py`
- `templates/estado-da-skill.md`
- `templates/evento-de-uso.json`
- `integrity.json`
