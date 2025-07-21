
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

      console.log('🔍 Fetching pending todos for user:', user.id);

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
        console.error('❌ Error fetching pending todos:', error);
        return;
      }

      const count = data?.length || 0;
      setPendingCount(count);
      console.log('📊 Updated todos count:', count);
    } catch (error) {
      console.error('❌ Error fetching pending todos:', error);
    }
  };

  useEffect(() => {
    fetchPendingTodos();

    console.log('🔌 Setting up real-time subscription for todo counter');

    // Écouter les changements en temps réel sur les todos et les assignations
    const channel = supabase
      .channel('unified-todo-counter')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'todos'
        },
        (payload) => {
          console.log('🔄 Todos table changed:', payload);
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
        (payload) => {
          console.log('🔄 Todo_users table changed:', payload);
          fetchPendingTodos();
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
      });

    return () => {
      console.log('🔌 Cleaning up todo counter subscription');
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return pendingCount;
};
