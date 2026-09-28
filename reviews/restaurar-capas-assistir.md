# Restaurar capas aprovadas de Assistir

## Objetivo e causa

Restaurar as três capas editoriais ilustradas aprovadas, preservando os arquivos
originais e seus textos integrados. O catálogo público ainda apontava para as capas
legadas; os três WebPs editoriais retornavam 404 e o CSS não continha o enquadramento
editorial completo. Os controllers já suportavam `editorial-wide`.

## Escopo

Exportação literal autorizada de cinco arquivos de runtime: `series.json`,
`series-covers.css` e três WebPs em `assistir/img/editorial/`. A comparação semântica
contra a versão pública confirmou que somente os campos de capas diferiam;
episódios, temporadas, comandos, sinopses, visibilidade e curadoria são preservados.
Nenhuma imagem foi gerada, recolorida, recortada ou vetorizada. O enquadramento usa
o CSS aprovado, compartilhado entre catálogo e ficha, sem regra por slug.

Os hashes de entrega aprovados estão no teste `test_approved_series_covers.py`.
O teste também impede o retorno das versões verticais legadas e exige suporte de
catálogo, player e CSS à cena inteira. A aprovação anterior das artes foi conferida
antes da exportação. Não foram exportados masters nem documentos internos.

## Validação e limites

Verificação automática dos arquivos, hashes, contrato de séries e site; checks do
PR antes do merge. José solicitou publicação imediata e dispensou novos testes de
desktop, celular e login real. Não se alega nova certificação visual ou de acesso.
A confirmação de produção deve comparar catálogo, CSS e bytes das imagens com o
commit integrado; merge não será tratado sozinho como confirmação de deploy.
