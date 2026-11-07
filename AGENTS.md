## Project rules

- O algoritmo de sorteio de times (snake draft + hill climbing + função de custo) vive só em `src/lib/team-balancer.ts`, para facilitar ajustes sem tocar na UI.
- Regras de overall, posições e skills ficam em `src/lib/players.ts`; a UI nunca recalcula overall por conta própria.
- O app usa autenticação do Supabase e seções; não há isolamento por `session_id` no frontend.
- A seção e os membros são geridos no banco via Supabase; a autenticação e permissões ficam no servidor/DB.
- Fotos de jogador são redimensionadas no navegador e salvas em `photo_url`; a app não depende de bucket público para o fluxo atual.
- O enquadramento das fotos é feito no navegador em `PhotoCropper.tsx`, com saída quadrada de 512px e preservação de transparência em PNG.
- Novas migrations ficam em `supabase/migrations` com timestamp posterior ao último arquivo; RLS e validações sensíveis devem ser feitas no banco, nunca somente na UI.
- `drizzle/` e `drizzle.config.ts` existem apenas como artefato legado; qualquer remoção precisa ser conferida antes de apagar.
