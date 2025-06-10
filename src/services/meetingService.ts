
import { supabase } from "@/integrations/supabase/client";

export const uploadAudio = async (audioBlob: Blob, meetingId: string) => {
  if (!audioBlob) {
    console.warn("No audio blob to upload.");
    return null;
  }

  try {
    const fileName = `recording_${meetingId}.wav`;
    const { data, error } = await supabase.storage
      .from("meeting-recordings")
      .upload(fileName, audioBlob, {
        contentType: "audio/wav",
        upsert: true,
      });

    if (error) {
      console.error("Error uploading audio:", error);
      return null;
    }

    const audioUrl = `https://ecziljpkvshvapjsxaty.supabase.co/storage/v1/object/public/meeting-recordings/${fileName}`;
    return audioUrl;
  } catch (error) {
    console.error("Error in uploadAudio:", error);
    return null;
  }
};

const findBestParticipantMatch = (taskText: string, allParticipants: any[]) => {
  if (!taskText || !allParticipants?.length) return null;

  const taskLower = taskText.toLowerCase();
  
  console.log(`[PARTICIPANT_MATCH] Searching for match in task: "${taskText}"`);
  console.log(`[PARTICIPANT_MATCH] Available participants:`, allParticipants.map(p => p.name));
  
  // Direct name matching (exact or partial)
  for (const participant of allParticipants) {
    const nameLower = participant.name.toLowerCase();
    const firstNameLower = nameLower.split(' ')[0];
    
    // Check for exact name match
    if (taskLower.includes(nameLower) || taskLower.includes(firstNameLower)) {
      console.log(`✅ [PARTICIPANT_MATCH] Found match: ${participant.name}`);
      return participant.id;
    }
  }

  // Role-based matching
  const roleKeywords = {
    'développeur': ['dev', 'développeur', 'developer', 'programmeur', 'code'],
    'designer': ['design', 'designer', 'ui', 'ux', 'graphique'],
    'manager': ['manager', 'gestionnaire', 'responsable', 'chef'],
    'marketing': ['marketing', 'communication', 'promo', 'publicité'],
    'commercial': ['commercial', 'vente', 'sales', 'client'],
  };

  for (const participant of allParticipants) {
    const nameLower = participant.name.toLowerCase();
    for (const [role, keywords] of Object.entries(roleKeywords)) {
      if (keywords.some(keyword => taskLower.includes(keyword))) {
        // If participant's name suggests they might have this role
        if (nameLower.includes(role) || participant.email?.toLowerCase().includes(role)) {
          console.log(`✅ [PARTICIPANT_MATCH] Found role-based match: ${participant.name} for role: ${role}`);
          return participant.id;
        }
      }
    }
  }

  console.log(`⚠️ [PARTICIPANT_MATCH] No match found for task`);
  return null;
};

