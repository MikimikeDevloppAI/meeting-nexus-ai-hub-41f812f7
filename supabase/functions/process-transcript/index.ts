
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
    const { meetingId, audioUrl, participants, transcript: providedTranscript } = await req.json();
    
    console.log('Processing transcript for meeting:', meetingId);
    console.log('Audio URL:', audioUrl);
    console.log('Provided transcript length:', providedTranscript?.length || 0);
    console.log('Available participants:', participants?.length || 0);

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openAIApiKey) {
      console.error('OpenAI API key not configured');
      // If no OpenAI key, just return the provided transcript without processing
      return new Response(JSON.stringify({ 
        success: true, 
        processedTranscript: providedTranscript || '',
        summary: 'Résumé non disponible - clé API OpenAI manquante',
        tasks: [],
        message: 'OpenAI processing skipped - API key not configured'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let transcriptToProcess = providedTranscript;

    // If no transcript provided but we have audio URL, try to get transcript from AssemblyAI
    if (!transcriptToProcess && audioUrl) {
      const assemblyAIApiKey = Deno.env.get('ASSEMBLYAI_API_KEY');
      
      if (assemblyAIApiKey) {
        console.log('No transcript provided, attempting AssemblyAI transcription...');
        
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
        
        if (transcript.id) {
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
              transcriptToProcess = transcriptData.text;
              console.log('AssemblyAI transcription completed, length:', transcriptToProcess?.length || 0);
              break;
            } else if (transcriptData.status === 'error') {
              console.error('AssemblyAI transcription failed:', transcriptData.error);
              break;
            }
            
            attempts++;
          }
        }
      }
    }

    if (!transcriptToProcess) {
      throw new Error('No transcript available for processing');
    }

    console.log('Processing transcript with OpenAI, length:', transcriptToProcess.length);

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
            content: `You are an AI assistant that processes meeting transcripts. You MUST respond with valid JSON only, no other text.

Your response must be EXACTLY in this format:
{
  "summary": "detailed meeting summary in French",
  "tasks": ["task 1 in French", "task 2 in French", "task 3 in French"]
}

Rules:
- summary: Write a comprehensive summary of the meeting in French (2-3 paragraphs)
- tasks: Extract ALL actionable items, decisions, and follow-ups mentioned in the meeting
- Each task should be a complete, actionable sentence in French
- If no tasks are found, return an empty array for tasks
- Available participants for assignment: ${participants?.map((p: any) => p.name).join(', ') || 'None'}
- CRITICAL: Your response must be valid JSON only, starting with { and ending with }`
          },
          {
            role: 'user',
            content: `Process this meeting transcript and extract summary and tasks:

${transcriptToProcess}`
          }
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('OpenAI API error response:', errorText);
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const openAIData = await openAIResponse.json();
    const processedContent = openAIData.choices[0].message.content;

    console.log('OpenAI raw response:', processedContent);

    // Clean the response to ensure it's valid JSON
    let cleanedContent = processedContent.trim();
    
    // Remove any markdown code blocks if present
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    // Ensure it starts with { and ends with }
    if (!cleanedContent.startsWith('{')) {
      const jsonStart = cleanedContent.indexOf('{');
      if (jsonStart !== -1) {
        cleanedContent = cleanedContent.substring(jsonStart);
      }
    }
    
    if (!cleanedContent.endsWith('}')) {
      const jsonEnd = cleanedContent.lastIndexOf('}');
      if (jsonEnd !== -1) {
        cleanedContent = cleanedContent.substring(0, jsonEnd + 1);
      }
    }

    console.log('Cleaned OpenAI response:', cleanedContent);

    // Parse the JSON response
    let summary = '';
    let tasks: string[] = [];

    try {
      const parsed = JSON.parse(cleanedContent);
      summary = parsed.summary || 'Résumé en cours de traitement...';
      tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
      
      console.log('Successfully parsed JSON - Summary length:', summary.length, 'Tasks count:', tasks.length);
    } catch (parseError) {
      console.error('JSON parsing failed:', parseError);
      console.log('Failed content:', cleanedContent);
      
      // Fallback: try to extract summary and tasks manually
      console.log('Attempting manual extraction...');
      
      const lines = processedContent.split('\n').map(line => line.trim()).filter(line => line);
      let currentSection = '';
      
      for (const line of lines) {
        const lowerLine = line.toLowerCase();
        
        // Look for summary indicators
        if (lowerLine.includes('summary') || lowerLine.includes('résumé') || lowerLine.includes('sommaire')) {
          currentSection = 'summary';
          continue;
        }
        
        // Look for tasks indicators
        if (lowerLine.includes('task') || lowerLine.includes('tâche') || lowerLine.includes('action') || 
            lowerLine.includes('todo') || lowerLine.includes('à faire')) {
          currentSection = 'tasks';
          continue;
        }
        
        // Extract content based on current section
        if (currentSection === 'summary' && line && !line.startsWith('-') && !line.startsWith('•')) {
          summary += line + ' ';
        } else if (currentSection === 'tasks' && (line.startsWith('-') || line.startsWith('•') || line.match(/^\d+\./))) {
          const taskText = line.replace(/^[-•\d\.]\s*/, '').trim();
          if (taskText) {
            tasks.push(taskText);
          }
        }
      }
      
      summary = summary.trim() || 'Résumé automatique non disponible.';
      console.log('Manual extraction completed - Summary length:', summary.length, 'Tasks count:', tasks.length);
    }

    // Save processed transcript and summary to database
    const { error: updateError } = await supabase
      .from('meetings')
      .update({
        transcript: transcriptToProcess,
        summary: summary
      })
      .eq('id', meetingId);

    if (updateError) {
      console.error('Error updating meeting:', updateError);
      throw updateError;
    }

    console.log('Meeting updated successfully');

    // Save tasks with participant assignment
    if (tasks.length > 0) {
      console.log('Saving', tasks.length, 'tasks...');
      
      for (const task of tasks) {
        const assignedParticipantId = findBestParticipantMatch(task, participants || []);
        
        console.log('Saving task:', { 
          task: task.substring(0, 50) + (task.length > 50 ? '...' : ''), 
          assignedTo: assignedParticipantId 
        });

        // Save the todo
        const { data: todoData, error: todoError } = await supabase
          .from('todos')
          .insert({
            description: task.trim(),
            status: 'pending',
            meeting_id: meetingId,
            assigned_to: assignedParticipantId,
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
      }
    }

    console.log('Processing completed successfully');

    return new Response(JSON.stringify({ 
      success: true, 
      processedTranscript: transcriptToProcess,
      summary: summary,
      tasks: tasks,
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
