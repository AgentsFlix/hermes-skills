> Antes de conduzir perguntas deste material, aplique `references/contrato-agentflix.md`: aproveite memória atual, pergunte só lacunas e acompanhe cada pergunta aberta com exemplo contextual.

# Preparar um projeto que já existe

Leia quando a pasta tiver arquivos ou histórico. Organização começa identificando a fonte ativa,
o funcionamento esperado e as mudanças em andamento. A mera existência de pastas duplicadas,
nomes antigos ou build outputs não autoriza apagar conteúdo.

## Diagnóstico

Use o `inspect` e complete apenas o necessário:

- Raiz Git, base, branches, worktrees, remotos e PRs, quando houver Git.
- Instruções existentes, manifests/lockfiles, comandos de desenvolvimento e checks.
- Código que o usuário realmente executa, arquivos gerados e possíveis projetos aninhados.
- Modificações locais, arquivos novos e arquivos ignorados relevantes, por nomes primeiro.

Informe uma síntese: fonte encontrada, comandos encontrados, pendências e mudança proposta.
Pergunte somente quando duas fontes concorrentes não puderem ser resolvidas por evidência,
ou quando objetivo/alvo for desconhecido. Não transforme todo projeto existente numa migração.

## Preservação e execução

Em Git existente, siga as instruções carregadas pelo cliente, `CONTRIBUTING.md` e a decisão da `task`. Uma worktree nova
contém commits, não o trabalho ainda não commitado. Se o setup depende desse trabalho, mantenha
o diagnóstico na pasta original e escolha uma intervenção explícita sem movê-lo automaticamente.
Não faça checkout de outra base em pasta suja, stash/reset/clean ou commit coletivo para facilitar.
Quando todo o trabalho pendente for comprovadamente da tarefa e a pasta for exclusiva, a `task`
pode criar uma branch no HEAD atual, sem trocar os arquivos. Essa atribuição precisa de evidência;
o simples fato de haver só um usuário não resolve alterações de outras sessões.

Sem Git, prepare ignores antes do commit inicial e adicione só caminhos revisados. A ausência
de Git não autoriza enviar todos os arquivos ao remoto. Credenciais e material local continuam
fora do histórico.

Reestruturação de código só faz parte do setup quando necessária para tornar comandos e fonte
inequívocos. Preserve comportamento, imports e scripts; use passos pequenos e verificações
reais. Quando existir risco de perda, crie uma cópia local dos arquivos não secretos que serão
editados ou use o histórico existente. Nunca use um backup amplo como forma de duplicar segredos.

## Conflitos com documentos existentes

O gerador retorna `conflicts` e não aplica o lote quando encontra qualquer arquivo diferente da
proposta atual. O manifesto é apenas recibo e nunca autoriza sobrescrita. Isso exige conciliação
pelo agente, não desistência do setup:

1. Renderize a proposta em diretório temporário fora do projeto, com o mesmo briefing e fonte
   da `task`. Não inicialize Git nem publique esse diretório.
2. Compare cada documento proposto com o atual. Mantenha informações válidas, contratos locais,
   autoria e comandos reais. Acrescente ou ajuste apenas o que o setup precisa.
3. Aplique patches explícitos nos arquivos que pertencem ao escopo autorizado. Para `.gitignore`,
   acrescente as regras necessárias preservando as existentes. Arquivo de credenciais real não
   entra nessa conciliação; `.env.example` só recebe nomes sem valores.
4. Copie arquivos ausentes e instale a skill completa. Uma skill `task` existente com conteúdo
   próprio é um contrato a preservar/adaptar; compare antes de qualquer atualização.
5. Confira o diff e a descoberta das instruções/skills no cliente. Relate a conciliação manual.
   Depois da conciliação, o gerador só aceita o arquivo quando seus bytes já forem iguais à
   proposta; não altere hashes para fingir que conteúdo humano é saída intacta.

Não sobrescreva arquivos de instrução já carregados pelos clientes só para igualar um template.
Mantenha o conteúdo vigente e concilie as regras necessárias no contrato que o runtime realmente
carrega. O setup novo usa skills locais e documentação compartilhada, sem criar uma ponte global.
