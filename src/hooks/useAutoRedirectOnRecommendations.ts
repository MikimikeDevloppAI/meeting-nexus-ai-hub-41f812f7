
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

  useEffect(() => {
    if (!meetingId || !isActive || hasRedirectedRef.current) {
      return;
    }

    console.log('[AutoRedirect] 🎯 Setting up realtime listener for meeting:', meetingId);

    // Set up realtime subscription to listen for new recommendations
    const channel = supabase
      .channel('todo-recommendations-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'todo_ai_recommendations'
        },
        async (payload) => {
          console.log('[AutoRedirect] 📥 New recommendation detected:', payload);

          // Check if this recommendation is for a todo related to our meeting
          const { data: todoData, error } = await supabase
            .from('todos')
            .select('meeting_id')
            .eq('id', payload.new.todo_id)
            .single();

          if (error) {
            console.error('[AutoRedirect] ❌ Error checking todo:', error);
            return;
          }

          if (todoData?.meeting_id === meetingId) {
            console.log('[AutoRedirect] ✅ Recommendation is for our meeting, scheduling redirect...');
            
            if (hasRedirectedRef.current) {
              console.log('[AutoRedirect] ⚠️ Already redirected, ignoring');
              return;
            }

            hasRedirectedRef.current = true;

            // Wait 2 seconds then redirect
            timeoutRef.current = setTimeout(() => {
              console.log('[AutoRedirect] 🚀 Redirecting to meeting:', meetingId);
              
              toast({
                title: "Traitement terminé",
                description: "Les recommandations ont été générées. Redirection vers votre réunion...",
              });

              navigate(`/meetings/${meetingId}`);
            }, 2000);
          } else {
            console.log('[AutoRedirect] ℹ️ Recommendation is for different meeting:', todoData?.meeting_id);
          }
        }
      )
      .subscribe();

    console.log('[AutoRedirect] 📡 Realtime subscription active');

    return () => {
      console.log('[AutoRedirect] 🧹 Cleaning up realtime subscription');
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      supabase.removeChannel(channel);
    };
  }, [meetingId, isActive, navigate, toast]);

  const cleanup = () => {
    console.log('[AutoRedirect] 🧹 Manual cleanup called');
    hasRedirectedRef.current = false;
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  return { cleanup };
};
