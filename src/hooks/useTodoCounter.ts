import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useTodoCounter = () => {
  const [pendingCount, setPendingCount] = useState(0);

  const fetchPendingTodos = async () => {
    try {
      const { data, error } = await supabase
        .from('todos')
        .select('id')
        .eq('status', 'pending');

      if (error) {
        console.error('Error fetching pending todos:', error);
        return;
      }

      setPendingCount(data?.length || 0);
    } catch (error) {
      console.error('Error fetching pending todos:', error);
    }
  };

  useEffect(() => {
    fetchPendingTodos();

    // Écouter les changements en temps réel
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'todos'
        },
        () => {
          fetchPendingTodos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Mettre à jour le titre de la page avec le badge
  useEffect(() => {
    const baseTitle = 'IOL Management';
    
    if (pendingCount > 0) {
      document.title = `(${pendingCount}) ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }, [pendingCount]);

  return pendingCount;
};