-- Restrict retrocessions access to only specific users
-- 1) Create a SECURITY DEFINER helper to check if current user is allowed
CREATE OR REPLACE FUNCTION public.is_retrocession_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.name IN ('Michael Enry', 'David Tabibian')
  );
$$;

-- 2) Ensure RLS is enabled
ALTER TABLE public.retrocessions ENABLE ROW LEVEL SECURITY;

-- 3) Remove permissive "allow all" policy if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'retrocessions'
      AND policyname = 'allow_all_retrocessions'
  ) THEN
    DROP POLICY "allow_all_retrocessions" ON public.retrocessions;
  END IF;
END $$;

-- 4) Create strict policies for authenticated users
CREATE POLICY "retrocession_admins_select"
ON public.retrocessions
FOR SELECT
TO authenticated
USING (public.is_retrocession_admin());

CREATE POLICY "retrocession_admins_insert"
ON public.retrocessions
FOR INSERT
TO authenticated
WITH CHECK (public.is_retrocession_admin());

CREATE POLICY "retrocession_admins_update"
ON public.retrocessions
FOR UPDATE
TO authenticated
USING (public.is_retrocession_admin());

CREATE POLICY "retrocession_admins_delete"
ON public.retrocessions
FOR DELETE
TO authenticated
USING (public.is_retrocession_admin());