
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
    console.log('Provided transcript length:', providedTranscript?.length || 0);
    console.log('Available participants:', participants?.length || 0);
    
    if (participants) {
      console.log('Participant names:', participants.map(p => p.name));
    }

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
    const participantList = participants && participants.length > 0 
      ? participants.map((p: any, index: number) => 
          `${p.name}${p.email ? ` (${p.email})` : ''}`
        ).join(', ')
      : 'Aucun participant spécifié';

    console.log('Participant list for OpenAI:', participantList);

    // Enhanced system prompt that worked before
    const systemPrompt = `Tu es un assistant IA spécialisé dans le traitement de transcripts de réunions. 

PARTICIPANTS DE LA RÉUNION:
${participantList}

Tu dois analyser le transcript et retourner un objet JSON avec cette structure exacte:
{
  "cleanedTranscript": "transcript nettoyé",
  "summary": "résumé complet en français",
  "tasks": ["tâche 1", "tâche 2", "tâche 3"]
}

INSTRUCTIONS POUR cleanedTranscript:
1. Corrige toutes les erreurs de français (grammaire, orthographe, conjugaison)
2. Supprime les mots de remplissage inutiles (euh, hum, ben, etc.)
3. Remplace les références génériques (Speaker A, Speaker B, Speaker 1, Speaker 2, etc.) par les vrais noms des participants listés ci-dessus
4. Utilise le contexte de la conversation pour déterminer qui parle
5. Améliore la fluidité du texte tout en gardant le sens original
6. Formate avec des paragraphes clairs, un nom par ligne de dialogue

INSTRUCTIONS POUR summary:
1. Écris un résumé complet en français (3-4 paragraphes)
2. Organise par thèmes: "Points techniques:", "Décisions prises:", "Prochaines étapes:", etc.
3. Utilise les vrais noms des participants
4. Mentionne les points clés et les décisions importantes

INSTRUCTIONS POUR tasks:
1. Extrais toutes les tâches et actions mentionnées
2. Inclus le nom de la personne responsable quand c'est mentionné
3. Formule chaque tâche de manière claire et actionnable
4. Maximum 10 tâches les plus importantes

Tu DOIS retourner UNIQUEMENT l'objet JSON, sans autre texte.`;

    console.log('Sending request to OpenAI with enhanced prompt...');

    // Process transcript with OpenAI
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
            content: `Traite ce transcript de réunion:\n\n${transcriptToProcess}`
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

    console.log('OpenAI raw response length:', processedContent?.length || 0);
    console.log('OpenAI response preview:', processedContent?.substring(0, 200) + '...');

    // Clean and parse the JSON response
    processedContent = processedContent.trim();
    
    // Remove markdown code blocks if present
    if (processedContent.startsWith('```json')) {
      processedContent = processedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (processedContent.startsWith('```')) {
      processedContent = processedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    // Extract JSON object
    const jsonStart = processedContent.indexOf('{');
    const jsonEnd = processedContent.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      processedContent = processedContent.substring(jsonStart, jsonEnd + 1);
    }

    console.log('Cleaned JSON for parsing:', processedContent?.substring(0, 200) + '...');

    // Parse the response with robust error handling
    let cleanedTranscript = transcriptToProcess;
    let summary = '';
    let tasks: string[] = [];

    try {
      const parsed = JSON.parse(processedContent);
      console.log('Successfully parsed OpenAI response');
      
      cleanedTranscript = parsed.cleanedTranscript || transcriptToProcess;
      summary = parsed.summary || 'Résumé généré automatiquement.';
      tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
      
      console.log('Parsed results:');
      console.log('- Cleaned transcript length:', cleanedTranscript.length);
      console.log('- Summary length:', summary.length);
      console.log('- Tasks count:', tasks.length);
      
    } catch (parseError) {
      console.error('JSON parsing failed:', parseError);
      console.error('Failed content:', processedContent);
      
      // Fallback: manually replace speaker labels if we have participants
      if (participants && participants.length > 0) {
        cleanedTranscript = transcriptToProcess;
        
        // Replace Speaker A, B, C, etc. and Speaker 1, 2, 3, etc.
        participants.forEach((participant: any, index: number) => {
          const speakerLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
          const speakerLetter = speakerLetters[index];
          const speakerNumber = index + 1;
          
          if (speakerLetter) {
            const regexLetter = new RegExp(`Speaker ${speakerLetter}\\b`, 'g');
            cleanedTranscript = cleanedTranscript.replace(regexLetter, participant.name);
          }
          
          const regexNumber = new RegExp(`Speaker ${speakerNumber}\\b`, 'g');
          cleanedTranscript = cleanedTranscript.replace(regexNumber, participant.name);
        });
        
        console.log('Applied manual speaker replacement as fallback');
      }
      
      summary = 'Résumé automatique - traitement OpenAI partiel, mais transcript nettoyé.';
      tasks = [];
    }

    // Save the processed results to database
    console.log('Saving cleaned transcript and summary to database...');
    
    const { error: updateError } = await supabase
      .from('meetings')
      .update({
        transcript: cleanedTranscript,
        summary: summary
      })
      .eq('id', meetingId);

    if (updateError) {
      console.error('Error updating meeting:', updateError);
      throw updateError;
    }

    console.log('Meeting updated successfully');

    // Save tasks if any were extracted
    if (tasks.length > 0) {
      console.log('Saving', tasks.length, 'tasks...');
      
      for (const task of tasks) {
        const assignedParticipantId = findBestParticipantMatch(task, participants || []);
        
        console.log('Saving task:', { 
          task: task.substring(0, 50) + (task.length > 50 ? '...' : ''), 
          assignedTo: assignedParticipantId ? participants.find(p => p.id === assignedParticipantId)?.name : 'None'
        });

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
      processedTranscript: cleanedTranscript,
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

// Helper function for participant matching (kept same as before)
function findBestParticipantMatch(taskText: string, allParticipants: any[]): string | null {
  if (!taskText || !allParticipants?.length) {
    return null;
  }

  const taskLower = taskText.toLowerCase();
  
  // Direct name matching
  for (const participant of allParticipants) {
    const nameLower = participant.name.toLowerCase();
    const nameParts = nameLower.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts[nameParts.length - 1];
    
    if (taskLower.includes(nameLower) || 
        taskLower.includes(firstName) || 
        (lastName.length > 2 && taskLower.includes(lastName))) {
      return participant.id;
    }
  }

  // Role-based matching
  const roleKeywords = {
    'développeur': ['dev', 'développeur', 'developer', 'programmeur', 'code', 'technique'],
    'designer': ['design', 'designer', 'ui', 'ux', 'graphique'],
    'manager': ['manager', 'gestionnaire', 'responsable', 'chef'],
    'marketing': ['marketing', 'communication', 'promo'],
    'commercial': ['commercial', 'vente', 'client'],
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

  return allParticipants.length > 0 ? allParticipants[0].id : null;
}
