
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
    if (!meetingId || !isActive || hasRedirectedRef.current) {
      console.log('[AutoRedirect] ❌ Not starting listener:', { 
        meetingId: !!meetingId, 
        isActive, 
        hasRedirected: hasRedirectedRef.current 
      });
      return;
    }

    console.log('[AutoRedirect] 🎯 Setting up realtime listener for meeting:', meetingId);

    // Set up realtime subscription to listen for new recommendations
    const channel = supabase
      .channel(`todo-recommendations-${meetingId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'todo_ai_recommendations'
        },
        async (payload) => {
          console.log('[AutoRedirect] 📥 New recommendation detected:', payload);

          if (hasRedirectedRef.current) {
            console.log('[AutoRedirect] ⚠️ Already redirected, ignoring');
            return;
          }

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

          console.log('[AutoRedirect] 🔍 Todo data:', todoData);

          if (todoData?.meeting_id === meetingId) {
            console.log('[AutoRedirect] ✅ Recommendation is for our meeting, scheduling redirect...');
            
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
            console.log('[AutoRedirect] ℹ️ Recommendation is for different meeting:', todoData?.meeting_id, 'vs', meetingId);
          }
        }
      )
      .subscribe((status) => {
        console.log('[AutoRedirect] 📡 Subscription status:', status);
      });

    channelRef.current = channel;
    console.log('[AutoRedirect] 📡 Realtime subscription active');

    // Add a safety timeout to check manually after 1 minute
    const safetyTimeout = setTimeout(async () => {
      console.log('[AutoRedirect] ⏰ Safety check after 1 minute...');
      
      if (hasRedirectedRef.current) {
        console.log('[AutoRedirect] ⏰ Already redirected, skipping safety check');
        return;
      }

      // Manual check for recommendations
      const { data: todos } = await supabase
        .from('todos')
        .select('id')
        .eq('meeting_id', meetingId);

      if (todos && todos.length > 0) {
        const todoIds = todos.map(t => t.id);
        
        const { data: recommendations } = await supabase
          .from('todo_ai_recommendations')
          .select('id')
          .in('todo_id', todoIds);

        if (recommendations && recommendations.length > 0) {
          console.log('[AutoRedirect] ⏰ Found recommendations in safety check, redirecting...');
          hasRedirectedRef.current = true;
          
          toast({
            title: "Traitement terminé",
            description: "Les recommandations ont été générées. Redirection vers votre réunion...",
          });

          navigate(`/meetings/${meetingId}`);
        } else {
          console.log('[AutoRedirect] ⏰ No recommendations found yet in safety check');
        }
      }
    }, 60000); // 1 minute

    return () => {
      console.log('[AutoRedirect] 🧹 Cleaning up realtime subscription');
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      clearTimeout(safetyTimeout);
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [meetingId, isActive, navigate, toast]);

  const cleanup = () => {
    console.log('[AutoRedirect] 🧹 Manual cleanup called');
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
