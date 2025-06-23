
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useAutoRedirectOnRecommendations = (
  meetingId: string | null,
  isActive: boolean = false
) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasRedirectedRef = useRef(false);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    // DÉSACTIVER complètement la redirection automatique
    if (!meetingId || !isActive || hasRedirectedRef.current) {
      console.log('[AutoRedirect] ❌ Auto-redirection désactivée pour éviter les redirections non désirées');
      return;
    }

    console.log('[AutoRedirect] 🎯 Auto-redirection désactivée - pas de redirection automatique');

    // Nettoyer toutes les références sans créer de listeners
    return () => {
      console.log('[AutoRedirect] 🧹 Nettoyage sans redirection');
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [meetingId, isActive, navigate, toast]);

  const cleanup = () => {
    console.log('[AutoRedirect] 🧹 Manual cleanup appelé - pas de redirection');
    hasRedirectedRef.current = false;
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  };

  return { cleanup };
};
