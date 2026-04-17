-- Permite que la app (rol anon) registre envíos de email en document_emails.
-- Sin esto, los POSTs devuelven 401 Unauthorized y el badge 📤 no aparece
-- en los pedidos/presupuestos enviados.

alter table public.document_emails enable row level security;

drop policy if exists "document_emails_select_all" on public.document_emails;
create policy "document_emails_select_all" on public.document_emails
  for select to anon, authenticated
  using (true);

drop policy if exists "document_emails_insert_all" on public.document_emails;
create policy "document_emails_insert_all" on public.document_emails
  for insert to anon, authenticated
  with check (true);

drop policy if exists "document_emails_update_all" on public.document_emails;
create policy "document_emails_update_all" on public.document_emails
  for update to anon, authenticated
  using (true)
  with check (true);
