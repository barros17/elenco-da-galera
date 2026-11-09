# Elenco da Galera

Aplicativo para gerir seções, jogadores e sorteios equilibrados com autenticação do Supabase.

- UI 100% em português do Brasil, mobile-first, no visual preto/amarelo/cinza/branco
- Cadastro de jogadores por seção com cartas por faixa de overall
- Seções com código de convite, admin e membros
- Jogos com modalidades fixas e estilos personalizados por seção, com confirmação de presença
- Administração da lista de presença e sorteio apenas entre jogadores confirmados
- Dois times equilibrados em campos com escalações editáveis e reservas
- Supabase como autenticação, banco e RLS
- Fotos redimensionadas no navegador e armazenadas em bucket privado; `photo_url` guarda o caminho do objeto

## Stack

- TanStack Start + React 19 + Vite
- Tailwind 4 + shadcn/ui
- Supabase (Auth, Postgres, RLS)
- Bun 1.2.18 é o gerenciador oficial; o repositório usa somente `bun.lock`

## Requisitos

- Node.js 22.12+
- Bun 1.2.18 (preferencial) ou npm
- Projeto Supabase com as migrations em `supabase/migrations`

## Testes SQL na CI

O job `sql-tests` aplica todas as migrations em um container `supabase/postgres`
e executa os arquivos de `supabase/tests`. O arquivo
`supabase/tests/_stub_supabase.sql` é aplicado antes das migrations para
normalizar o contrato mínimo do schema `storage` entre versões da imagem; ele
é somente um stub de teste e não deve ser aplicado no projeto Supabase de
produção.

## Variáveis de ambiente

Copie o arquivo de exemplo e ajuste os valores locais:

```bash
cp .env.example .env
```

Exemplo de chaves esperadas:

```env
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_GOOGLE_MAPS_EMBED_KEY=
SUPABASE_URL=https://...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

`SUPABASE_SERVICE_ROLE_KEY` é opcional para o app e necessária para o script de
migração de fotos. É uma chave somente de servidor: nunca use o prefixo `VITE_`
nela nem a inclua no código do navegador.

### Google Maps

Para habilitar o mapa oficial incorporado:

1. No [Google Cloud Console](https://console.cloud.google.com/), crie ou selecione um projeto.
2. Ative a **Maps Embed API** em APIs e serviços.
3. Crie uma chave de API e restrinja-a por **referrers HTTP** ao domínio do app e a `localhost` durante o desenvolvimento.
4. Em restrições de API, permita somente a **Maps Embed API**.
5. Preencha `VITE_GOOGLE_MAPS_EMBED_KEY` no ambiente de build.

A chave de Embed no cliente é esperada por design; a restrição por referrer e por
API é o que limita seu uso. Sem a chave, o app usa o formato de fallback
`maps?q=...&output=embed`, que não é documentado oficialmente pelo Google e pode
mudar. Se um dia for configurada CSP, permita `frame-src https://www.google.com`.

## URLs de autenticação

O Google OAuth retorna ao endereço atual do app (`window.location.origin`). No
Supabase, use o domínio real da aplicação como **Site URL** e permita
`http://localhost:5173/**` em **Redirect URLs** para o desenvolvimento local.
Os placeholders estão listados em
`supabase/config.toml`; aplicar o domínio hospedado exige atualizar
as configurações de Auth no Dashboard do Supabase.

## Rodar localmente

Com Bun:

```bash
bun install --frozen-lockfile
bun run dev
```

## Migrar fotos legadas

Após aplicar as migrations do Supabase, defina `SUPABASE_URL` e
`SUPABASE_SERVICE_ROLE_KEY`. O script migra fotos em data URL da tabela
`section_players`; primeiro execute a simulação e depois a migração:

```bash
bun run scripts/migrate-photos-to-storage.ts --dry-run
bun run scripts/migrate-photos-to-storage.ts
```

## Scripts

```bash
bun run lint
bun run typecheck
bun run test
bun run build
```

## Banco e segurança

- As migrations ficam em `supabase/migrations`
- O app usa autenticação do Supabase e regras de RLS no banco
- O cálculo de `overall` deve ser validado no servidor e não depender da UI
- O código de sorteio fica em `src/lib/team-balancer.ts`
- As regras de overall/posições/skills ficam em `src/lib/players.ts`

## Cache de produção (infra)

O app ainda não instala service worker. Na próxima etapa de infraestrutura, sirva `assets/*` com cache longo (os nomes têm hash) e `_shell.html` com `Cache-Control: no-cache`, para evitar que o shell HTML aponte para bundles antigos.
