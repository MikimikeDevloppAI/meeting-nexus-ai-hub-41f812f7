-- Créer la table des pages disponibles
CREATE TABLE public.pages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Créer la table des administrateurs autorisés à gérer les accès
CREATE TABLE public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Créer la table des permissions utilisateur
CREATE TABLE public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  page_id TEXT NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  granted BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, page_id)
);

-- Activer RLS sur toutes les tables
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour pages (lecture pour tous)
CREATE POLICY "Anyone can view pages" ON public.pages FOR SELECT USING (true);

-- Politiques RLS pour admin_users (lecture pour tous les utilisateurs authentifiés)
CREATE POLICY "Authenticated users can view admin users" ON public.admin_users FOR SELECT TO authenticated USING (true);

-- Politiques RLS pour user_permissions
CREATE POLICY "Users can view their own permissions" ON public.user_permissions 
  FOR SELECT TO authenticated 
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all permissions" ON public.user_permissions 
  FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au 
      JOIN auth.users u ON u.email = au.user_email 
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all permissions" ON public.user_permissions 
  FOR ALL TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au 
      JOIN auth.users u ON u.email = au.user_email 
      WHERE u.id = auth.uid()
    )
  );

-- Insérer les pages disponibles
INSERT INTO public.pages (id, name, path, description) VALUES
  ('todos', 'Todos', '/todos', 'Gestion des tâches'),
  ('meetings', 'Meetings', '/meetings', 'Gestion des réunions'),
  ('new-meeting', 'New Meeting', '/new-meeting', 'Créer une nouvelle réunion'),
  ('documents', 'Documents', '/documents', 'Gestion des documents'),
  ('invoices', 'Invoices', '/invoices', 'Gestion des factures'),
  ('patient-letters', 'Patient Letters', '/patient-letters', 'Lettres patients'),
  ('iol-calculator', 'IOL Calculator', '/iol-calculator', 'Calculateur IOL'),
  ('users', 'User Management', '/users', 'Gestion des utilisateurs'),
  ('profile', 'Profile', '/profile', 'Profil utilisateur'),
  ('access-manager', 'Access Manager', '/access-manager', 'Gestion des accès');

-- Insérer les administrateurs autorisés
INSERT INTO public.admin_users (user_email) VALUES
  ('david.tabibian@gmail.com'),
  ('michael.enry4@gmail.com');

-- Donner toutes les permissions aux utilisateurs actuellement approuvés
INSERT INTO public.user_permissions (user_id, page_id, granted)
SELECT u.id, p.id, true
FROM public.users u
CROSS JOIN public.pages p
WHERE u.approved = true
ON CONFLICT (user_id, page_id) DO NOTHING;

-- Fonction pour créer les permissions par défaut pour les nouveaux utilisateurs approuvés
CREATE OR REPLACE FUNCTION create_default_permissions()
RETURNS TRIGGER AS $$
BEGIN
  -- Si l'utilisateur vient d'être approuvé
  IF OLD.approved = false AND NEW.approved = true THEN
    -- Donner les permissions de base (tous sauf access-manager et users)
    INSERT INTO public.user_permissions (user_id, page_id, granted)
    SELECT NEW.id, p.id, true
    FROM public.pages p
    WHERE p.id NOT IN ('access-manager', 'users')
    ON CONFLICT (user_id, page_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour créer automatiquement les permissions par défaut
CREATE TRIGGER trigger_create_default_permissions
  AFTER UPDATE OF approved ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_permissions();