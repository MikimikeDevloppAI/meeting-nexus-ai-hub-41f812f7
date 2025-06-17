
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { supabase } from "@/integrations/supabase/client"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getDocumentViewUrl(filePath: string): string {
  if (!filePath) return '';
  
  // Get the public URL from Supabase storage
  const { data } = supabase.storage
    .from('documents')
    .getPublicUrl(filePath);
  
  return data.publicUrl;
}

export function getDocumentDownloadUrl(filePath: string): string {
  if (!filePath) return '';
  
  // Get the public URL with download parameter
  const { data } = supabase.storage
    .from('documents')
    .getPublicUrl(filePath, {
      download: true
    });
  
  return data.publicUrl;
}
