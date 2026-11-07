-- Compatibilidade do ambiente de testes da CI.
--
-- A imagem supabase/postgres fornece os schemas auth e storage, mas a versão
-- da tabela storage.buckets pode não ter todas as colunas usadas pela
-- migration de fotos. Este arquivo apenas normaliza o contrato mínimo para os
-- testes; não é uma migration de produção.

create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null
);

alter table storage.buckets
  add column if not exists public boolean not null default false;

alter table storage.buckets
  add column if not exists file_size_limit bigint;

alter table storage.buckets
  add column if not exists allowed_mime_types text[];

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text,
  name text,
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  metadata jsonb
);

alter table storage.objects
  add column if not exists bucket_id text;

alter table storage.objects
  add column if not exists name text;

alter table storage.objects enable row level security;
