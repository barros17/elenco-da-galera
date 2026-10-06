# UEFA C6 LEAGUE — identidade e ajuste de fotos

## O que será alterado

- Trocar o nome visível e os textos de compartilhamento do app para **UEFA C6 LEAGUE**.
- Criar duas propostas de logo originais, sem escudos ou elementos oficiais da UEFA/FIFA/EA, selecionar a mais adequada ao visual atual e aplicá-la no cabeçalho.
- Criar um ícone personalizado derivado da logo para a aba do navegador.
- Adicionar um editor de foto no cadastro para arrastar o jogador dentro do enquadramento e ajustar o zoom antes de salvar.
- Melhorar o tratamento de PNG, preservando a transparência e usando enquadramento central para destacar melhor o rosto.
- Manter a foto já ajustada salva junto ao jogador, sem alterar o funcionamento da lista ou do sorteio.

## Experiência do usuário

1. Ao escolher uma foto, abre o ajuste de enquadramento.
2. A pessoa arrasta a foto com mouse ou toque e regula o zoom.
3. A prévia mostra exatamente como a foto aparecerá na carta.
4. Ao confirmar, o recorte otimizado é usado no cadastro e nas cartas dos times.

## Detalhes técnicos

- O ajuste será feito no navegador com canvas, exportando uma imagem leve e quadrada.
- PNG continuará como PNG para não perder transparência; os demais formatos serão comprimidos em JPEG.
- O editor terá limites para impedir que a foto deixe áreas vazias no enquadramento.
- Títulos e metadados da página também serão atualizados para a nova marca.
- A visualização será conferida em desktop e celular, incluindo arraste, zoom, cadastro e exibição da carta.
