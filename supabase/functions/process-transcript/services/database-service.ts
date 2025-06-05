
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
  // Improve participant matching logic
  let assignedToId = null;
  if (task.assignedTo) {
    // Exact match first
    let assignedParticipant = participants.find((p: any) => 
      p.name.toLowerCase() === task.assignedTo.toLowerCase()
    );
    
    // Partial match if not found
    if (!assignedParticipant) {
      assignedParticipant = participants.find((p: any) => {
        const participantNameLower = p.name.toLowerCase();
        const assignedToLower = task.assignedTo.toLowerCase();
        
        return (participantNameLower.includes(assignedToLower) && assignedToLower.length >= 3) ||
               (assignedToLower.includes(participantNameLower) && participantNameLower.length >= 3);
      });
    }
    
    // Word-based match if still not found
    if (!assignedParticipant) {
      const assignedWords = task.assignedTo.toLowerCase().split(' ');
      assignedParticipant = participants.find((p: any) => {
        const participantWords = p.name.toLowerCase().split(' ');
        return assignedWords.some(word => 
          word.length >= 3 && participantWords.some(pWord => pWord.includes(word))
        );
      });
    }
    
    assignedToId = assignedParticipant?.id || null;
    
    if (assignedToId) {
      console.log(`✅ Assigned task "${task.description}" to ${assignedParticipant.name}`);
    } else {
      console.log(`⚠️ Could not match "${task.assignedTo}" to any participant for task: ${task.description}`);
    }
  }

  const { data, error } = await supabaseClient
    .from('todos')
    .insert({
      description: task.description,
      meeting_id: meetingId,
      assigned_to: assignedToId,
      status: 'pending'
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving todo:', error);
    throw error;
  }

  return {
    id: data.id,
    description: task.description,
    assignedTo: task.assignedTo,
    assignedToId: assignedToId
  };
}
