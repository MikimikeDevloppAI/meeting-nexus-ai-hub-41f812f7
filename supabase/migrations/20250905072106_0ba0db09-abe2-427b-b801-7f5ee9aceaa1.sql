-- Add comment column to invoices table
ALTER TABLE public.invoices 
ADD COLUMN comment TEXT;