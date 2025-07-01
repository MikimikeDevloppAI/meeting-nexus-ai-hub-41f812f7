
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

// Fonction pour rendre les descriptions plus concises
const makeDescriptionConcise = (description: string): string => {
  // Nettoyer la description
  let cleaned = description.trim();
  
  // Supprimer les répétitions et les phrases trop longues
  const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  // Prendre seulement les 2 premières phrases les plus importantes
  const importantSentences = sentences.slice(0, 2);
  
  // Rejoindre et limiter à 120 caractères
  let result = importantSentences.join('. ').trim();
  if (result.length > 120) {
    result = result.substring(0, 117) + '...';
  }
  
  // S'assurer qu'il y a un point à la fin
  if (result && !result.endsWith('.') && !result.endsWith('...')) {
    result += '.';
  }
  
  return result;
};

export const saveTask = async (supabaseClient: any, task: any, meetingId: string, meetingParticipants: any[]) => {
  console.log('💾 Saving task:', task.description?.substring(0, 50) + '...');
  console.log('📋 Task assignment data:', task.assigned_to);
  
  try {
    // Récupérer TOUS les participants de la base de données, pas seulement ceux de la réunion
    const { data: allParticipants, error: participantsError } = await supabaseClient
      .from('participants')
      .select('id, name, email')
      .order('name');

    if (participantsError) {
      console.error('❌ Error fetching all participants:', participantsError);
      throw participantsError;
    }

    console.log(`👥 Total participants disponibles: ${allParticipants?.length || 0}`);
    
    // Rendre la description plus concise
    const conciseDescription = makeDescriptionConcise(task.description);
    console.log('📝 Description originale:', task.description);
    console.log('📝 Description concise:', conciseDescription);
    
    // Créer la tâche avec le statut "confirmed" (en cours)
    const { data: savedTask, error } = await supabaseClient
      .from('todos')
      .insert([{
        meeting_id: meetingId,
        description: conciseDescription,
        status: 'confirmed',
        due_date: task.due_date || null,
        assigned_to: null // On va le mettre à jour après
      }])
      .select()
      .single()

    if (error) {
      console.error('❌ Error saving task:', error)
      throw error
    }

    console.log('✅ Task saved with ID:', savedTask.id)

    // Traiter les assignations si spécifiées
    let firstAssignedParticipantId = null;
    
    if (task.assigned_to && Array.isArray(task.assigned_to) && task.assigned_to.length > 0) {
      console.log('👥 Assignation participants:', task.assigned_to);
      
      for (const participantName of task.assigned_to) {
        if (!participantName || typeof participantName !== 'string') continue;
        
        // Chercher le participant dans TOUS les participants disponibles
        const participant = findBestParticipantMatch(participantName.toString(), allParticipants || []);
        
        if (participant) {
          // Créer la relation dans todo_participants
          const { error: assignError } = await supabaseClient
            .from('todo_participants')
            .insert([{
              todo_id: savedTask.id,
              participant_id: participant.id
            }])
          
          if (assignError) {
            console.error('❌ Error assigning participant:', assignError)
          } else {
            console.log('✅ Participant assigné:', participant.name, 'to task:', savedTask.id)
            
            // Garder le premier participant assigné pour la colonne assigned_to
            if (!firstAssignedParticipantId) {
              firstAssignedParticipantId = participant.id;
            }
          }
        } else {
          console.warn('⚠️ Participant non trouvé pour assignation:', participantName)
          console.log('📋 Participants disponibles:', allParticipants?.map(p => ({ name: p.name, email: p.email })))
        }
      }
    } else {
      console.log('ℹ️ Pas de participants à assigner pour cette tâche')
    }

    // Mettre à jour la colonne assigned_to avec le premier participant assigné
    if (firstAssignedParticipantId) {
      const { error: updateError } = await supabaseClient
        .from('todos')
        .update({ assigned_to: firstAssignedParticipantId })
        .eq('id', savedTask.id);
        
      if (updateError) {
        console.error('❌ Error updating assigned_to column:', updateError);
      } else {
        console.log('✅ Updated assigned_to column with participant ID:', firstAssignedParticipantId);
        savedTask.assigned_to = firstAssignedParticipantId;
      }
    }

    return savedTask
  } catch (error) {
    console.error('❌ Error in saveTask:', error)
    throw error
  }
}
