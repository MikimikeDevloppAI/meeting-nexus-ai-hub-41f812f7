-- Add currency conversion columns to invoices table
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(10,6),
ADD COLUMN IF NOT EXISTS original_amount_chf DECIMAL(10,2);