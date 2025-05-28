import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { meetingId, audioUrl, participants } = await req.json();
    
    console.log('Processing transcript for meeting:', meetingId);
    console.log('Audio URL:', audioUrl);
    console.log('Available participants:', participants?.length || 0);

    const assemblyAIApiKey = Deno.env.get('ASSEMBLYAI_API_KEY');
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!assemblyAIApiKey || !openAIApiKey) {
      throw new Error('Required API keys not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Submit audio for transcription
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'authorization': assemblyAIApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        speaker_labels: true,
      }),
    });

    const transcript = await transcriptResponse.json();
    
    if (!transcript.id) {
      throw new Error('Failed to submit audio for transcription');
    }

    // Poll for completion
    let transcriptData;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes maximum

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const statusResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcript.id}`, {
        headers: { 'authorization': assemblyAIApiKey },
      });
      
      transcriptData = await statusResponse.json();
      
      if (transcriptData.status === 'completed') {
        break;
      } else if (transcriptData.status === 'error') {
        throw new Error(`Transcription failed: ${transcriptData.error}`);
      }
      
      attempts++;
    }

    if (!transcriptData || transcriptData.status !== 'completed') {
      throw new Error('Transcription timed out');
    }

    console.log('Transcription completed, processing with OpenAI...');

    // Process transcript with OpenAI for summary and tasks
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an AI assistant that processes meeting transcripts. Your tasks:
1. Create a clear, structured summary of the meeting
2. Extract all action items and tasks mentioned
3. Format tasks as a simple list, one task per line

Available participants for assignment: ${participants?.map((p: any) => p.name).join(', ') || 'None'}

When extracting tasks, be comprehensive and include all actionable items discussed.`
          },
          {
            role: 'user',
            content: `Please process this meeting transcript and provide:

1. A structured summary of the meeting
2. A list of all tasks and action items (one per line, starting with "- ")

Transcript: ${transcriptData.text}`
          }
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    const openAIData = await openAIResponse.json();
    const processedContent = openAIData.choices[0].message.content;

    console.log('OpenAI processing completed');

    // Extract summary and tasks
    const lines = processedContent.split('\n');
    let summary = '';
    let tasks: string[] = [];
    let inTasksSection = false;

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.toLowerCase().includes('task') || trimmedLine.toLowerCase().includes('action')) {
        inTasksSection = true;
        continue;
      }
      
      if (inTasksSection && trimmedLine.startsWith('- ')) {
        tasks.push(trimmedLine.substring(2).trim());
      } else if (!inTasksSection && trimmedLine) {
        summary += trimmedLine + '\n';
      }
    }

    summary = summary.trim();

    console.log('Extracted summary length:', summary.length);
    console.log('Extracted tasks count:', tasks.length);

    // Save processed transcript and summary to database
    const { error: updateError } = await supabase
      .from('meetings')
      .update({
        transcript: processedContent, // Save the full processed content
        summary: summary || 'Résumé en cours de traitement...'
      })
      .eq('id', meetingId);

    if (updateError) {
      console.error('Error updating meeting:', updateError);
      throw updateError;
    }

    // Save tasks with improved participant assignment
    if (tasks.length > 0) {
      console.log('Saving tasks with participant assignment...');
      
      for (const task of tasks) {
        const assignedParticipantId = findBestParticipantMatch(task, participants || []);
        
        console.log('Task assignment:', { 
          task: task.substring(0, 50), 
          assignedTo: assignedParticipantId 
        });

        // Save the todo
        const { data: todoData, error: todoError } = await supabase
          .from('todos')
          .insert({
            description: task.trim(),
            status: 'pending',
            meeting_id: meetingId,
            assigned_to: assignedParticipantId, // Keep for backward compatibility
          })
          .select()
          .single();

        if (todoError) {
          console.error('Error saving task:', todoError);
          continue;
        }

        // Create many-to-many relationship if participant assigned
        if (assignedParticipantId && todoData) {
          const { error: participantError } = await supabase
            .from('todo_participants')
            .insert({
              todo_id: todoData.id,
              participant_id: assignedParticipantId
            });
          
          if (participantError) {
            console.error('Error creating todo-participant relationship:', participantError);
          }
        }

        // Generate AI recommendation in background
        if (todoData) {
          try {
            const aiResponse = await fetch(`${supabaseUrl}/functions/v1/todo-recommendations`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({
                todoId: todoData.id,
                description: task.trim(),
                meetingContext: `Meeting transcript processed`
              }),
            });
            
            if (!aiResponse.ok) {
              console.error('AI recommendation request failed');
            }
          } catch (error) {
            console.error('Error generating AI recommendation:', error);
          }
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      summary: summary,
      tasksCount: tasks.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in process-transcript function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper function for participant matching
function findBestParticipantMatch(taskText: string, allParticipants: any[]): string | null {
  if (!taskText || !allParticipants?.length) return null;

  const taskLower = taskText.toLowerCase();
  
  // Direct name matching
  for (const participant of allParticipants) {
    const nameLower = participant.name.toLowerCase();
    const firstNameLower = nameLower.split(' ')[0];
    
    if (taskLower.includes(nameLower) || taskLower.includes(firstNameLower)) {
      return participant.id;
    }
  }

  // Role-based matching
  const roleKeywords = {
    'développeur': ['dev', 'développeur', 'developer', 'programmeur', 'code', 'technique'],
    'designer': ['design', 'designer', 'ui', 'ux', 'graphique', 'visuel'],
    'manager': ['manager', 'gestionnaire', 'responsable', 'chef', 'coordonner'],
    'marketing': ['marketing', 'communication', 'promo', 'publicité', 'social'],
    'commercial': ['commercial', 'vente', 'sales', 'client', 'prospect'],
  };

  for (const participant of allParticipants) {
    const nameLower = participant.name.toLowerCase();
    const emailLower = participant.email?.toLowerCase() || '';
    
    for (const [role, keywords] of Object.entries(roleKeywords)) {
      if (keywords.some(keyword => taskLower.includes(keyword))) {
        if (nameLower.includes(role) || emailLower.includes(role)) {
          return participant.id;
        }
      }
    }
  }

  return null;
}
