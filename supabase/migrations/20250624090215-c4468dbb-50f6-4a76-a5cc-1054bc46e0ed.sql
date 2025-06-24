
-- Create invoices table with Mindee API response fields and allocation system
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- File information
  original_filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  content_type TEXT,
  
  -- Processing status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, error
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  
  -- Allocation system
  david_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0 CHECK (david_percentage >= 0 AND david_percentage <= 100),
  cabinet_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0 CHECK (cabinet_percentage >= 0 AND cabinet_percentage <= 100),
  
  -- Mindee API extracted data - Document level
  invoice_number TEXT,
  invoice_date DATE,
  due_date DATE,
  total_net DECIMAL(15, 2),
  total_amount DECIMAL(15, 2),
  total_tax DECIMAL(15, 2),
  currency TEXT,
  
  -- Supplier information
  supplier_name TEXT,
  supplier_address TEXT,
  supplier_company_registration TEXT,
  supplier_vat_number TEXT,
  supplier_website TEXT,
  supplier_email TEXT,
  supplier_phone_number TEXT,
  
  -- Customer information
  customer_name TEXT,
  customer_address TEXT,
  customer_company_registration TEXT,
  customer_vat_number TEXT,
  
  -- Payment information
  payment_details TEXT,
  
  -- Raw Mindee response for full data preservation
  mindee_raw_response JSONB,
  
  -- Metadata
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add constraint to ensure allocations sum to 100%
ALTER TABLE public.invoices 
ADD CONSTRAINT check_allocation_sum 
CHECK (david_percentage + cabinet_percentage = 100);

-- Create index for faster queries
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_created_by ON public.invoices(created_by);
CREATE INDEX idx_invoices_invoice_date ON public.invoices(invoice_date);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Create policies for invoice access
CREATE POLICY "Users can view all invoices" 
  ON public.invoices 
  FOR SELECT 
  USING (true);

CREATE POLICY "Users can create invoices" 
  ON public.invoices 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Users can update invoices" 
  ON public.invoices 
  FOR UPDATE 
  USING (true);

-- Create storage bucket for invoice files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoices',
  'invoices',
  false,
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
);

-- Create storage policies
CREATE POLICY "Users can upload invoice files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'invoices');

CREATE POLICY "Users can view invoice files"
ON storage.objects FOR SELECT
USING (bucket_id = 'invoices');

CREATE POLICY "Users can update invoice files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'invoices');

CREATE POLICY "Users can delete invoice files"
ON storage.objects FOR DELETE
USING (bucket_id = 'invoices');
