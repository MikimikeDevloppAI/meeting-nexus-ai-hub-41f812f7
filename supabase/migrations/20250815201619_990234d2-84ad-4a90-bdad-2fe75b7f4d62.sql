-- Drop existing policies
DROP POLICY IF EXISTS "Everyone can read help content" ON public.page_help_information;
DROP POLICY IF EXISTS "Only specific users can manage help content" ON public.page_help_information;

-- Create new public policy for all operations
CREATE POLICY "Public access to help information" 
ON public.page_help_information 
FOR ALL 
USING (true) 
WITH CHECK (true);