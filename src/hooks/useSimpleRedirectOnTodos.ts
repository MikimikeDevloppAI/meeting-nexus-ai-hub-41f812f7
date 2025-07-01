
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useSimpleRedirectOnTodos = (
  meetingId: string | null,
  isActive: boolean = false
) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasRedirectedRef = useRef(false);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!meetingId || !isActive || hasRedirectedRef.current) {
      console.log('[SimpleRedirect] ❌ Conditions non remplies:', { meetingId, isActive, hasRedirected: hasRedirectedRef.current });
      return;
    }

    console.log('[SimpleRedirect] 🎯 Démarrage vérification simple pour la réunion:', meetingId);
    startTimeRef.current = Date.now();

    const checkForTodos = async () => {
      try {
        console.log('[SimpleRedirect] 🔍 Vérification des todos...');
        
        const { data: todos, error } = await supabase
          .from('todos')
          .select('id')
          .eq('meeting_id', meetingId);

        if (error) {
          console.error('[SimpleRedirect] ❌ Erreur lors de la vérification:', error);
          return;
        }

        const todosCount = todos?.length || 0;
        const elapsedTime = Math.round((Date.now() - startTimeRef.current) / 1000);
        
        console.log('[SimpleRedirect] 📊 État:', { todosCount, elapsedTime });

        if (todosCount > 0) {
          console.log('[SimpleRedirect] ✅ Todos détectés! Attente de 30 secondes avant redirection...');
          
          // Nettoyer l'intervalle de vérification
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }

          // Attendre 30 secondes puis rediriger
          timeoutRef.current = setTimeout(() => {
            if (!hasRedirectedRef.current) {
              hasRedirectedRef.current = true;
              
              toast({
                title: "Traitement terminé",
                description: "Redirection vers votre réunion...",
              });
              
              navigate(`/meetings/${meetingId}`);
            }
          }, 30000); // 30 secondes
        }
      } catch (error) {
        console.error('[SimpleRedirect] ❌ Erreur:', error);
      }
    };

    // Première vérification immédiate
    checkForTodos();

    // Vérification toutes les 5 secondes
    intervalRef.current = setInterval(checkForTodos, 5000);

    // Timeout maximum de 10 minutes
    const maxTimeout = setTimeout(() => {
      console.log('[SimpleRedirect] ⏰ Timeout maximum atteint (10 min)');
      cleanup();
      
      toast({
        title: "Traitement en cours",
        description: "Le traitement prend plus de temps que prévu. Vous pouvez consulter votre réunion manuellement.",
        variant: "default",
      });
    }, 600000); // 10 minutes

    // Nettoyage lors du démontage
    return () => {
      console.log('[SimpleRedirect] 🧹 Nettoyage');
      cleanup();
      clearTimeout(maxTimeout);
    };
  }, [meetingId, isActive, navigate, toast]);

  const cleanup = () => {
    console.log('[SimpleRedirect] 🧹 Nettoyage manuel appelé');
    hasRedirectedRef.current = false;
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  return { cleanup };
};
