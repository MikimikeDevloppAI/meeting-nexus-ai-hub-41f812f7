-- Create produit_injection table
CREATE TABLE IF NOT EXISTS public.produit_injection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produit TEXT NOT NULL,
  molecule TEXT,
  fabricant TEXT,
  concentration TEXT,
  presentation TEXT,
  prix_patient NUMERIC,
  prix_achat NUMERIC,
  representant TEXT,
  telephone TEXT,
  email TEXT,
  seuil_alerte INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS and allow all access
ALTER TABLE public.produit_injection ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'produit_injection' AND policyname = 'allow_all_produit_injection'
  ) THEN
    CREATE POLICY "allow_all_produit_injection"
    ON public.produit_injection
    FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- Trigger for updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_produit_injection_updated_at'
  ) THEN
    CREATE TRIGGER update_produit_injection_updated_at
    BEFORE UPDATE ON public.produit_injection
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Create commande_injection table
CREATE TABLE IF NOT EXISTS public.commande_injection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id UUID NOT NULL REFERENCES public.produit_injection(id) ON DELETE RESTRICT,
  numero_commande TEXT,
  quantite_commande INTEGER NOT NULL,
  date_commande DATE NOT NULL,
  quantite_recue INTEGER DEFAULT 0,
  date_reception DATE,
  montant NUMERIC,
  date_paiement DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commande_injection_produit_id ON public.commande_injection(produit_id);

ALTER TABLE public.commande_injection ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'commande_injection' AND policyname = 'allow_all_commande_injection'
  ) THEN
    CREATE POLICY "allow_all_commande_injection"
    ON public.commande_injection
    FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_commande_injection_updated_at'
  ) THEN
    CREATE TRIGGER update_commande_injection_updated_at
    BEFORE UPDATE ON public.commande_injection
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Create injection table
CREATE TABLE IF NOT EXISTS public.injection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id UUID NOT NULL REFERENCES public.produit_injection(id) ON DELETE RESTRICT,
  date_injection DATE NOT NULL DEFAULT current_date,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_injection_produit_id ON public.injection(produit_id);

ALTER TABLE public.injection ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'injection' AND policyname = 'allow_all_injection'
  ) THEN
    CREATE POLICY "allow_all_injection"
    ON public.injection
    FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_injection_updated_at'
  ) THEN
    CREATE TRIGGER update_injection_updated_at
    BEFORE UPDATE ON public.injection
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Register new page in pages table
INSERT INTO public.pages (id, name, path, description)
VALUES ('stock-management', 'Gestion du stock', '/gestion-stock', 'Suivi du stock des produits d''injection, commandes et injections')
ON CONFLICT (id) DO NOTHING;

-- Grant permission for all existing users
INSERT INTO public.user_permissions (user_id, page_id, granted)
SELECT u.id, 'stock-management', true
FROM public.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_permissions up WHERE up.user_id = u.id AND up.page_id = 'stock-management'
);
