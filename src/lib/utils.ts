
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

// Fonction pour vérifier si un fichier peut être prévisualisé directement
export function canPreviewDirectly(contentType: string): boolean {
  const previewableTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'text/plain'
  ];
  
  return previewableTypes.includes(contentType);
}

// Fonction pour obtenir l'URL de fallback avec Google Docs Viewer
export function getGoogleDocsViewerUrl(publicUrl: string): string {
  return `https://docs.google.com/gview?url=${encodeURIComponent(publicUrl)}&embedded=true`;
}

// Fonction pour obtenir l'URL de fallback avec Office Online
export function getOfficeOnlineViewerUrl(publicUrl: string): string {
  return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(publicUrl)}`;
}
