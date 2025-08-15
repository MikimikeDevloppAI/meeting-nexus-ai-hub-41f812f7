-- Create table operation
CREATE TABLE public.operation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  ecriture TEXT,
  par TEXT,
  numero_facture TEXT,
  numero_patient TEXT,
  patient TEXT,
  montant_femto_pkr NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table vision_ophta
CREATE TABLE public.vision_ophta (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  ecriture TEXT,
  par TEXT,
  numero_facture TEXT,
  numero_patient TEXT,
  patient TEXT,
  montant NUMERIC,
  cxl NUMERIC,
  ptk NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.operation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vision_ophta ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for operation table
CREATE POLICY "allow_all_operation" 
ON public.operation 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create RLS policies for vision_ophta table
CREATE POLICY "allow_all_vision_ophta" 
ON public.vision_ophta 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create triggers for updated_at columns
CREATE TRIGGER update_operation_updated_at
BEFORE UPDATE ON public.operation
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vision_ophta_updated_at
BEFORE UPDATE ON public.vision_ophta
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();