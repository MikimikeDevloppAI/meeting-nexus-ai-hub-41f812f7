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
    .select('title, created_at')
    .eq('id', meetingId)
    .single()

  if (error) {
    console.error('Error fetching meeting data:', error)
    throw error
  }

  return data
}

export const saveTask = async (supabaseClient: any, task: any, meetingId: string, participants: any[]) => {
  console.log('💾 Saving task:', task.description?.substring(0, 50) + '...')
  
  try {
    // Créer la tâche avec le statut "confirmed" (en cours) au lieu de "pending"
    const { data: savedTask, error } = await supabaseClient
      .from('todos')
      .insert([{
        meeting_id: meetingId,
        description: task.description,
        status: 'confirmed', // Changé de 'pending' à 'confirmed'
        due_date: task.due_date || null,
      }])
      .select()
      .single()

    if (error) {
      console.error('❌ Error saving task:', error)
      throw error
    }

    console.log('✅ Task saved with ID:', savedTask.id)

    // Assigner les participants si spécifiés - logique améliorée
    if (task.assigned_to && Array.isArray(task.assigned_to) && task.assigned_to.length > 0) {
      console.log('👥 Assigning participants to task:', task.assigned_to)
      
      for (const participantInfo of task.assigned_to) {
        // Nettoyer le nom du participant
        const cleanParticipantName = participantInfo.toString().toLowerCase().trim();
        
        // Trouver le participant correspondant avec logique plus flexible
        const participant = participants.find(p => {
          const name = p.name?.toLowerCase() || '';
          const email = p.email?.toLowerCase() || '';
          
          // Recherche exacte d'abord
          if (name === cleanParticipantName || email === cleanParticipantName) {
            return true;
          }
          
          // Recherche partielle ensuite
          if (name.includes(cleanParticipantName) || cleanParticipantName.includes(name)) {
            return true;
          }
          
          // Recherche par prénom (premier mot)
          const firstName = name.split(' ')[0];
          if (firstName && (firstName === cleanParticipantName || cleanParticipantName.includes(firstName))) {
            return true;
          }
          
          return false;
        });
        
        if (participant) {
          const { error: assignError } = await supabaseClient
            .from('todo_participants')
            .insert([{
              todo_id: savedTask.id,
              participant_id: participant.id
            }])
          
          if (assignError) {
            console.error('❌ Error assigning participant:', assignError)
          } else {
            console.log('✅ Participant assigned:', participant.name, 'to task:', savedTask.id)
          }
        } else {
          console.warn('⚠️ Participant not found for assignment:', participantInfo)
          console.log('Available participants:', participants.map(p => ({ id: p.id, name: p.name, email: p.email })))
        }
      }
    } else {
      console.log('ℹ️ No participants to assign for this task')
    }

    return savedTask
  } catch (error) {
    console.error('❌ Error in saveTask:', error)
    throw error
  }
}
