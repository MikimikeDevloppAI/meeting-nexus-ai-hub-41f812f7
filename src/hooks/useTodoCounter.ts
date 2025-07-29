
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

// État global partagé entre toutes les instances
let globalTodoCount = 0;
let globalSubscribers = new Set<(count: number) => void>();
let globalChannel: any = null;
let globalUserId: string | null = null;

// Instance unique de souscription
const setupGlobalSubscription = (userId: string) => {
  if (globalChannel && globalUserId === userId) {
    console.log('🔌 Global subscription already exists for user:', userId);
    return;
  }

  // Nettoyer l'ancienne souscription si elle existe
  if (globalChannel) {
    console.log('🔌 Cleaning up old global subscription');
    supabase.removeChannel(globalChannel);
  }

  globalUserId = userId;
  console.log('🔌 Setting up NEW global subscription for user:', userId);

  globalChannel = supabase
    .channel(`unified-todo-counter-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'todos'
      },
      (payload) => {
        console.log('🔄 Global - Todos table changed:', payload);
        fetchGlobalTodos();
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
        console.log('🔄 Global - Todo_users table changed:', payload);
        fetchGlobalTodos();
      }
    )
    .subscribe((status) => {
      console.log('📡 Global subscription status:', status);
    });
};

// Fonction globale pour récupérer les todos
const fetchGlobalTodos = async () => {
  try {
    if (!globalUserId) {
      updateGlobalCount(0);
      return;
    }

    console.log('🔍 Global - Fetching pending todos for user:', globalUserId);

    const { data, error } = await supabase
      .from('todos')
      .select(`
        id,
        todo_users!inner(user_id)
      `)
      .eq('status', 'confirmed')
      .eq('todo_users.user_id', globalUserId);

    if (error) {
      console.error('❌ Global - Error fetching pending todos:', error);
      return;
    }

    const count = data?.length || 0;
    updateGlobalCount(count);
  } catch (error) {
    console.error('❌ Global - Error fetching pending todos:', error);
  }
};

// Fonction pour mettre à jour le compteur global
const updateGlobalCount = (count: number) => {
  globalTodoCount = count;
  console.log(`📊 Global - Updated todos count:`, count, `- notifying ${globalSubscribers.size} subscribers`);
  
  // Notifier tous les abonnés
  globalSubscribers.forEach(callback => {
    try {
      callback(count);
    } catch (error) {
      console.error('❌ Error notifying subscriber:', error);
    }
  });
};

export const useTodoCounter = () => {
  const [pendingCount, setPendingCount] = useState(globalTodoCount);
  const { user } = useAuth();

  console.log('🔶 useTodoCounter hook initialized, user:', user?.id, 'current global count:', globalTodoCount);

  // Fonction de callback pour recevoir les mises à jour
  const handleCountUpdate = useCallback((count: number) => {
    console.log('🔶 Hook received count update:', count);
    setPendingCount(count);
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setPendingCount(0);
      return;
    }

    // S'abonner aux mises à jour globales
    globalSubscribers.add(handleCountUpdate);
    console.log(`🔶 Subscriber added. Total subscribers: ${globalSubscribers.size}`);

    // Configurer la souscription globale si nécessaire
    setupGlobalSubscription(user.id);
    
    // Récupérer les données initiales
    fetchGlobalTodos();

    // Cleanup
    return () => {
      globalSubscribers.delete(handleCountUpdate);
      console.log(`🔶 Subscriber removed. Remaining subscribers: ${globalSubscribers.size}`);
      
      // Nettoyer la souscription globale si plus d'abonnés
      if (globalSubscribers.size === 0 && globalChannel) {
        console.log('🔌 No more subscribers, cleaning up global subscription');
        supabase.removeChannel(globalChannel);
        globalChannel = null;
        globalUserId = null;
      }
    };
  }, [user?.id, handleCountUpdate]);

  console.log('🔶 Hook returning count:', pendingCount);
  return pendingCount;
};
