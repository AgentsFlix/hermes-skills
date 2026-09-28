> Antes de conduzir perguntas deste material, aplique `references/contrato-agentflix.md`: aproveite memória atual, pergunte só lacunas e acompanhe cada pergunta aberta com exemplo contextual.

# Briefing e contrato de projeto

O briefing é produzido pelo agente a partir dos arquivos e da conversa. O usuário não precisa
escrever JSON. Não coloque segredos, logs completos ou dados de clientes nele. O gerador aceita
somente os campos documentados, e todos os caminhos de componentes são relativos ao projeto.

Exemplo completo para um projeto local que já contém `organizador.py` e `tests/`:

```json
{
  "version": 1,
  "name": "Organizador de aulas",
  "description": "Organiza arquivos de aulas por curso e identifica duplicatas antes de mover qualquer arquivo.",
  "stack": ["Python 3.12, biblioteca padrão"],
  "components": [
    {"path": "organizador.py", "purpose": "Inspeção de arquivos e plano de organização"},
    {"path": "tests", "purpose": "Verificação da detecção de duplicatas com dados temporários"}
  ],
  "commands": {
    "setup": null,
    "dev": "python3 organizador.py --help",
    "check": "python3 -m unittest discover -s tests -v",
    "build": null
  },
  "git": {"default_branch": "main", "remote": null, "provider": "local"},
  "workflow": {"isolation": "auto", "merge": "auto"},
  "deployment": {"status": "execução local; publicação não prevista", "provider": null, "command": null},
  "environment_variables": []
}
```

Esse exemplo não é um esqueleto de aplicação a ser copiado para todo projeto. Só use comandos
e componentes encontrados ou implementados na preparação. Para projeto realmente vazio,
`stack` e `components` podem ser listas vazias; comandos inexistentes são `null`. Os documentos
registram então a lacuna e a próxima ação. Não preencha com marcadores, promessas ou comando falso.

| Campo | Como preencher |
|---|---|
| `name`, `description` | Nome e resultado concreto do projeto, derivados da conversa/README/código |
| `stack` | Tecnologias e runtimes confirmados; `[]` enquanto não definidos |
| `components` | Caminhos atuais com responsabilidades reais; não antecipe pastas futuras |
| `commands` | `setup`, `dev`, `check`, `build`: comando real ou `null`; o gerador não os executa |
| `git.default_branch` | Base real; `main` é sugestão apenas para repositório novo |
| `git.remote` | Nome do remoto, como `origin`, ou `null`; nunca URL, token ou conta implícita |
| `git.provider` | Provedor confirmado, ou `local` |
| `workflow` | `isolation: auto`; `merge: auto` ou `manual`, respeitando contrato/autorização |
| `deployment` | Estado atual, provedor e comando quando existem; não declarar deploy executado |
| `environment_variables` | Lista opcional só com nomes necessários; valores nunca entram |

O mapa `.agent-project.json` produzido também registra estados de setup pendentes de verificação.
O agente só muda esses estados depois das evidências correspondentes. Não reimporte cegamente o
mapa inteiro como briefing: remova o objeto `setup` ao gerar uma revisão e preserve evidências
de CI/proteção ainda vigentes. Os documentos gerados são um ponto de partida específico; depois
de implementar/verificar uma etapa, atualize o documento para refletir o resultado verdadeiro.

## Saídas e extensão

- `README.md`: objetivo, estrutura e início de uso.
- `CONTRIBUTING.md`: tarefa, isolamento, validação, integração e encerramento.
- `.agent-project.json`: mapa portátil para a `task`.
- `.gitignore` e `.env.example`: estado local ignorado e nomes de variáveis, sem valores.
- `docs/architecture.md`: arquitetura atual e critérios para expandir.
- `docs/development.md`: comandos, agentes, CI, deploy e pendências.
- `.github/pull_request_template.md`, quando GitHub for o provedor: resultado, validação e dependências.
- `.agents/skills/task` e `.claude/skills/task`: cópias completas, portáteis e iguais.
- `.setup-projeto/manifest.json`: recibo dos hashes gerados, sem autoridade para sobrepor diferenças.

Arquivos nativos de instrução que já existam são preservados e continuam sob controle do projeto.
O gerador não cria nem substitui configuração global de agente; Codex e Claude Code descobrem as
skills locais nos diretórios acima, e Hermes usa sua instalação de skills documentada.

CI, licença, Docker, monorepo e infraestrutura entram quando o projeto realmente precisa.
Não adicione licença aberta sem decisão de distribuição. Para CI, derive o runtime e instalação
do lockfile e crie um workflow que execute os checks reais. Comandos de ambiente podem ser
combinados em um script quando isso evitar divergência entre local e CI.

Evite afirmações genéricas de que tudo está pronto. O setup termina com a condição específica:
por exemplo, Git local e skills preparados, testes executados, CI remoto pendente por ausência
de provedor. Se a intenção incluiu remoto e há acesso, continue até configurar e verificar remoto.
