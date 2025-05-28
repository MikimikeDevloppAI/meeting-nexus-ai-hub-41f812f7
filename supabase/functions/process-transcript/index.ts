
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

    // Enhanced system prompt for better summary and task extraction
    const systemPrompt = `You are an AI assistant that processes meeting transcripts. You MUST respond with valid JSON only, no other text.

Your response must be EXACTLY in this format:
{
  "cleanedTranscript": "improved and cleaned version of the transcript with better formatting and speaker identification",
  "summary": "comprehensive meeting summary organized by topics",
  "tasks": ["actionable task 1", "actionable task 2", "actionable task 3"]
}

For the cleanedTranscript:
- Clean up the raw transcript text
- Fix any transcription errors you can identify
- Improve speaker identification and formatting
- Make it more readable while preserving all content
- Keep all the original information but present it clearly

For the summary:
- Write a comprehensive summary in French (3-4 paragraphs minimum)
- Organize by main topics discussed (e.g., "Points techniques:", "Décisions prises:", "Sujets administratifs:", etc.)
- Include all important points, decisions, and discussions
- Don't miss any significant topics or decisions
- Be detailed and thorough

For tasks:
- Extract ALL actionable items, decisions, follow-ups, and commitments mentioned
- Include WHO should do WHAT when clearly mentioned
- Each task should be a complete, actionable sentence in French
- Include deadlines or timeframes when mentioned
- Be specific about what needs to be done
- Available participants for potential assignment: ${participants?.map((p: any) => p.name).join(', ') || 'None'}

CRITICAL: Your response must be valid JSON only, starting with { and ending with }`;

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
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Process this meeting transcript:

${transcriptToProcess}`
          }
        ],
        max_tokens: 3000,
        temperature: 0.2,
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
    let cleanedTranscript = transcriptToProcess;
    let summary = '';
    let tasks: string[] = [];

    try {
      const parsed = JSON.parse(cleanedContent);
      cleanedTranscript = parsed.cleanedTranscript || transcriptToProcess;
      summary = parsed.summary || 'Résumé en cours de traitement...';
      tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
      
      console.log('Successfully parsed JSON - Cleaned transcript length:', cleanedTranscript.length, 'Summary length:', summary.length, 'Tasks count:', tasks.length);
    } catch (parseError) {
      console.error('JSON parsing failed:', parseError);
      console.log('Failed content:', cleanedContent);
      
      // Use original transcript if parsing fails
      cleanedTranscript = transcriptToProcess;
      summary = 'Résumé automatique non disponible - erreur de traitement.';
      tasks = [];
    }

    // Save the cleaned transcript and summary to database
    const { error: updateError } = await supabase
      .from('meetings')
      .update({
        transcript: cleanedTranscript, // Use the cleaned version from OpenAI
        summary: summary
      })
      .eq('id', meetingId);

    if (updateError) {
      console.error('Error updating meeting:', updateError);
      throw updateError;
    }

    console.log('Meeting updated successfully with cleaned transcript');

    // Save tasks with improved participant assignment
    if (tasks.length > 0) {
      console.log('Saving', tasks.length, 'tasks...');
      
      for (const task of tasks) {
        const assignedParticipantId = findBestParticipantMatch(task, participants || []);
        
        console.log('Saving task:', { 
          task: task.substring(0, 50) + (task.length > 50 ? '...' : ''), 
          assignedTo: assignedParticipantId ? participants.find(p => p.id === assignedParticipantId)?.name : 'None'
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
          } else {
            console.log('Successfully assigned task to participant');
          }
        }
      }
    }

    console.log('Processing completed successfully');

    return new Response(JSON.stringify({ 
      success: true, 
      processedTranscript: cleanedTranscript, // Return the cleaned version
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

// Improved helper function for participant matching
function findBestParticipantMatch(taskText: string, allParticipants: any[]): string | null {
  if (!taskText || !allParticipants?.length) {
    console.log('No task text or participants available for matching');
    return null;
  }

  const taskLower = taskText.toLowerCase();
  console.log('Matching task:', taskText.substring(0, 100));
  console.log('Available participants:', allParticipants.map(p => p.name));
  
  // Direct name matching - check for exact names first
  for (const participant of allParticipants) {
    const nameLower = participant.name.toLowerCase();
    const nameParts = nameLower.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts[nameParts.length - 1];
    
    // Check for full name, first name, or last name
    if (taskLower.includes(nameLower) || 
        taskLower.includes(firstName) || 
        (lastName.length > 2 && taskLower.includes(lastName))) {
      console.log('Direct name match found:', participant.name);
      return participant.id;
    }
  }

  // Enhanced role-based matching with more keywords
  const roleKeywords = {
    'développeur': ['dev', 'développeur', 'developer', 'programmeur', 'code', 'technique', 'site', 'application', 'bug', 'correction'],
    'designer': ['design', 'designer', 'ui', 'ux', 'graphique', 'visuel', 'interface', 'maquette'],
    'manager': ['manager', 'gestionnaire', 'responsable', 'chef', 'coordonner', 'organiser', 'planifier'],
    'marketing': ['marketing', 'communication', 'promo', 'publicité', 'social', 'contenu', 'campagne'],
    'commercial': ['commercial', 'vente', 'sales', 'client', 'prospect', 'devis', 'contact'],
    'administratif': ['administratif', 'admin', 'bureau', 'paperasse', 'document', 'formulaire', 'rdv', 'rendez-vous']
  };

  // Look for role-based assignments
  for (const participant of allParticipants) {
    const nameLower = participant.name.toLowerCase();
    const emailLower = participant.email?.toLowerCase() || '';
    
    for (const [role, keywords] of Object.entries(roleKeywords)) {
      if (keywords.some(keyword => taskLower.includes(keyword))) {
        // Check if participant profile suggests this role
        if (nameLower.includes(role) || 
            emailLower.includes(role) ||
            emailLower.includes('dev') && role === 'développeur' ||
            emailLower.includes('admin') && role === 'administratif') {
          console.log('Role-based match found:', participant.name, 'for role:', role);
          return participant.id;
        }
      }
    }
  }

  // If no specific match, try to assign to first participant for non-generic tasks
  const genericWords = ['tous', 'équipe', 'chacun', 'ensemble'];
  const isGenericTask = genericWords.some(word => taskLower.includes(word));
  
  if (!isGenericTask && allParticipants.length > 0) {
    console.log('No specific match, assigning to first participant:', allParticipants[0].name);
    return allParticipants[0].id;
  }

  console.log('No participant match found for task');
  return null;
}
