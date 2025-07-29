import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useUserPermissions } from '@/hooks/useUserPermissions';

// État global partagé entre toutes les instances
let globalHRCount = 0;
let globalSubscribers = new Set<(count: number) => void>();
let globalChannel: any = null;
let globalUserId: string | null = null;

// Instance unique de souscription
const setupGlobalSubscription = (userId: string) => {
  if (globalChannel && globalUserId === userId) {
    console.log('🔌 HR Global subscription already exists for user:', userId);
    return;
  }

  // Nettoyer l'ancienne souscription si elle existe
  if (globalChannel) {
    console.log('🔌 HR Cleaning up old global subscription');
    supabase.removeChannel(globalChannel);
  }

  globalUserId = userId;
  console.log('🔌 HR Setting up NEW global subscription for user:', userId);

  globalChannel = supabase
    .channel(`hr-validation-counter-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'overtime_hours'
      },
      (payload) => {
        console.log('🔄 HR Global - Overtime hours table changed:', payload);
        fetchGlobalHRValidations();
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'vacations'
      },
      (payload) => {
        console.log('🔄 HR Global - Vacations table changed:', payload);
        fetchGlobalHRValidations();
      }
    )
    .subscribe((status) => {
      console.log('📡 HR Global subscription status:', status);
    });
};

// Fonction globale pour récupérer les validations HR en attente
const fetchGlobalHRValidations = async () => {
  try {
    if (!globalUserId) {
      updateGlobalCount(0);
      return;
    }

    console.log('🔍 HR Global - Fetching pending validations for user:', globalUserId);

    // Vérifier d'abord les permissions
    const { data: permissions, error: permError } = await supabase
      .from('user_permissions')
      .select('granted')
      .eq('user_id', globalUserId)
      .eq('page_id', 'hr-validation')
      .single();

    if (permError || !permissions?.granted) {
      console.log('🔍 HR Global - User does not have HR validation permissions');
      updateGlobalCount(0);
      return;
    }

    // Récupérer les heures supplémentaires en attente
    const { data: overtimeData, error: overtimeError } = await supabase
      .from('overtime_hours')
      .select('id')
      .eq('status', 'pending');

    if (overtimeError) {
      console.error('❌ HR Global - Error fetching pending overtime hours:', overtimeError);
      return;
    }

    // Récupérer les vacances en attente
    const { data: vacationsData, error: vacationsError } = await supabase
      .from('vacations')
      .select('id')
      .eq('status', 'pending');

    if (vacationsError) {
      console.error('❌ HR Global - Error fetching pending vacations:', vacationsError);
      return;
    }

    const overtimeCount = overtimeData?.length || 0;
    const vacationsCount = vacationsData?.length || 0;
    const totalCount = overtimeCount + vacationsCount;

    console.log('🔍 HR Global - Pending overtime:', overtimeCount, 'vacations:', vacationsCount, 'total:', totalCount);
    updateGlobalCount(totalCount);
  } catch (error) {
    console.error('❌ HR Global - Error fetching pending validations:', error);
  }
};

// Fonction pour mettre à jour le compteur global
const updateGlobalCount = (count: number) => {
  globalHRCount = count;
  console.log(`📊 HR Global - Updated validations count:`, count, `- notifying ${globalSubscribers.size} subscribers`);
  
  // Notifier tous les abonnés
  globalSubscribers.forEach(callback => {
    try {
      callback(count);
    } catch (error) {
      console.error('❌ HR Error notifying subscriber:', error);
    }
  });
};

export const useHRValidationCounter = () => {
  const [pendingCount, setPendingCount] = useState(globalHRCount);
  const { user } = useAuth();
  const { hasPermission } = useUserPermissions();

  console.log('🟠 useHRValidationCounter hook initialized, user:', user?.id, 'current global count:', globalHRCount);

  // Fonction de callback pour recevoir les mises à jour
  const handleCountUpdate = useCallback((count: number) => {
    console.log('🟠 HR Hook received count update:', count);
    setPendingCount(count);
  }, []);

  useEffect(() => {
    if (!user?.id || !hasPermission('hr-validation')) {
      setPendingCount(0);
      return;
    }

    // S'abonner aux mises à jour globales
    globalSubscribers.add(handleCountUpdate);
    console.log(`🟠 HR Subscriber added. Total subscribers: ${globalSubscribers.size}`);

    // Configurer la souscription globale si nécessaire
    setupGlobalSubscription(user.id);
    
    // Récupérer les données initiales
    fetchGlobalHRValidations();

    // Cleanup
    return () => {
      globalSubscribers.delete(handleCountUpdate);
      console.log(`🟠 HR Subscriber removed. Remaining subscribers: ${globalSubscribers.size}`);
      
      // Nettoyer la souscription globale si plus d'abonnés
      if (globalSubscribers.size === 0 && globalChannel) {
        console.log('🔌 HR No more subscribers, cleaning up global subscription');
        supabase.removeChannel(globalChannel);
        globalChannel = null;
        globalUserId = null;
      }
    };
  }, [user?.id, hasPermission('hr-validation'), handleCountUpdate]);

  console.log('🟠 HR Hook returning count:', pendingCount);
  return pendingCount;
};