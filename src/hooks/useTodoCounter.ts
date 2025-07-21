import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export const useTodoCounter = () => {
  const [pendingCount, setPendingCount] = useState(0);
  const { user } = useAuth();

  const fetchPendingTodos = async () => {
    try {
      if (!user?.id) {
        setPendingCount(0);
        return;
      }

      // Compter seulement les tâches en cours (confirmed) qui sont attribuées à l'utilisateur connecté
      const { data, error } = await supabase
        .from('todos')
        .select(`
          id,
          todo_users!inner(user_id)
        `)
        .eq('status', 'confirmed')
        .eq('todo_users.user_id', user.id);

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

    // Écouter les changements en temps réel sur les todos et les assignations
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
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'todo_users'
        },
        () => {
          fetchPendingTodos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

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