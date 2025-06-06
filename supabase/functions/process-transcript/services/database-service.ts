
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export function createSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

export async function saveTranscript(supabaseClient: any, meetingId: string, transcript: string) {
  const { error } = await supabaseClient
    .from('meetings')
    .update({ transcript })
    .eq('id', meetingId);

  if (error) {
    console.error('Error saving cleaned transcript:', error);
    throw error;
  }
}

export async function saveSummary(supabaseClient: any, meetingId: string, summary: string) {
  const { error } = await supabaseClient
    .from('meetings')
    .update({ summary })
    .eq('id', meetingId);

  if (error) {
    console.error('Error saving summary:', error);
    throw error;
  }
}

export async function getMeetingData(supabaseClient: any, meetingId: string) {
  const { data, error } = await supabaseClient
    .from('meetings')
    .select('title, created_at')
    .eq('id', meetingId)
    .single();

  if (error) {
    console.error('Error fetching meeting data:', error);
    throw new Error('Could not fetch meeting information');
  }

  return data;
}

export async function saveTask(supabaseClient: any, task: any, meetingId: string, participants: any[]) {
  console.log(`[SAVE_TASK] Processing task: "${task.description}"`);
  console.log(`[SAVE_TASK] Available participants:`, participants.map(p => ({ id: p.id, name: p.name })));
  
  // Récupérer TOUS les participants de la réunion pour l'assignation
  const { data: meetingParticipants, error: participantsError } = await supabaseClient
    .from('meeting_participants')
    .select(`
      participant_id,
      participants (
        id,
        name,
        email
      )
    `)
    .eq('meeting_id', meetingId);

  if (participantsError) {
    console.error('Error fetching meeting participants:', participantsError);
  }

  // Utiliser les participants de la réunion pour l'assignation
  const availableParticipants = meetingParticipants?.map((mp: any) => mp.participants).filter(Boolean) || participants;
  console.log(`[SAVE_TASK] Meeting participants for assignment:`, availableParticipants.map(p => ({ id: p.id, name: p.name })));

  // Logique d'assignation améliorée avec normalisation
  let assignedToId = null;
  if (task.assignedTo) {
    console.log(`[SAVE_TASK] Looking for participant: "${task.assignedTo}"`);
    
    // Normaliser le nom recherché
    const searchName = task.assignedTo.toLowerCase().trim();
    
    // 1. Correspondance exacte du nom (insensible à la casse)
    let assignedParticipant = availableParticipants.find((p: any) => 
      p.name.toLowerCase().trim() === searchName
    );
    
    // 2. Correspondance par prénom ou nom de famille
    if (!assignedParticipant) {
      const searchWords = searchName.split(/\s+/).filter(word => word.length >= 2);
      assignedParticipant = availableParticipants.find((p: any) => {
        const participantWords = p.name.toLowerCase().split(/\s+/).filter(word => word.length >= 2);
        return searchWords.some(searchWord => 
          participantWords.some(participantWord => {
            // Correspondance exacte de mot
            if (searchWord === participantWord) return true;
            // Correspondance partielle pour les diminutifs (minimum 3 caractères)
            if (searchWord.length >= 3 && participantWord.startsWith(searchWord)) return true;
            if (participantWord.length >= 3 && searchWord.startsWith(participantWord)) return true;
            return false;
          })
        );
      });
    }
    
    // 3. Correspondance avec variations communes
    if (!assignedParticipant) {
      const nameVariations: { [key: string]: string[] } = {
        'émilie': ['emilie', 'emi'],
        'emilie': ['émilie', 'emi'],
        'leïla': ['leila', 'layla'],
        'leila': ['leïla', 'layla'],
        'david': ['dave', 'dav'],
        'tabibian': ['tabi', 'tab']
      };
      
      for (const [canonical, variations] of Object.entries(nameVariations)) {
        if (searchName.includes(canonical) || variations.some(v => searchName.includes(v))) {
          assignedParticipant = availableParticipants.find((p: any) => 
            p.name.toLowerCase().includes(canonical) || 
            variations.some(v => p.name.toLowerCase().includes(v))
          );
          if (assignedParticipant) break;
        }
      }
    }
    
    assignedToId = assignedParticipant?.id || null;
    
    if (assignedToId) {
      console.log(`✅ [SAVE_TASK] Successfully assigned task to ${assignedParticipant.name} (ID: ${assignedToId})`);
    } else {
      console.log(`⚠️ [SAVE_TASK] Could not match "${task.assignedTo}" to any meeting participant`);
      console.log(`[SAVE_TASK] Available names: ${availableParticipants.map(p => p.name).join(', ')}`);
    }
  }

  // Sauvegarder la tâche avec l'assignation
  const { data, error } = await supabaseClient
    .from('todos')
    .insert({
      description: task.description,
      meeting_id: meetingId,
      assigned_to: assignedToId,
      status: 'pending',
      ai_recommendation_generated: false
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving todo:', error);
    throw error;
  }

  console.log(`✅ [SAVE_TASK] Task saved with ID: ${data.id}, assigned_to: ${assignedToId}`);

  // Si assigné, créer aussi la relation many-to-many
  if (assignedToId) {
    const { error: relationError } = await supabaseClient
      .from('todo_participants')
      .insert({
        todo_id: data.id,
        participant_id: assignedToId
      });
    
    if (relationError) {
      console.error('Error creating todo-participant relationship:', relationError);
    } else {
      console.log(`✅ [SAVE_TASK] Created todo-participant relationship`);
    }
  }

  return {
    id: data.id,
    description: task.description,
    assignedTo: task.assignedTo,
    assignedToId: assignedToId
  };
}
