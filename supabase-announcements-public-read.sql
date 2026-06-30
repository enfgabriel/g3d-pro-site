-- G3D Pro - leitura de comunicados para usuarios autenticados
-- Execute este SQL no Supabase se usuarios comuns nao estiverem vendo os comunicados.
-- Ele libera apenas comunicados ativos, dentro do periodo e destinados a todos.
-- Comunicados pausados, expirados, futuros ou somente ADM continuam protegidos.

alter table public.app_announcements enable row level security;

drop policy if exists "Usuarios autenticados leem comunicados ativos" on public.app_announcements;

create policy "Usuarios autenticados leem comunicados ativos"
on public.app_announcements
for select
to authenticated
using (
  ativo is true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now())
  and coalesce(audience, 'todos') in ('todos', 'all', 'usuarios', 'users')
);
