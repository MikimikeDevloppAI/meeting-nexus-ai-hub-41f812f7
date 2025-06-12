import { SupabaseClient } from '@supabase/supabase-js';

export const createSupabaseClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL or key not found')
  }

  return new SupabaseClient(supabaseUrl, supabaseKey)
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

    // Assigner les participants si spécifiés
    if (task.assigned_to && Array.isArray(task.assigned_to) && task.assigned_to.length > 0) {
      console.log('👥 Assigning participants to task:', task.assigned_to)
      
      for (const participantInfo of task.assigned_to) {
        // Trouver le participant correspondant
        const participant = participants.find(p => 
          p.name.toLowerCase().includes(participantInfo.toLowerCase()) ||
          p.email.toLowerCase().includes(participantInfo.toLowerCase())
        )
        
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
            console.log('✅ Participant assigned:', participant.name)
          }
        } else {
          console.warn('⚠️ Participant not found:', participantInfo)
        }
      }
    }

    return savedTask
  } catch (error) {
    console.error('❌ Error in saveTask:', error)
    throw error
  }
}
