-- Add hover_text column to page_help_information table
ALTER TABLE public.page_help_information 
ADD COLUMN hover_text TEXT;