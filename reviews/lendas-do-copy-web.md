# Lendas do Copy · vitrine Web

Origem autoritativa: `AgentsFlix/agentsflix` PR #228, integrado no commit
`bcdd5800774d8be65da9b3e050fcf0ae3d91d0b1`. Esta entrega exporta
seletivamente cinco páginas HTML geradas/autorais, sem copiar masters,
inventário privado ou credenciais.

## Escopo

- Tag “Lendas do Copy” ao lado de “Tudo” e “Minha lista”, filtrando os 14
  itens aprovados do catálogo.
- Cards, hero e ficha dessas skills usam o lote de arte versionado
  `a55506c530bc18a6` no Cloudflare Images. As URLs anteriores permanecem;
  o Modo Ler de Hormozi mantém sua capa editorial independente.
- Quatro páginas compartilháveis atualizadas pelo gerador para manter a
  vitrine canônica, sem alterar seus metadados sociais.
- Texto integrado às artes com descrição equivalente nos nomes acessíveis.

## Verificação e limites

Na origem, 56/56 variantes publicadas e conferidas no CDN. QA local do
consumidor com catálogo sintético: 14 cards e imagens em 1440, 768 e 390 px,
sem overflow, alvo da tag ≥44 px, ficha e Modo Ler preservados. Capturas e
resultados ficam no PR privado de origem. Aqui: testes do repositório,
`scripts/check_site.py`, `scripts/build_reading_shares.py --check` e
`scripts/agent_work.py check`.

O QA local não prova o deploy ou o carregamento no domínio público. A cifra
na arte Khayat é texto aprovado de uma capa, não faturamento auditado. Não
há alteração de preço, autenticação, checkout, manifesto ou catálogo JSON.
