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
  
  // Direct name matching (exact or partial)
  for (const participant of allParticipants) {
    const nameLower = participant.name.toLowerCase();
    const firstNameLower = nameLower.split(' ')[0];
    
    // Check for exact name match
    if (taskLower.includes(nameLower) || taskLower.includes(firstNameLower)) {
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
          return participant.id;
        }
      }
    }
  }

  return null;
};

const saveTasks = async (tasks: string[], meetingId: string, allParticipants: any[]) => {
  console.log('Saving tasks with participants:', { tasks, meetingId, participantCount: allParticipants.length });
  
  const savedTasks = [];
  
  for (const task of tasks) {
    try {
      // Find best participant match
      const assignedTo = findBestParticipantMatch(task, allParticipants);
      
      console.log('Task assignment:', { task: task.substring(0, 50), assignedTo });

      // Save the todo (even if no participant is assigned)
      const { data: todoData, error: todoError } = await supabase
        .from("todos")
        .insert({
          description: task.trim(),
          status: "pending",
          meeting_id: meetingId,
          assigned_to: assignedTo, // This might be null, which is fine
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
          }
        }

        // Generate AI recommendation in the background
        try {
          const response = await fetch('/functions/v1/todo-recommendations', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabase.supabaseKey}`,
            },
            body: JSON.stringify({
              todoId: todoData.id,
              description: task.trim(),
              meetingContext: `Meeting ID: ${meetingId}`
            }),
          });
          
          if (!response.ok) {
            console.error('AI recommendation request failed:', await response.text());
          }
        } catch (error) {
          console.error('Error generating AI recommendation:', error);
        }
      }
    } catch (error) {
      console.error('Error saving task:', task, error);
    }
  }

  console.log('Tasks saved successfully:', savedTasks.length);
  return savedTasks;
};

// Update the processMeetingData function to fetch all participants
export const processMeetingData = async (
  meetingId: string,
  participantIds: string[],
  audioBlob: Blob | null,
  audioFile: File | null
): Promise<void> => {
  console.log('Processing meeting data for meeting:', meetingId);

  try {
    // Fetch ALL participants from the database for better assignment
    const { data: allParticipants, error: participantsError } = await supabase
      .from("participants")
      .select("id, name, email");

    if (participantsError) {
      console.error('Error fetching all participants:', participantsError);
    }

    // Use all participants for task assignment, fallback to meeting participants if needed
    const participantsForAssignment = allParticipants && allParticipants.length > 0 
      ? allParticipants 
      : [];

    // Upload audio file
    let audioUrl = null;
    if (audioBlob || audioFile) {
      const fileToUpload = audioFile || new File([audioBlob!], 'recording.wav', { type: 'audio/wav' });
      const fileName = `${meetingId}_${Date.now()}.${fileToUpload.name.split('.').pop()}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('meeting-recordings')
        .upload(fileName, fileToUpload);

      if (uploadError) {
        console.error('Error uploading audio:', uploadError);
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from('meeting-recordings')
        .getPublicUrl(fileName);

      audioUrl = urlData.publicUrl;
      console.log('Audio uploaded successfully:', audioUrl);
    }

    // Update meeting with audio URL
    const { error: updateError } = await supabase
      .from("meetings")
      .update({ audio_url: audioUrl })
      .eq("id", meetingId);

    if (updateError) {
      console.error('Error updating meeting with audio URL:', updateError);
      throw updateError;
    }

    // Process transcript and extract tasks
    if (audioUrl) {
      console.log('Starting transcript processing...');
      
      const response = await fetch('/functions/v1/process-transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabase.supabaseKey}`,
        },
        body: JSON.stringify({
          meetingId,
          audioUrl,
          participants: participantsForAssignment
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Transcript processing failed:', errorText);
        throw new Error(`Transcript processing failed: ${errorText}`);
      }

      const result = await response.json();
      console.log('Transcript processing completed:', result);
    }

  } catch (error) {
    console.error('Error in processMeetingData:', error);
    throw error;
  }
};

export { saveTasks };
