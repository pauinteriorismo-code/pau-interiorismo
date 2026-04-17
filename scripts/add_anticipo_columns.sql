-- ============================================================================
--  PAU INTERIORISMO — Anticipo a la aceptación de presupuesto
--  Añade columnas a presupuesto_aceptaciones para registrar:
--    · Configuración del anticipo solicitado al enviar el presupuesto.
--    · Datos del cobro cuando se marca como recibido.
--    · Vínculo con la factura emitida automáticamente.
--
--  EJECUTAR UNA SOLA VEZ en el editor SQL de Supabase
--  (Dashboard → SQL editor → New query → pegar todo → Run).
-- ============================================================================

ALTER TABLE public.presupuesto_aceptaciones
  -- Configuración del anticipo solicitado (al ENVIAR el presupuesto)
  ADD COLUMN IF NOT EXISTS anticipo_porcentaje numeric(5,2),    -- 0..100; null = no se pide anticipo
  ADD COLUMN IF NOT EXISTS anticipo_importe    numeric(12,2),    -- importe calculado (info al cliente)
  ADD COLUMN IF NOT EXISTS anticipo_iban       text,             -- IBAN al que el cliente debe pagar
  ADD COLUMN IF NOT EXISTS anticipo_concepto   text,             -- concepto bancario sugerido
  ADD COLUMN IF NOT EXISTS factura_serie       smallint,         -- 1 = construcción, 2 = interiorismo

  -- Datos del cobro cuando se marca como recibido (manual o detección automática)
  ADD COLUMN IF NOT EXISTS paid_at             timestamptz,
  ADD COLUMN IF NOT EXISTS paid_amount         numeric(12,2),
  ADD COLUMN IF NOT EXISTS paid_reference      text,             -- ej. "Transferencia 16/04 18:32" o id mov. bancario
  ADD COLUMN IF NOT EXISTS paid_method         text,             -- 'manual' | 'auto_extracto'

  -- Vínculo con la factura generada automáticamente al marcar el cobro
  ADD COLUMN IF NOT EXISTS factura_id          bigint,
  ADD COLUMN IF NOT EXISTS factura_num         text;

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_presup_acept_paid_at
  ON public.presupuesto_aceptaciones(paid_at);

CREATE INDEX IF NOT EXISTS idx_presup_acept_factura_id
  ON public.presupuesto_aceptaciones(factura_id);

-- ============================================================================
--  FIN
-- ============================================================================
