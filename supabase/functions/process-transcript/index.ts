
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

    // Get meeting info for the summary
    const { data: meetingData } = await supabase
      .from('meetings')
      .select('title, created_at')
      .eq('id', meetingId)
      .single();

    const meetingName = meetingData?.title || 'Réunion';
    const meetingDate = meetingData?.created_at ? new Date(meetingData.created_at).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR');

    // Step 1: Clean the transcript with the new specialized prompt
    const cleanPrompt = `Tu es un assistant IA spécialisé dans la réécriture de transcripts de réunions automatiques, cette une réunion d'un cabinet ophtalmologique à genève. 

PARTICIPANTS DE LA RÉUNION:
${participantList}

Tu dois réécrire le transcript pour qu'il soit cohérent et compréhensible. Retourne UNIQUEMENT le transcript réécrit, sans autre texte.

INSTRUCTIONS PRIORITAIRES:
1. **Correction intelligente des mots** : Si un mot n'a pas de sens dans le contexte, devine le mot réel qui a probablement été dit (erreur de reconnaissance vocale)
2. **Synthèse intelligente** : Résume les passages répétitifs ou sans valeur ajoutée tout en gardant l'essentiel
3. **Cohérence** : Assure-toi que chaque phrase a du sens et est compréhensible
4. **Contextualisation** : Utilise le contexte de la conversation pour corriger les incompréhensions
5. **Identification des interlocuteurs** : Remplace les références génériques (Speaker A, Speaker B, etc.) par les  noms fournis dans la liste des  participants
6. **Élimination du superflu** : Supprime les mots de remplissage, répétitions inutiles, et passages sans contenu informatif

RÈGLES SPÉCIFIQUES:
- Si un mot semble être une erreur de reconnaissance vocale, replace-le par ce qui a logiquement été dit
- Condense les longues explications répétitives en phrases claires et concises  
- Garde tous les points importants, décisions, et informations factuelles
- Améliore la grammaire et la syntaxe française
- Structure avec des paragraphes clairs et des noms d'interlocuteurs
- Privilégie la clarté et l'efficacité sans perdre le sens original

EXEMPLE DE TRANSFORMATION:
❌ "Alors euh, ben comme je disais, le truc de la clim, ben c'est que... euh... on a parlé avec le, comment il s'appelle déjà, le gars de la maintenance"
✅ "Concernant la climatisation, nous avons discuté avec le technicien de maintenance"

Transcript à réécrire:
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
            content: 'Tu es un assistant spécialisé dans la réécriture de transcripts de réunions pour cabinet ophtalmologique. Tu retournes UNIQUEMENT le transcript réécrit et cohérent.'
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

    // Step 2: Generate summary using the new Markdown prompt
    const summaryPrompt = `Tu es un assistant IA spécialisé dans la rédaction de résumés de réunions administratives pour un cabinet ophtalmologique situé à Genève, dirigé par le Dr Tabibian.

Voici le transcript nettoyé d'une réunion intitulée ${meetingName} ayant eu lieu le ${meetingDate}, avec les participants suivants : ${participantList}.

Objectif : Génère un résumé structuré en Markdown, clair, synthétique mais complet, qui n'omet aucun point important discuté. Organise les informations selon les catégories suivantes uniquement si elles ont été abordées :

🧩 CATÉGORIES À UTILISER (uniquement si pertinentes) :
• Suivi patient
• Matériel médical
• Matériel bureau
• Organisation cabinet
• Site internet
• Formation
• Service cabinet
• Problèmes divers
• Agenda du personnel

STRUCTURE À RESPECTER :

En-tête du résumé :
**Date :** ${meetingDate}
**Réunion :** ${meetingName}
**Participants :** ${participantList}

Pour chaque catégorie abordée :

### [Nom de la catégorie avec emoji]

**Points discutés :**
- Liste à puces des points abordés

**Décisions prises :**
- Liste à puces des décisions prises (ou "- Aucune décision")

RÈGLES :
• Si une catégorie n'a pas été abordée, ne l'affiche pas
• Utilise les noms des participants dans les décisions/actions
• Sois précis et concis
• Ne renvoie que le résumé en Markdown
• Assure-toi de couvrir TOUS les points mentionnés dans la réunion