const saveTasks = async (tasks: string[], meetingId: string, allParticipants: any[]) => {
  console.log('[SAVE_TASKS] Starting task save process:', { tasks, meetingId, participantCount: allParticipants.length });
  
  const savedTasks = [];
  
  for (const task of tasks) {
    try {
      // Find best participant match
      const assignedTo = findBestParticipantMatch(task, allParticipants);
      
      console.log('[SAVE_TASKS] Task assignment:', { task: task.substring(0, 50), assignedTo });

      // Save the todo
      const { data: todoData, error: todoError } = await supabase
        .from("todos")
        .insert({
          description: task.trim(),
          status: "pending",
          meeting_id: meetingId,
          assigned_to: assignedTo,
        })
        .select()
        .single();

      if (todoError) throw todoError;

      if (todoData) {
        savedTasks.push(todoData);
        
        // If we found a participant match, also create the many-to-many relationship
        if (assignedTo) {
          const { error: participantError } = await supabase
            .from("todo_participants")
            .insert({
              todo_id: todoData.id,
              participant_id: assignedTo
            });
          
          if (participantError) {
            console.error('Error creating todo-participant relationship:', participantError);
          } else {
            console.log(`✅ [SAVE_TASKS] Created todo-participant relationship for task ${todoData.id}`);
          }
        }

        // Generate AI recommendation using the unified agent
        try {
          const response = await fetch('/functions/v1/task-recommendation-agent', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjemlsanBrdnNodmFwanN4YXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MTg0ODIsImV4cCI6MjA2MjE5NDQ4Mn0.oRJVDFdTSmUS15nM7BKwsjed0F_S5HeRfviPIdQJkUk`,
            },
            body: JSON.stringify({
              task: { description: task.trim() },
              transcript: '',
              meetingContext: {
                title: `Meeting ID: ${meetingId}`,
                participants: allParticipants.map(p => p.name).join(', ')
              },
              participants: allParticipants
            }),
          });
          
          if (!response.ok) {
            console.error('AI recommendation request failed:', await response.text());
          } else {
            const result = await response.json();
            const rec = result?.recommendation;
            
            if (rec && (rec.hasRecommendation || rec.needsEmail)) {
              // Add comment if there's a recommendation
              if (rec.hasRecommendation && rec.recommendation) {
                await supabase
                  .from('todo_comments')
                  .insert({
                    todo_id: todoData.id,
                    user_id: '00000000-0000-0000-0000-000000000000',
                    comment: `💡 **Recommandation IA :** ${rec.recommendation}`
                  });
              }
              
              // Save recommendation data
              await supabase
                .from('todo_ai_recommendations')
                .insert({
                  todo_id: todoData.id,
                  recommendation_text: rec.recommendation || 'Voir email pré-rédigé',
                  email_draft: rec.needsEmail ? rec.emailDraft : null
                });
            }
            
            // Mark as processed
            await supabase
              .from('todos')
              .update({ ai_recommendation_generated: true })
              .eq('id', todoData.id);
          }
        } catch (error) {
          console.error('Error generating AI recommendation:', error);
          // Mark as processed even on error
          await supabase
            .from('todos')
            .update({ ai_recommendation_generated: true })
            .eq('id', todoData.id);
        }
      }
    } catch (error) {
      console.error('Error saving task:', task, error);
    }
  }

  console.log('[SAVE_TASKS] Tasks saved successfully:', savedTasks.length);
  return savedTasks;
};

// Create the MeetingService object
export const MeetingService = {
  createMeeting: async (title: string, userId: string): Promise<string> => {
    console.log('[MeetingService] Creating meeting with:', { title, userId });
    
    if (!title?.trim()) {
      throw new Error('Title is required');
    }
    
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      const { data, error } = await supabase
        .from('meetings')
        .insert({ 
          title: title.trim(), 
          created_by: userId 
        })
        .select()
        .single();

      if (error) {
        console.error('[MeetingService] Error creating meeting:', error);
        throw error;
      }

      if (!data || !data.id) {
        throw new Error('Meeting created but no ID returned');
      }

      console.log('[MeetingService] Meeting created successfully:', data.id);
      return data.id;
    } catch (error) {
      console.error('[MeetingService] Failed to create meeting:', error);
      throw error;
    }
  },

  updateMeetingField: async (meetingId: string, field: string, value: any) => {
    console.log('[MeetingService] Updating meeting field:', { meetingId, field, valueType: typeof value });
    
    if (!meetingId) {
      throw new Error('Meeting ID is required');
    }

    try {
      const { error } = await supabase
        .from('meetings')
        .update({ [field]: value })
        .eq('id', meetingId);

      if (error) {
        console.error('[MeetingService] Error updating meeting field:', error);
        throw error;
      }

      console.log('[MeetingService] Meeting field updated successfully');
    } catch (error) {
      console.error('[MeetingService] Failed to update meeting field:', error);
      throw error;
    }
  },

  addParticipants: async (meetingId: string, participantIds: string[]) => {
    console.log('[MeetingService] Adding participants to meeting:', { meetingId, participantIds });
    
    if (!meetingId) {
      throw new Error('Meeting ID is required');
    }
    
    if (!participantIds || participantIds.length === 0) {
      console.log('[MeetingService] No participants to add');
      return;
    }

    try {
      const meetingParticipants = participantIds.map(participantId => ({
        meeting_id: meetingId,
        participant_id: participantId
      }));

      const { error } = await supabase
        .from('meeting_participants')
        .insert(meetingParticipants);

      if (error) {
        console.error('[MeetingService] Error adding participants:', error);
        throw error;
      }

      console.log('[MeetingService] Participants added successfully');
    } catch (error) {
      console.error('[MeetingService] Failed to add participants:', error);
      throw error;
    }
  }
};

// Update the processMeetingData function to pass meeting participants correctly
export const processMeetingData = async (
  meetingId: string,
  participantIds: string[],
  audioBlob: Blob | null,
  audioFile: File | null
): Promise<void> => {
  console.log('[PROCESS_MEETING] Processing meeting data for meeting:', meetingId);

  try {
    // Récupérer les participants de la réunion (ceux qui sont vraiment dans la réunion)
    const { data: meetingParticipants, error: meetingParticipantsError } = await supabase
      .from("meeting_participants")
      .select(`
        participant_id,
        participants (
          id,
          name,
          email
        )
      `)
      .eq('meeting_id', meetingId);

    if (meetingParticipantsError) {
      console.error('[PROCESS_MEETING] Error fetching meeting participants:', meetingParticipantsError);
    }

    // Utiliser les participants de la réunion pour l'assignation
    const participantsForAssignment = meetingParticipants?.map((mp: any) => mp.participants).filter(Boolean) || [];
    console.log('[PROCESS_MEETING] Participants for assignment:', participantsForAssignment.map(p => ({ id: p.id, name: p.name })));

    // Upload audio file
    let audioUrl = null;
    if (audioBlob || audioFile) {
      const fileToUpload = audioFile || new File([audioBlob!], 'recording.wav', { type: 'audio/wav' });
      const fileName = `${meetingId}_${Date.now()}.${fileToUpload.name.split('.').pop()}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('meeting-recordings')
        .upload(fileName, fileToUpload);

      if (uploadError) {
        console.error('[PROCESS_MEETING] Error uploading audio:', uploadError);
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from('meeting-recordings')
        .getPublicUrl(fileName);

      audioUrl = urlData.publicUrl;
      console.log('[PROCESS_MEETING] Audio uploaded successfully:', audioUrl);
    }

    // Update meeting with audio URL
    const { error: updateError } = await supabase
      .from("meetings")
      .update({ audio_url: audioUrl })
      .eq("id", meetingId);

    if (updateError) {
      console.error('[PROCESS_MEETING] Error updating meeting with audio URL:', updateError);
      throw updateError;
    }

    // Process transcript and extract tasks with correct participants
    if (audioUrl) {
      console.log('[PROCESS_MEETING] Starting transcript processing...');
      
      const response = await fetch('/functions/v1/process-transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjemlsanBrdnNodmFwanN4YXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MTg0ODIsImV4cCI6MjA2MjE5NDQ4Mn0.oRJVDFdTSmUS15nM7BKwsjed0F_S5HeRfviPIdQJkUk`,
        },
        body: JSON.stringify({
          meetingId,
          audioUrl,
          participants: participantsForAssignment
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[PROCESS_MEETING] Transcript processing failed:', errorText);
        throw new Error(`Transcript processing failed: ${errorText}`);
      }

      const result = await response.json();
      console.log('[PROCESS_MEETING] Transcript processing completed:', result);
    }

  } catch (error) {
    console.error('[PROCESS_MEETING] Error in processMeetingData:', error);
    throw error;
  }
};

export { saveTasks };
