# Hover de Ler sem piscada

Problema reproduzido no navegador de produção: inserir a imagem da prévia acionava
o carregamento da página inteira (`ready → loading → ready`), interrompendo o hover.

Os dois módulos exportados separam a preparação da prévia do gate da rota. A prévia
permanece invisível e inerte até decodificar suas imagens; troca de card e saída da
rota cancelam a preparação anterior. Falha fecha somente a prévia, sem retirar o
catálogo. A preparação global continua ativa para as telas e demais imagens.

Sem alteração de HTML gerado, capas, texto, tokens, login ou paradas do player.
O teste portátil cobre decode pendente, substituição, falha, cancelamento e isolamento
do observer de rota. José autorizou publicar e dispensou nova matriz de dispositivos
e login real. Validar também o hover de forma focada e confirmar os arquivos no
domínio após o deploy; checks não equivalem a certificação integral da interface.
