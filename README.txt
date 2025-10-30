INSTRUÇÕES - App offline para gerar PDF de fotografias
====================================================

Conteúdo da pasta:
 - index.html
 - styles.css
 - app.js
 - README.txt (este arquivo)
 - (opcional) libs/  <-- você pode criar essa pasta e colocar as bibliotecas JS necessárias para uso totalmente offline

Bibliotecas recomendadas (coloque os arquivos dentro de ./libs para uso totalmente offline):
 - jspdf.umd.min.js  (ex.: https://cdnjs.cloudflare.com/ajax/libs/jspdf/3.0.3/jspdf.umd.min.js)

Como tornar o app totalmente offline:
 1. Faça o download do arquivo jspdf.umd.min.js (versão 3.x) e coloque em ./libs/jspdf.umd.min.js.
 2. Abra index.html em um servidor web local (ex.: 'python -m http.server' no diretório do projeto) e use o app sem internet.

Notas sobre compressão e PDF:
 - O app tenta comprimir cada imagem para ~1 MB usando canvas (redimensionamento + ajuste de qualidade).
 - O layout PDF coloca até 2 imagens por página com legenda e um cabeçalho com o número do relatório.
 - A data no rodapé é a data de geração do documento (conforme o dispositivo).
