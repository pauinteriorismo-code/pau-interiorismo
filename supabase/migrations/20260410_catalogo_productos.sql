-- Tabla genérica de catálogos de producto (multi-fabricante)
CREATE TABLE IF NOT EXISTS catalogo_productos (
  id bigint generated always as identity primary key,
  fabricante text not null,
  ref text not null,
  descripcion text,
  alto numeric(8,1),
  ancho numeric(8,1),
  fondo numeric(8,1),
  precio_base numeric(10,2),
  precio_color numeric(10,2),
  pagina_pdf integer,
  otras_pag text,
  created_at timestamptz default now(),
  UNIQUE(fabricante, ref)
);

CREATE INDEX IF NOT EXISTS idx_catalogo_fab ON catalogo_productos(fabricante);
CREATE INDEX IF NOT EXISTS idx_catalogo_ref ON catalogo_productos(ref);
CREATE INDEX IF NOT EXISTS idx_catalogo_desc ON catalogo_productos USING gin (to_tsvector('spanish', coalesce(descripcion,'')));

-- Permitir lectura anónima (igual que las demás tablas de la app)
ALTER TABLE catalogo_productos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalogo_read" ON catalogo_productos FOR SELECT USING (true);
CREATE POLICY "catalogo_insert" ON catalogo_productos FOR INSERT WITH CHECK (true);
CREATE POLICY "catalogo_update" ON catalogo_productos FOR UPDATE USING (true);
CREATE POLICY "catalogo_delete" ON catalogo_productos FOR DELETE USING (true);
