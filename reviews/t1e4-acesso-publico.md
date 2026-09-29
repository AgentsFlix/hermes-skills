# T1E4 com acesso público

A liberação explícita cobre somente a aula Hermes em Operação T1E4 e seu alias.
A página aceita visitantes sem login; a API mantém token assinado de três horas e
confere a mídia ativa e os metadados da série. Os demais vídeos continuam protegidos.

Exportação seletiva gerada na fonte autoritativa e revisada em quatro arquivos.
Testes funcionais na origem cobriram autorização anônima, episódios privados, falha
do manifesto, mídia ausente/inativa, metadados incompatíveis e assinatura RSA.

CI, integração e reprodução anônima em produção: pendentes na abertura.

A validade de três horas cobre os 134 minutos do vídeo; as mídias protegidas
continuam com tokens de uma hora.
