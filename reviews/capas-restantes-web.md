# Capas primárias restantes · exportação pública

Objetivo: usar na vitrine as 37 capas primárias aprovadas fora de Lendas do
Copy, com URLs versionadas em Cloudflare Images. O lote é
`covers/primarias/5a6712f044e3c159/`, com 148 variantes. Não copiar masters
PNG, manifesto de revisão, evidências internas ou outras fontes privadas.

Fonte autoritativa: `apps/web/` no repositório privado AgentFlix, PR
[AgentsFlix/agentsflix#235](https://github.com/AgentsFlix/agentsflix/pull/235),
integrado na `main` em `cc57f44f25d84f291b5a350fd780a46dc19621ec`.
A exportação pública seletiva trouxe `site/index.html`, `site/vitrine.js` e
`site/compartilhar/`, após confirmar que os seis arquivos eram idênticos à
fonte privada integrada. O CDN respondeu para 148/148 URLs; QA no Chrome
carregou os 37 cards e o hero em 1440, 768 e 390 px, sem overflow ou erros JS.

Validação local pública: `python3 scripts/check_site.py` passou, e
`python3 -m unittest discover -s tests` passou com 166 testes (1 skip).
Pendente: checks e merge do PR público, deploy Vercel e verificação do domínio.
Este registro não declara publicação concluída.
