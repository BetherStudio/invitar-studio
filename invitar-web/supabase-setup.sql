-- Ejecutar en Supabase > SQL Editor

-- Bucket para guardar invitaciones exportadas
insert into storage.buckets (id, name, public)
values ('invitations', 'invitations', false)
on conflict do nothing;

-- Política: cada usuario solo puede ver sus propios archivos
create policy "Users access own files"
on storage.objects for all
using (bucket_id = 'invitations' and auth.uid()::text = (storage.foldername(name))[1]);
