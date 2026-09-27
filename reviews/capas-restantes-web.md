# Capas primárias restantes · exportação pública

Objetivo: usar na vitrine as 37 capas primárias aprovadas fora de Lendas do
Copy, com URLs versionadas em Cloudflare Images. O lote é
`covers/primarias/5a6712f044e3c159/`, com 148 variantes. Não copiar masters
PNG, manifesto de revisão, evidências internas ou outras fontes privadas.

Fonte autoritativa: `apps/web/` no repositório privado AgentFlix, PR
[AgentsFlix/agentsflix#235](https://github.com/AgentsFlix/agentsflix/pull/235).
A exportação pública será seletiva: `site/index.html`, `site/vitrine.js` e
`site/compartilhar/`. A aplicação só deve ocorrer após o merge privado e a
verificação dos arquivos no CDN.

Validação pendente nesta tarefa: diff contra a fonte privada integrada,
testes do site público, QA em 1440/768/390, PR público, deploy Vercel e
verificação de produção. Este registro não declara publicação concluída.
