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

    // Prepare participant information for the prompt
    const participantInfo = participants && participants.length > 0 
      ? participants.map((p: any, index: number) => 
          `Participant ${index + 1}: ${p.name}${p.email ? ` (${p.email})` : ''}`
        ).join('\n')
      : 'No participant information available';

    const participantCount = participants?.length || 2;

    // Simplified and more reliable system prompt
    const systemPrompt = `You are an AI assistant that processes meeting transcripts. You MUST respond with ONLY valid JSON, no other text or formatting.

PARTICIPANTS:
${participantInfo}

Respond with this EXACT JSON structure:
{
  "cleanedTranscript": "transcript with Speaker 1, Speaker 2, etc. replaced by actual participant names",
  "summary": "comprehensive French summary organized by topics",
  "tasks": ["task 1", "task 2", "task 3"]
}

CRITICAL INSTRUCTIONS:
1. For cleanedTranscript: Replace "Speaker 1" with "${participants?.[0]?.name || 'Participant 1'}", "Speaker 2" with "${participants?.[1]?.name || 'Participant 2'}", etc. Use conversation context to map speakers correctly.
2. For summary: Write 3-4 paragraphs in French, organize by topics like "Points techniques:", "Décisions prises:", etc.
3. For tasks: Extract actionable items with participant names when mentioned.

You must return ONLY the JSON object, nothing else.`;

    console.log('Sending request to OpenAI...');

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
            content: `Process this transcript and replace speaker labels with participant names:\n\n${transcriptToProcess}`
          }
        ],
        max_tokens: 4000,
        temperature: 0.1,
      }),
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('OpenAI API error response:', errorText);
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const openAIData = await openAIResponse.json();
    let processedContent = openAIData.choices[0].message.content;

    console.log('OpenAI raw response:', processedContent?.substring(0, 200) + '...');

    // Clean the response to ensure it's valid JSON
    processedContent = processedContent.trim();
    
    // Remove any markdown code blocks if present
    if (processedContent.startsWith('```json')) {
      processedContent = processedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (processedContent.startsWith('```')) {
      processedContent = processedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    // Find the JSON object
    const jsonStart = processedContent.indexOf('{');
    const jsonEnd = processedContent.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      processedContent = processedContent.substring(jsonStart, jsonEnd + 1);
    }

    console.log('Cleaned response for parsing:', processedContent?.substring(0, 200) + '...');

    // Parse the JSON response with fallback
    let cleanedTranscript = transcriptToProcess;
    let summary = '';
    let tasks: string[] = [];

    try {
      const parsed = JSON.parse(processedContent);
      cleanedTranscript = parsed.cleanedTranscript || transcriptToProcess;
      summary = parsed.summary || 'Résumé automatique généré avec succès.';
      tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
      
      console.log('Successfully parsed JSON - Tasks count:', tasks.length);
    } catch (parseError) {
      console.error('JSON parsing failed:', parseError);
      console.error('Failed content:', processedContent);
      
      // Fallback: Try to manually replace speaker labels
      cleanedTranscript = transcriptToProcess;
      if (participants && participants.length > 0) {
        participants.forEach((participant: any, index: number) => {
          const speakerLabel = `Speaker ${index + 1}`;
          const regex = new RegExp(speakerLabel, 'g');
          cleanedTranscript = cleanedTranscript.replace(regex, participant.name);
        });
        console.log('Applied manual speaker replacement as fallback');
      }
      
      summary = 'Résumé automatique - erreur de traitement JSON, mais transcript nettoyé avec succès.';
      tasks = [];
    }

    // Save the cleaned transcript and summary to database
    const { error: updateError } = await supabase
      .from('meetings')
      .update({
        transcript: cleanedTranscript, // Use the cleaned version
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
