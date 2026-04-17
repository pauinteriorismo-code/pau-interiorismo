-- Añade columna para guardar el contrato editado a mano por proyecto.
-- Si es NULL, la app usa la plantilla autorellenable; si tiene contenido,
-- se muestra y se edita el HTML guardado.
alter table public.proyectos
  add column if not exists contrato_html text;
