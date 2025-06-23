
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
    // Redirection automatique UNIQUEMENT pour les réunions créées avec audio
    if (!meetingId || !isActive || hasRedirectedRef.current) {
      console.log('[AutoRedirect] ❌ Pas de redirection automatique:', { meetingId, isActive, hasRedirected: hasRedirectedRef.current });
      return;
    }

    console.log('[AutoRedirect] 🎯 Activation de la redirection automatique pour la réunion:', meetingId);

    // Créer un channel pour écouter les mises à jour de la réunion
    const channelName = `meeting-updates-${meetingId}`;
    channelRef.current = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'meetings',
          filter: `id=eq.${meetingId}`
        },
        (payload) => {
          console.log('[AutoRedirect] 📡 Mise à jour de la réunion reçue:', payload);
          
          // Vérifier si des recommandations ont été créées (indicateur que le traitement est terminé)
          if (payload.new && (payload.new.summary || payload.new.recommendations)) {
            console.log('[AutoRedirect] ✅ Traitement terminé détecté, redirection vers la réunion');
            
            if (!hasRedirectedRef.current) {
              hasRedirectedRef.current = true;
              
              // Attendre un peu pour s'assurer que toutes les données sont sauvegardées
              timeoutRef.current = setTimeout(() => {
                if (!hasRedirectedRef.current) return; // Double check
                
                toast({
                  title: "Traitement terminé",
                  description: "Redirection vers votre réunion...",
                });
                
                navigate(`/meetings/${meetingId}`);
              }, 2000);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('[AutoRedirect] 📡 Statut du channel:', status);
      });

    // Nettoyer lors du démontage
    return () => {
      console.log('[AutoRedirect] 🧹 Nettoyage du channel et timeout');
      
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
    console.log('[AutoRedirect] 🧹 Nettoyage manuel appelé');
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
