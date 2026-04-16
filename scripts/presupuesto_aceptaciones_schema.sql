-- ============================================================================
--  PAU INTERIORISMO — Esquema tabla presupuesto_aceptaciones
-- ============================================================================
--
--  Esta tabla guarda los tokens generados al enviar un presupuesto por email
--  y el registro de aceptación digital del cliente (con auditoría legal).
--
--  EJECUTAR UNA SOLA VEZ en el editor SQL de Supabase
--  (Dashboard → SQL editor → New query → pegar todo → Run).
--
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.presupuesto_aceptaciones (
  id                   bigserial PRIMARY KEY,

  -- Identificación del presupuesto enviado
  proyecto_id          text NOT NULL,
  presupuesto_ref      text NOT NULL,        -- ej: "PRES-2026-001-v2"
  cliente_email        text NOT NULL,
  email_id             bigint,               -- FK opcional a document_emails.id

  -- Token y vigencia
  token                text NOT NULL UNIQUE, -- 32+ chars hex aleatorios
  created_at           timestamptz NOT NULL DEFAULT now(),
  expires_at           timestamptz NOT NULL,

  -- Snapshot del presupuesto (HTML congelado en el momento del envío)
  -- Para que aunque el presupuesto se modifique después, el cliente vea
  -- exactamente lo que se le envió.
  snapshot_html        text,
  snapshot_total       numeric(12,2),        -- importe total snapshot

  -- Datos de aceptación (NULL hasta que el cliente firme)
  accepted_at          timestamptz,
  accepted_by_name     text,
  accepted_by_dni      text,
  accepted_ip          text,
  accepted_user_agent  text,

  -- Estado calculado: si tiene accepted_at => 'aceptado',
  -- si expires_at < now() => 'caducado', si no => 'pendiente'
  -- (Lo calculamos en cliente, no en BD, para evitar triggers)

  CONSTRAINT chk_acceptance_consistency
    CHECK (
      (accepted_at IS NULL AND accepted_by_name IS NULL AND accepted_by_dni IS NULL)
      OR
      (accepted_at IS NOT NULL AND accepted_by_name IS NOT NULL AND accepted_by_dni IS NOT NULL)
    )
);

-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_presup_acept_token       ON public.presupuesto_aceptaciones(token);
CREATE INDEX IF NOT EXISTS idx_presup_acept_proyecto    ON public.presupuesto_aceptaciones(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_presup_acept_ref         ON public.presupuesto_aceptaciones(presupuesto_ref);
CREATE INDEX IF NOT EXISTS idx_presup_acept_accepted_at ON public.presupuesto_aceptaciones(accepted_at);

-- ============================================================================
--  POLÍTICAS RLS
-- ============================================================================
--
--  La tabla NO se expone vía RLS al cliente: TODAS las operaciones
--  (insertar token, consultar token, marcar aceptado) se hacen desde el
--  Apps Script con la API key (anon key) de Supabase.
--
--  Para reforzar la seguridad, dejamos RLS habilitado y SIN políticas:
--  cualquier intento desde el cliente sin pasar por Apps Script fallará.
--
-- ============================================================================

ALTER TABLE public.presupuesto_aceptaciones ENABLE ROW LEVEL SECURITY;

-- Política para la app autenticada (admin Pau Interiorismo): lectura total
-- (Pegar el JWT correspondiente del rol admin si se quisiera; por ahora
--  como la app usa la anon key igual que aceptar.html, dejamos sin política
--  y todo va vía Apps Script.)

-- ============================================================================
--  COLUMNAS OPCIONALES EN document_emails
-- ============================================================================
--
--  Para enlazar fácilmente cada envío con su token de aceptación,
--  añadimos una columna a document_emails (no rompe nada existente).
--
-- ============================================================================

ALTER TABLE public.document_emails
  ADD COLUMN IF NOT EXISTS aceptacion_token text;

CREATE INDEX IF NOT EXISTS idx_doc_emails_acept_token
  ON public.document_emails(aceptacion_token);

-- ============================================================================
--  FIN
-- ============================================================================