Retourne UNIQUEMENT le résumé Markdown structuré, sans autre texte.

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
            content: 'Tu es un assistant spécialisé dans la création de résumés de réunions pour cabinet médical. Tu retournes UNIQUEMENT du Markdown valide et structuré par catégories.'
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

    let summary = '**Résumé automatique généré.**';
    if (summaryResponse.ok) {
      const summaryData = await summaryResponse.json();
      summary = summaryData.choices[0].message.content.trim();
      
      // Remove markdown code block if present
      if (summary.startsWith('```markdown')) {
        summary = summary.replace(/^```markdown\s*/, '').replace(/\s*```$/, '');
      } else if (summary.startsWith('```')) {
        summary = summary.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      console.log('Summary generated successfully, length:', summary.length);
    } else {
      console.error('Summary generation failed');
    }

    // Step 3: Extract tasks using the new improved prompt
    const tasksPrompt = `Tu es un assistant IA spécialisé dans l'extraction de tâches pour cabinet médical.

Voici le transcript nettoyé d'une réunion de cabinet médical avec les participants: ${participantList}

RÈGLES STRICTES POUR L'EXTRACTION:
1. Extrais toutes les tâches importantes et CONCRÈTES 
2. REGROUPE les tâches similaires ou liées en une seule tâche plus complète
3. ÉVITE les tâches trop génériques comme "faire le point sur X" 
4. PRIVILÉGIE les tâches avec des actions concrètes et des échéances
5. NE PAS créer de tâches redondantes ou en doublon
6. Si plusieurs personnes doivent faire des choses similaires, groupe en une tâche

EXEMPLES DE BONNES TÂCHES:
- "Contacter 3 prestataires de climatisation et demander des devis détaillés avant fin mars"
- "Organiser une formation sécurité incendie pour tout le personnel d'ici 2 mois"
- "Mettre à jour le site web avec les nouvelles spécialités et horaires"

EXEMPLES DE MAUVAISES TÂCHES (À ÉVITER):
- "Faire le point sur la climatisation"
- "Voir pour la formation"
- "S'occuper du site web"

INSTRUCTIONS SPÉCIFIQUES:
- Inclus les échéances quand elles sont mentionnées
- Si un nom est mentionné pour une tâche, l'inclure dans "assignedTo", sinon mettre null
- Formule chaque tâche de manière claire et actionnable
- Concentre-toi sur les DÉCISIONS et ACTIONS concrètes prises en réunion

Retourne UNIQUEMENT le tableau JSON, sans autre texte.

FORMAT DE SORTIE:
Retourne un tableau JSON avec cette structure exacte:
[{"task": "description précise et actionnable", "assignedTo": "nom du participant ou null"}]

Transcript:
${cleanedTranscript}`;

    console.log('Extracting tasks with improved OpenAI prompt...');

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
            content: 'Tu es un assistant spécialisé dans l\'extraction de tâches concrètes pour cabinet médical. Tu retournes UNIQUEMENT un tableau JSON des tâches importantes, regroupées et déduplicées.'
          },
          {
            role: 'user',
            content: tasksPrompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.1,
      }),
    });

    let tasks: any[] = [];
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
      
      for (const taskObj of tasks) {
        const taskDescription = typeof taskObj === 'string' ? taskObj : taskObj.task;
        const assignedToName = typeof taskObj === 'object' ? taskObj.assignedTo : null;
        
        // Find participant by name
        let assignedParticipantId = null;
        if (assignedToName && participants) {
          const participant = participants.find(p => 
            p.name.toLowerCase().includes(assignedToName.toLowerCase()) ||
            assignedToName.toLowerCase().includes(p.name.toLowerCase().split(' ')[0])
          );
          assignedParticipantId = participant?.id || null;
        }

        console.log('Saving task:', { 
          task: taskDescription.substring(0, 50) + (taskDescription.length > 50 ? '...' : ''), 
          assignedTo: assignedParticipantId ? participants.find(p => p.id === assignedParticipantId)?.name : 'None'
        });

        const { data: todoData, error: todoError } = await supabase
          .from('todos')
          .insert({
            description: taskDescription.trim(),
            status: 'confirmed',
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

        // Generate AI recommendation using the advanced AI agent with concise prompt
        if (todoData) {
          try {
            const aiAgentQuery = `RECOMMANDATION TÂCHE OPHTACARE

Tu es un assistant IA expert pour cabinet d'ophtalmologie situé à Genève, en Suisse. Analyse cette tâche et fournis une recommandation UNIQUEMENT si elle apporte une valeur ajoutée SIGNIFICATIVE.

CONTEXTE IMPORTANT :
- Cabinet d'ophtalmologie à Genève, Suisse  
- Pour tous les prix, utilise TOUJOURS les francs suisses (CHF)
- Adapte tes conseils au contexte suisse et genevois

TÂCHE: ${taskDescription}

CONTEXTE:
Participants: ${participantList}
Réunion: ${meetingName} du ${meetingDate}
Transcript: ${cleanedTranscript.substring(0, 500)}...

INSTRUCTIONS CRITIQUES:
- Réponds UNIQUEMENT en français
- Si la tâche est évidente, simple ou ne nécessite aucun conseil spécialisé, réponds exactement: "AUCUNE_RECOMMANDATION"
- Fournis une recommandation SEULEMENT si tu peux apporter:
  * Des conseils techniques spécialisés en ophtalmologie
  * Des informations sur des équipements, fournisseurs ou prestataires spécifiques
  * Des bonnes pratiques métier non évidentes
  * Des points d'attention critiques

- Si tu donnes une recommandation, sois TRÈS CONCIS (maximum 80 mots)
- Concentre-toi sur l'ESSENTIEL et l'ACTIONNABLE
- Évite les généralités et les conseils évidents
- Pour tous les prix mentionnés, utilise les CHF (francs suisses)`;

            const response = await supabase.functions.invoke('ai-agent', {
              body: { 
                message: aiAgentQuery,
                todoId: todoData.id,
                taskContext: {
                  todoId: todoData.id,
                  description: taskDescription.trim(),
                  meetingId: meetingId,
                  participantList: participantList,
                  type: 'task_recommendation',
                  cabinet: 'OphtaCare'
                }
              }
            });
            
            if (response.error) {
              console.error('AI agent recommendation request failed:', response.error);
            } else {
              console.log('AI agent recommendation generated for task:', taskDescription.substring(0, 50));
              
              // Extract recommendation from response and add as comment if valuable
              const aiResponse = response.data?.response || '';
              
              if (aiResponse && 
                  !aiResponse.includes('AUCUNE_RECOMMANDATION') && 
                  !aiResponse.toLowerCase().includes('aucune recommandation') &&
                  aiResponse.length > 10) {
                
                // Clean the response
                const cleanedRecommendation = aiResponse
                  .replace(/\[ACTION_TACHE:[^\]]*\]/gs, '')
                  .replace(/\s*CONTEXT_PARTICIPANTS:.*$/gi, '')
                  .trim();

                if (cleanedRecommendation) {
                  await supabase
                    .from('todo_comments')
                    .insert({
                      todo_id: todoData.id,
                      user_id: '00000000-0000-0000-0000-000000000000', // System user for AI
                      comment: `💡 **Conseil IA OphtaCare:** ${cleanedRecommendation}`
                    });
                  
                  console.log('AI recommendation added as comment for task:', taskDescription.substring(0, 50));
                }
              }
            }
          } catch (error) {
            console.error('Error generating AI agent recommendation:', error);
          }
        }

        // Mark that AI recommendation was generated
        if (todoData) {
          await supabase
            .from('todos')
            .update({ ai_recommendation_generated: true })
            .eq('id', todoData.id);
        }
      }
    }

    console.log('Processing completed successfully');

    return new Response(JSON.stringify({ 
      success: true, 
      processedTranscript: cleanedTranscript,
      summary: summary,
      tasks: tasks.map(t => typeof t === 'string' ? t : t.task),
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
