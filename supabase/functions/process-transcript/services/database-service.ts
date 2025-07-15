
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const createSupabaseClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL or key not found')
  }

  return createClient(supabaseUrl, supabaseKey)
}

export const saveRawTranscript = async (supabaseClient: any, meetingId: string, transcript: string) => {
  const { error } = await supabaseClient
    .from('meetings')
    .update({ raw_transcript: transcript })
    .eq('id', meetingId)

  if (error) {
    console.error('Error saving raw transcript:', error)
    throw error
  }
}

export const saveTranscript = async (supabaseClient: any, meetingId: string, transcript: string) => {
  const { error } = await supabaseClient
    .from('meetings')
    .update({ transcript: transcript })
    .eq('id', meetingId)

  if (error) {
    console.error('Error saving transcript:', error)
    throw error
  }
}

export const saveSummary = async (supabaseClient: any, meetingId: string, summary: string) => {
  const { error } = await supabaseClient
    .from('meetings')
    .update({ summary: summary })
    .eq('id', meetingId)

  if (error) {
    console.error('Error saving summary:', error)
    throw error
  }
}

export const getMeetingData = async (supabaseClient: any, meetingId: string) => {
  const { data, error } = await supabaseClient
    .from('meetings')
    .select('id, title, created_at')
    .eq('id', meetingId)
    .single()

  if (error) {
    console.error('Error fetching meeting data:', error)
    throw error
  }

  return data
}

// Fonction pour normaliser les noms et améliorer la correspondance
const normalizeParticipantName = (name: string): string => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .trim();
};

// Mapper les variantes de noms connues
const getNameVariants = (searchName: string): string[] => {
  const normalized = normalizeParticipantName(searchName);
  
  const nameMapping: Record<string, string[]> = {
    'leila': ['leïla', 'leila'],
    'emilie': ['émilie', 'emilie'],
    'david': ['david', 'david tabibian', 'tabibian'],
    'parmice': ['parmice', 'parmis'],
    'sybil': ['sybil'],
    'tabibian': ['tabibian', 'dr tabibian', 'docteur tabibian', 'david tabibian']
  };
  
  // Chercher dans le mapping
  for (const [key, variants] of Object.entries(nameMapping)) {
    if (variants.some(variant => normalizeParticipantName(variant) === normalized)) {
      return variants;
    }
  }
  
  return [searchName];
};

// Fonction pour trouver le meilleur participant correspondant
const findBestParticipantMatch = (searchName: string, allParticipants: any[]): any | null => {
  if (!searchName || !allParticipants?.length) return null;

  console.log(`🔍 Recherche correspondance pour: "${searchName}"`);
  console.log(`👥 Participants disponibles:`, allParticipants.map(p => ({ id: p.id, name: p.name, email: p.email })));
  
  const variants = getNameVariants(searchName);
  console.log(`🔄 Variantes testées:`, variants);
  
  // 1. Correspondance exacte avec variantes
  for (const variant of variants) {
    const normalizedVariant = normalizeParticipantName(variant);
    
    for (const participant of allParticipants) {
      const normalizedParticipantName = normalizeParticipantName(participant.name);
      const normalizedEmail = normalizeParticipantName(participant.email?.split('@')[0] || '');
      
      if (normalizedParticipantName === normalizedVariant || 
          normalizedEmail === normalizedVariant ||
          normalizedParticipantName.includes(normalizedVariant) ||
          normalizedVariant.includes(normalizedParticipantName)) {
        console.log(`✅ Correspondance trouvée: ${participant.name} (${participant.email})`);
        return participant;
      }
    }
  }
  
  // 2. Correspondance partielle par prénom
  const firstName = normalizeParticipantName(searchName.split(' ')[0]);
  for (const participant of allParticipants) {
    const participantFirstName = normalizeParticipantName(participant.name.split(' ')[0]);
    if (participantFirstName === firstName) {
      console.log(`✅ Correspondance par prénom: ${participant.name}`);
      return participant;
    }
  }
  
  console.log(`⚠️ Aucune correspondance trouvée pour: "${searchName}"`);
  return null;
};


