# Checklist manual de mobile

O smoke test automatizado cobre a tela inicial/login em 320, 360, 390 e 412px. Para telas autenticadas, usar dados fictícios no ambiente de teste e verificar em retrato e paisagem (também 430px):

- hub da seção e lista de participantes;
- galeria e formulário de jogador, incluindo o diálogo de corte de foto;
- jogos: criar, editar e detalhe, incluindo os dois selects e datas;
- times, campo, edição dos nomes, trocas, reservas e download da imagem;
- estilos de jogo e AlertDialog.

Fluxos de regressão prioritários:

- abrir e fechar cada diálogo por X, Cancelar, ESC e arrastar; repetir Cancelar com e sem alterações;
- salvar jogador pelo botão do rodapé no celular, sem ações duplicadas;
- jogos: lista → detalhe → Voltar e botão voltar do navegador; nenhum jogo deve abrir sozinho;
- link de convite deslogado e logado, incluindo retorno do Google OAuth;
- sortear, editar nomes, trocar jogadores por toque/arraste, alterar confirmados e recarregar;
- renomear time sem trocar suas cores, exportar/compartilhar imagem e testar formação 5-3-2 em 320 px;
- repetir os cenários em iPhone Safari, Android Chrome e Firefox desktop.

Em cada tela conferir ausência de rolagem horizontal, campos com texto de 16px no iOS, diálogo com rolagem interna, área segura do notch/barra inferior e restauração após recarregar.
