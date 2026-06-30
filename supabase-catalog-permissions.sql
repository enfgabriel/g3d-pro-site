-- G3D Pro - catalogo de produtos por usuario
-- Execute no Supabase se o Catalogo der erro de permissao ao salvar.
-- Este script nao apaga dados; ele garante colunas, grants e politicas por usuario.

create table if not exists public.catalogo_produtos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  sku text,
  tipo text default 'produto',
  ativo boolean default true,
  categoria text,
  estoque_id uuid,
  material text,
  cor text,
  peso_g numeric default 0,
  quantidade_pecas numeric default 1,
  tempo_horas numeric default 0,
  pos_horas numeric default 0,
  preco_base numeric default 0,
  margem_percentual numeric,
  descricao text,
  observacao text,
  imagem_path text,
  imagem_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

alter table public.catalogo_produtos
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists nome text,
  add column if not exists sku text,
  add column if not exists tipo text default 'produto',
  add column if not exists ativo boolean default true,
  add column if not exists categoria text,
  add column if not exists estoque_id uuid,
  add column if not exists material text,
  add column if not exists cor text,
  add column if not exists peso_g numeric default 0,
  add column if not exists quantidade_pecas numeric default 1,
  add column if not exists tempo_horas numeric default 0,
  add column if not exists pos_horas numeric default 0,
  add column if not exists preco_base numeric default 0,
  add column if not exists margem_percentual numeric,
  add column if not exists descricao text,
  add column if not exists observacao text,
  add column if not exists imagem_path text,
  add column if not exists imagem_url text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists deleted_at timestamptz;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.catalogo_produtos to authenticated;

alter table public.catalogo_produtos enable row level security;

drop policy if exists "Usuario le seu catalogo" on public.catalogo_produtos;
drop policy if exists "Usuario cria item no seu catalogo" on public.catalogo_produtos;
drop policy if exists "Usuario atualiza seu catalogo" on public.catalogo_produtos;
drop policy if exists "Usuario remove seu catalogo" on public.catalogo_produtos;

create policy "Usuario le seu catalogo"
on public.catalogo_produtos
for select
to authenticated
using (user_id = auth.uid());

create policy "Usuario cria item no seu catalogo"
on public.catalogo_produtos
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Usuario atualiza seu catalogo"
on public.catalogo_produtos
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Usuario remove seu catalogo"
on public.catalogo_produtos
for delete
to authenticated
using (user_id = auth.uid());

create index if not exists catalogo_produtos_user_id_idx on public.catalogo_produtos(user_id);
create index if not exists catalogo_produtos_deleted_at_idx on public.catalogo_produtos(deleted_at);