export const saveTask = async (supabaseClient: any, task: any, meetingId: string, meetingUsers: any[]) => {
  console.log('💾 Saving task:', task.description?.substring(0, 50) + '...');
  console.log('📋 Task assignment data:', task.assigned_to);
  
  try {
    // Récupérer TOUS les utilisateurs de la base de données, pas seulement ceux de la réunion
    const { data: allUsers, error: usersError } = await supabaseClient
      .from('users')
      .select('id, name, email')
      .order('name');

    if (usersError) {
      console.error('❌ Error fetching all users:', usersError);
      throw usersError;
    }

    console.log(`👥 Total users disponibles: ${allUsers?.length || 0}`);
    
    console.log('📝 Description originale:', task.description);
    
    // Créer la tâche
    const { data: savedTask, error } = await supabaseClient
      .from('todos')
      .insert([{
        meeting_id: meetingId,
        description: task.description,
        status: 'confirmed',
        due_date: task.due_date || null
      }])
      .select()
      .single()

    if (error) {
      console.error('❌ Error saving task:', error)
      throw error
    }

    console.log('✅ Task saved with ID:', savedTask.id)

    // Traiter les assignations si spécifiées
    if (task.assigned_to && Array.isArray(task.assigned_to) && task.assigned_to.length > 0) {
      console.log('👥 Assignation users:', task.assigned_to);
      
      for (const userName of task.assigned_to) {
        if (!userName || typeof userName !== 'string') continue;
        
        // Chercher le user dans TOUS les users disponibles
        const user = findBestUserMatch(userName.toString(), allUsers || []);
        
        if (user) {
          // Créer la relation dans todo_users
          const { error: assignError } = await supabaseClient
            .from('todo_users')
            .insert([{
              todo_id: savedTask.id,
              user_id: user.id
            }])
          
          if (assignError) {
            console.error('❌ Error assigning user:', assignError)
          } else {
            console.log('✅ User assigné:', user.name, 'to task:', savedTask.id)
          }
        } else {
          console.warn('⚠️ User non trouvé pour assignation:', userName)
          console.log('📋 Users disponibles:', allUsers?.map(p => ({ name: p.name, email: p.email })))
        }
      }
    } else {
      console.log('ℹ️ Pas de users à assigner pour cette tâche')
    }

    return savedTask
  } catch (error) {
    console.error('❌ Error in saveTask:', error)
    throw error
  }
}

// Fonction pour trouver le meilleur user correspondant
const findBestUserMatch = (searchName: string, allUsers: any[]): any | null => {
  if (!searchName || !allUsers?.length) return null;

  console.log(`🔍 Recherche correspondance pour: "${searchName}"`);
  console.log(`👥 Users disponibles:`, allUsers.map(p => ({ id: p.id, name: p.name, email: p.email })));
  
  const variants = getNameVariants(searchName);
  console.log(`🔄 Variantes testées:`, variants);
  
  // 1. Correspondance exacte avec variantes
  for (const variant of variants) {
    const normalizedVariant = normalizeUserName(variant);
    
    for (const user of allUsers) {
      const normalizedUserName = normalizeUserName(user.name);
      const normalizedEmail = normalizeUserName(user.email?.split('@')[0] || '');
      
      if (normalizedUserName === normalizedVariant || 
          normalizedEmail === normalizedVariant ||
          normalizedUserName.includes(normalizedVariant) ||
          normalizedVariant.includes(normalizedUserName)) {
        console.log(`✅ Correspondance trouvée: ${user.name} (${user.email})`);
        return user;
      }
    }
  }
  
  // 2. Correspondance partielle par prénom
  const firstName = normalizeUserName(searchName.split(' ')[0]);
  for (const user of allUsers) {
    const userFirstName = normalizeUserName(user.name.split(' ')[0]);
    if (userFirstName === firstName) {
      console.log(`✅ Correspondance par prénom: ${user.name}`);
      return user;
    }
  }
  
  console.log(`⚠️ Aucune correspondance trouvée pour: "${searchName}"`);
  return null;
};

// Fonction pour normaliser les noms et améliorer la correspondance
const normalizeUserName = (name: string): string => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .trim();
};
