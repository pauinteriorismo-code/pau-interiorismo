-- ============================================================================
--  PAU INTERIORISMO — Añadir columna sender_email a presupuesto_aceptaciones
-- ============================================================================
--
--  Permite guardar el alias de correo desde el que se envió el presupuesto,
--  para que la notificación interna de aceptación llegue al mismo buzón
--  (en lugar de ir siempre a administracion@pauinteriorismo.es).
--
--  EJECUTAR UNA SOLA VEZ en el editor SQL de Supabase
--  (Dashboard → SQL editor → New query → pegar todo → Run).
--
-- ============================================================================

ALTER TABLE public.presupuesto_aceptaciones
  ADD COLUMN IF NOT EXISTS sender_email text;

-- Índice por si alguna vez se quieren listar aceptaciones por alias remitente
CREATE INDEX IF NOT EXISTS idx_presup_acept_sender_email
  ON public.presupuesto_aceptaciones(sender_email);

-- ============================================================================
--  FIN
-- ============================================================================
