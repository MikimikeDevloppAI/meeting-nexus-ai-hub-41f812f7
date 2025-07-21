import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export const useTodoCounter = () => {
  const [pendingCount, setPendingCount] = useState(0);
  const { user } = useAuth();

  const fetchPendingTodos = async () => {
    try {
      if (!user?.id) {
        console.log('TodoCounter: No user ID, setting count to 0');
        setPendingCount(0);
        return;
      }

      console.log('TodoCounter: Fetching pending todos for user:', user.id);

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

      const count = data?.length || 0;
      console.log('TodoCounter: Setting pending count to:', count);
      setPendingCount(count);
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
          console.log('TodoCounter: Real-time update - todos table changed');
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
          console.log('TodoCounter: Real-time update - todo_users table changed');
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
      const newTitle = `(${pendingCount}) ${baseTitle}`;
      console.log('TodoCounter: Updating page title to:', newTitle);
      document.title = newTitle;
    } else {
      console.log('TodoCounter: Updating page title to:', baseTitle);
      document.title = baseTitle;
    }
  }, [pendingCount]);

  return pendingCount;
};