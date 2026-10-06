<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules

- O algoritmo de sorteio de times (snake draft + hill climbing + função de custo) vive só em `src/lib/team-balancer.ts`, para facilitar ajustes sem tocar na UI.
- Regras de overall, posições e skills ficam em `src/lib/players.ts`; a UI nunca recalcula overall por conta própria.
- Jogadores são isolados por um `session_id` guardado no navegador (`src/lib/session.ts`), porque o app não tem login.
- Fotos de jogador são redimensionadas no navegador e salvas como data URL na coluna `photo_url` (buckets públicos de storage estão bloqueados neste projeto).
- O enquadramento das fotos é feito no navegador em `PhotoCropper.tsx`, com saída quadrada de 512px e preservação de transparência em PNG.
