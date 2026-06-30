-- G3D Pro - perfil da loja e imagens privadas por usuario
-- Execute no Supabase se Minha loja nao salvar ou a logo nao enviar.
-- As regras abaixo mantem cada usuario restrito aos proprios dados e arquivos.

alter table public.loja_perfis enable row level security;

-- Recomendado para evitar mais de um perfil por usuario.
-- Se houver erro por duplicidade, remova duplicados antigos antes de criar o indice.
create unique index if not exists loja_perfis_user_id_unique
on public.loja_perfis(user_id);

drop policy if exists "Usuario le seu perfil de loja" on public.loja_perfis;
drop policy if exists "Usuario cria seu perfil de loja" on public.loja_perfis;
drop policy if exists "Usuario atualiza seu perfil de loja" on public.loja_perfis;

create policy "Usuario le seu perfil de loja"
on public.loja_perfis
for select
to authenticated
using (user_id = auth.uid());

create policy "Usuario cria seu perfil de loja"
on public.loja_perfis
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Usuario atualiza seu perfil de loja"
on public.loja_perfis
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('g3d-images', 'g3d-images', false)
on conflict (id) do update set public = false;

drop policy if exists "Usuario le suas imagens G3D" on storage.objects;
drop policy if exists "Usuario envia suas imagens G3D" on storage.objects;
drop policy if exists "Usuario atualiza suas imagens G3D" on storage.objects;
drop policy if exists "Usuario remove suas imagens G3D" on storage.objects;

create policy "Usuario le suas imagens G3D"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'g3d-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Usuario envia suas imagens G3D"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'g3d-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Usuario atualiza suas imagens G3D"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'g3d-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'g3d-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Usuario remove suas imagens G3D"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'g3d-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);
