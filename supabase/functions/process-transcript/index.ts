
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

    // Step 1: Clean the transcript
    const cleanPrompt = `Tu es un assistant IA spécialisé dans le nettoyage de transcripts de réunions. 

PARTICIPANTS DE LA RÉUNION:
${participantList}

Tu dois nettoyer le transcript et retourner UNIQUEMENT le transcript nettoyé, sans autre texte.

INSTRUCTIONS:
1. Corrige toutes les erreurs de français (grammaire, orthographe, conjugaison)
2. Supprime les mots de remplissage inutiles (euh, hum, ben, etc.)
3. Remplace les références génériques (Speaker A, Speaker B, Speaker 1, Speaker 2, etc.) par les vrais noms des participants listés ci-dessus
4. Utilise le contexte de la conversation pour déterminer qui parle
5. Améliore la fluidité du texte tout en gardant le sens original
6. Formate avec des paragraphes clairs, un nom par ligne de dialogue

Transcript à nettoyer:
${transcriptToProcess}`;

    console.log('Sending transcript cleaning request to OpenAI...');

    // Clean transcript with OpenAI
    const cleanResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: 'Tu es un assistant spécialisé dans le nettoyage de transcripts. Tu retournes UNIQUEMENT le transcript nettoyé.'
          },
          {
            role: 'user',
            content: cleanPrompt
          }
        ],
        max_tokens: 4000,
        temperature: 0.1,
      }),
    });

    if (!cleanResponse.ok) {
      const errorText = await cleanResponse.text();
      console.error('OpenAI transcript cleaning error:', errorText);
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const cleanData = await cleanResponse.json();
    let cleanedTranscript = cleanData.choices[0].message.content.trim();

    console.log('Transcript cleaning completed, length:', cleanedTranscript.length);

    // Step 2: Generate summary using cleaned transcript
    const summaryPrompt = `Tu es un assistant IA spécialisé dans la création de résumés de réunions pour cabinet médical.

Voici le transcript nettoyé d'une réunion de cabinet médical avec les participants: ${participantList}

Crée un résumé détaillé et complet en français qui N'OMET AUCUN POINT IMPORTANT et organise les informations par catégories suivantes:

## GESTION DES PATIENTS
- Nouveaux patients
- Cas complexes
- Suivis particuliers
- Problématiques médicales discutées

## ORGANISATION DU CABINET
- Planning et rendez-vous
- Gestion administrative
- Équipements et matériel
- Procédures

## DÉCISIONS PRISES
- Décisions médicales
- Décisions administratives
- Nouvelles protocoles

## FORMATION ET DÉVELOPPEMENT
- Formations prévues
- Nouvelles compétences
- Mise à jour des connaissances

## ACTIONS À SUIVRE
- Prochaines étapes importantes
- Échéances à respecter

Assure-toi de couvrir TOUS les points mentionnés dans la réunion, même les détails qui peuvent sembler mineurs. Utilise les vrais noms des participants.

Retourne UNIQUEMENT le résumé organisé par catégories, sans autre texte.

Transcript:
${cleanedTranscript}`;

    console.log('Generating summary with OpenAI...');

    const summaryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: 'Tu es un assistant spécialisé dans la création de résumés de réunions pour cabinet médical. Tu retournes UNIQUEMENT le résumé organisé par catégories.'
          },
          {
            role: 'user',
            content: summaryPrompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.1,
      }),
    });

    let summary = 'Résumé automatique généré.';
    if (summaryResponse.ok) {
      const summaryData = await summaryResponse.json();
      summary = summaryData.choices[0].message.content.trim();
      console.log('Summary generated successfully, length:', summary.length);
    } else {
      console.error('Summary generation failed');
    }

    // Step 3: Extract tasks using cleaned transcript
    const tasksPrompt = `Tu es un assistant IA spécialisé dans l'extraction de tâches pour cabinet médical.

Voici le transcript nettoyé d'une réunion de cabinet médical avec les participants: ${participantList}

Extrais TOUTES les tâches et actions mentionnées et retourne un tableau JSON avec cette structure exacte:
["tâche 1", "tâche 2", "tâche 3"]

INSTRUCTIONS SPÉCIFIQUES POUR CABINET MÉDICAL:
- Inclus les tâches administratives (commandes, plannings, dossiers)
- Inclus les suivis patients spécifiques
- Inclus les tâches de formation et développement
- Inclus les tâches d'équipement et maintenance
- Inclus les rendez-vous et contacts à prendre
- Inclus le nom de la personne responsable quand c'est mentionné
- Formule chaque tâche de manière claire et actionnable
- Inclus les échéances quand elles sont mentionnées

N'OMETS AUCUNE TÂCHE, même les plus petites. Maximum 20 tâches les plus importantes.

Retourne UNIQUEMENT le tableau JSON, sans autre texte.

Transcript:
${cleanedTranscript}`;

    console.log('Extracting tasks with OpenAI...');

    const tasksResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: 'Tu es un assistant spécialisé dans l\'extraction de tâches pour cabinet médical. Tu retournes UNIQUEMENT un tableau JSON des tâches.'
          },
          {
            role: 'user',
            content: tasksPrompt
          }
        ],
        max_tokens: 1500,
        temperature: 0.1,
      }),
    });

    let tasks: string[] = [];
    if (tasksResponse.ok) {
      const tasksData = await tasksResponse.json();
      let tasksContent = tasksData.choices[0].message.content.trim();
      
      // Clean JSON response
      if (tasksContent.startsWith('```json')) {
        tasksContent = tasksContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (tasksContent.startsWith('```')) {
        tasksContent = tasksContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      try {
        tasks = JSON.parse(tasksContent);
        if (!Array.isArray(tasks)) {
          tasks = [];
        }
        console.log('Tasks extracted successfully, count:', tasks.length);
      } catch (parseError) {
        console.error('Tasks JSON parsing failed:', parseError);
        tasks = [];
      }
    } else {
      console.error('Tasks extraction failed');
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
