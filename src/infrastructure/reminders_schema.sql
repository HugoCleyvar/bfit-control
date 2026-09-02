-- Recordatorios de vencimiento: track whether a WhatsApp reminder has already been sent for a
-- subscription's current cycle, so ExpiringMembersList (Panel de Control) doesn't resurface the
-- same member every day. Reset to FALSE whenever fecha_vencimiento moves forward (renewal),
-- so the next cycle can alert again.
ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS recordatorio_enviado BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS recordatorio_enviado_at TIMESTAMPTZ;
