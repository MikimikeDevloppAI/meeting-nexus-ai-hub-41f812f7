-- Create table for page help information
CREATE TABLE public.page_help_information (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id TEXT NOT NULL UNIQUE,
  page_name TEXT NOT NULL,
  help_content TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.page_help_information ENABLE ROW LEVEL SECURITY;

-- Create policies - only David Tabibian and Michael Enry can manage help content
CREATE POLICY "Only specific users can manage help content" 
ON public.page_help_information 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() 
    AND u.name IN ('David Tabibian', 'Michael Enry')
  )
) 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() 
    AND u.name IN ('David Tabibian', 'Michael Enry')
  )
);

-- Everyone can read help content
CREATE POLICY "Everyone can read help content" 
ON public.page_help_information 
FOR SELECT 
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_page_help_information_updated_at
BEFORE UPDATE ON public.page_help_information
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();