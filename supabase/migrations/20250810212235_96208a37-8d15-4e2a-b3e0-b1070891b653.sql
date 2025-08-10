-- Create retrocessions table
CREATE TABLE IF NOT EXISTS public.retrocessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor TEXT NOT NULL,
  chiffre_affaires NUMERIC NOT NULL DEFAULT 0,
  retrocession NUMERIC NOT NULL DEFAULT 0,
  period_month DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helpful index for filtering by period and doctor
CREATE INDEX IF NOT EXISTS idx_retrocessions_period_month ON public.retrocessions (period_month);
CREATE INDEX IF NOT EXISTS idx_retrocessions_doctor ON public.retrocessions (doctor);

-- Ensure one entry per doctor per month
ALTER TABLE public.retrocessions
  ADD CONSTRAINT retrocessions_doctor_month_unique UNIQUE (doctor, period_month);

-- Enable RLS and permissive policies (aligns with current project pattern)
ALTER TABLE public.retrocessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_all_retrocessions ON public.retrocessions;
CREATE POLICY "allow_all_retrocessions"
ON public.retrocessions
FOR ALL
USING (true)
WITH CHECK (true);

-- Register page in pages table for permissions/navigation
INSERT INTO public.pages (id, name, path, description)
VALUES ('retrocession', 'Rétrocession', '/retrocession', 'Suivi des rétrocessions par docteur')
ON CONFLICT (id) DO NOTHING;

-- Grant access to all existing users by default
INSERT INTO public.user_permissions (user_id, page_id, granted)
SELECT u.id, 'retrocession', true
FROM public.users u
ON CONFLICT DO NOTHING;