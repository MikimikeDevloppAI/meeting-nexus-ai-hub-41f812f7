-- Add is_recovery flag to overtime_hours and normalize data
ALTER TABLE public.overtime_hours
ADD COLUMN IF NOT EXISTS is_recovery boolean NOT NULL DEFAULT false;

-- Backfill: any negative hours become positive and flagged as recovery
UPDATE public.overtime_hours
SET is_recovery = true,
    hours = ABS(hours)
WHERE hours < 0;
