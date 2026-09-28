# Capas leves no modo Ler

Exportação da fonte autoral. Quatro capas preservadas em resolução original;
derivados WebP 640/960 px, qualidade 82, sem crop/recoloração/novo texto.
Originais: 1.539.866 bytes; conjunto 640 px: 252.596 bytes; 960 px: 491.334 bytes.
Economia de bytes de 68,1–83,6%, não promessa equivalente de tempo de página.

O navegador escolhe por `srcset`/`sizes`, com original como fallback/ampliação.
Falha do manifesto opcional mantém os originais. Textos e compartilhamento social
intactos; shells de compartilhamento regenerados, não mantidos manualmente.
Recursos do banner de descoberta em subseção oculta não reabrem o carregamento
global. Ao revelar a seção, o gate volta a verificar suas imagens. A rotação
legada também não renova imagens na aba Ler.

Inspeção visual dos oito derivados e originais; verificação focada de seleção
no navegador e hover. Matriz de dispositivos e login real dispensados pelo usuário.
Testes: integridade das origens, orçamento, proporção, hashes e fallback de rede.
Verificação local: quatro cards selecionaram 640 px; 10,5 segundos atravessando o
ciclo do banner tiveram zero frames de loading e de imagem visível incompleta.
Hover em FLOW exibiu prévia pronta de 960 px, sem loading global ou imagem incompleta.
Produção só pode ser declarada após merge, deploy e conferência dos arquivos servidos.
