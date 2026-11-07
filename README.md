# Elenco da Galera

Aplicativo para gerir seções, jogadores e sorteios equilibrados com autenticação do Supabase.

- UI 100% em português do Brasil, mobile-first, no visual preto/amarelo/cinza/branco
- Cadastro de jogadores por seção com cartas por faixa de overall
- Seções com código de convite, admin e membros
- Jogos com modalidade futsal, fut7 ou futebol de campo e confirmação de presença por jogador
- Administração da lista de presença e sorteio apenas entre jogadores confirmados
- Dois times equilibrados em campos com escalações editáveis e reservas
- Supabase como autenticação, banco e RLS
- Fotos processadas no navegador e armazenadas em `photo_url`

## Stack

- TanStack Start + React 19 + Vite
- Tailwind 4 + shadcn/ui
- Supabase (Auth, Postgres, RLS)
- Bun lockfile presente no repo, mas o projeto também aceita npm

## Requisitos

- Node.js 20+
- Bun 1.2+ (preferencial) ou npm
- Projeto Supabase com as migrations em `supabase/migrations`

## Variáveis de ambiente

Copie o arquivo de exemplo e ajuste os valores locais:

```bash
cp .env.example .env
```

Exemplo de chaves esperadas:

```env
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_URL=https://...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

## URLs de autenticação

O Google OAuth retorna ao endereço atual do app (`window.location.origin`). No
Supabase, mantenha `https://elenco-da-galera.vercel.app` como **Site URL** e
permita `http://localhost:5173/**` em **Redirect URLs** para o desenvolvimento
local. Os endereços autorizados também estão listados em
`supabase/config.toml`; aplicar alterações no projeto hospedado exige atualizar
as configurações de Auth no Dashboard do Supabase.

## Rodar localmente

Com Bun:

```bash
bun install
bun run dev
```

Com npm:

```bash
npm install
npm run dev
```

## Scripts

```bash
bun run lint
bun run typecheck
bun run test
```

## Banco e segurança

- As migrations ficam em `supabase/migrations`
- O app usa autenticação do Supabase e regras de RLS no banco
- O cálculo de `overall` deve ser validado no servidor e não depender da UI
- O código de sorteio fica em `src/lib/team-balancer.ts`
- As regras de overall/posições/skills ficam em `src/lib/players.ts`
