
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

    // Step 2: Generate summary using cleaned transcript
    const summaryPrompt = `Tu es un assistant IA spécialisé dans la création de résumés de réunions pour cabinet médical.

Voici le transcript nettoyé d'une réunion de cabinet médical avec les participants: ${participantList}

Crée un résumé détaillé et complet en HTML qui N'OMET AUCUN POINT IMPORTANT et organise les informations par catégories suivantes:

RÈGLES STRICTES:
- Utilise uniquement du HTML valide avec les balises <h3>, <strong>, <ul>, <li>
- Si une catégorie n'a AUCUN point discuté, ne l'affiche PAS du tout
- Assure-toi de couvrir TOUS les points mentionnés dans la réunion
- Utilise les vrais noms des participants dans le contenu
- Utilise des bullet points pour chaque élément
- Sois précis et détaillé pour chaque point important

CATÉGORIES À UTILISER (seulement si des points ont été discutés):

<h3><strong>🏥 GESTION DES PATIENTS</strong></h3>
<h4><strong>Points discutés:</strong></h4>
<ul>
<li>Nouveaux patients et leurs besoins</li>
<li>Cas complexes et suivis particuliers</li>
<li>Problématiques médicales discutées</li>
<li>Rendez-vous et consultations spéciales</li>
</ul>
<h4><strong>Décisions prises:</strong></h4>
<ul>
<li>Décisions concernant les patients</li>
</ul>

<h3><strong>🩺 MATÉRIEL MÉDICAL ET ÉQUIPEMENTS</strong></h3>
<h4><strong>Points discutés:</strong></h4>
<ul>
<li>Nouveaux équipements médicaux à acquérir</li>
<li>Maintenance et réparations d'équipements médicaux</li>
<li>Problèmes techniques médicaux</li>
</ul>
<h4><strong>Décisions prises:</strong></h4>
<ul>
<li>Décisions sur les équipements médicaux</li>
</ul>

<h3><strong>📋 ORGANISATION DU CABINET</strong></h3>
<h4><strong>Points discutés:</strong></h4>
<ul>
<li>Planning et gestion des rendez-vous</li>
<li>Procédures administratives</li>
<li>Gestion du personnel</li>
<li>Organisation des espaces</li>
</ul>
<h4><strong>Décisions prises:</strong></h4>
<ul>
<li>Décisions administratives et organisationnelles</li>
</ul>

<h3><strong>🔧 MATÉRIEL ET ÉQUIPEMENTS (NON MÉDICAL) ET SITE WEB</strong></h3>
<h4><strong>Points discutés:</strong></h4>
<ul>
<li>Équipements bureautiques et informatiques</li>
<li>Site web et outils numériques</li>
<li>Logiciels et applications</li>
</ul>
<h4><strong>Décisions prises:</strong></h4>
<ul>
<li>Décisions sur les équipements non médicaux</li>
</ul>

<h3><strong>🤝 PRESTATAIRES</strong></h3>
<h4><strong>Points discutés:</strong></h4>
<ul>
<li>Nouveaux prestataires à contacter</li>
<li>Problèmes avec prestataires actuels</li>
<li>Négociations et contrats</li>
</ul>
<h4><strong>Décisions prises:</strong></h4>
<ul>
<li>Décisions concernant les prestataires</li>
</ul>

<h3><strong>📚 FORMATION ET DÉVELOPPEMENT</strong></h3>
<h4><strong>Points discutés:</strong></h4>
<ul>
<li>Formations prévues ou planifiées</li>
<li>Nouvelles compétences à développer</li>
<li>Mise à jour des connaissances médicales</li>
<li>Conférences et séminaires</li>
</ul>
<h4><strong>Décisions prises:</strong></h4>
<ul>
<li>Décisions sur les formations</li>
</ul>

Retourne UNIQUEMENT le résumé HTML structuré, sans autre texte, sans préfixe "html".

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
            content: 'Tu es un assistant spécialisé dans la création de résumés de réunions pour cabinet médical. Tu retournes UNIQUEMENT du HTML valide et structuré par catégories, sans préfixe "html".'
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

    let summary = '<p>Résumé automatique généré.</p>';
    if (summaryResponse.ok) {
      const summaryData = await summaryResponse.json();
      summary = summaryData.choices[0].message.content.trim();
      
      // Remove "html" prefix if present
      if (summary.startsWith('html')) {
        summary = summary.substring(4).trim();
      }
      if (summary.startsWith('```html')) {
        summary = summary.replace(/^```html\s*/, '').replace(/\s*```$/, '');
      }
      
      console.log('Summary generated successfully, length:', summary.length);
    } else {
      console.error('Summary generation failed');
    }

    // Step 3: Extract tasks using improved prompt with deduplication
    const tasksPrompt = `Tu es un assistant IA spécialisé dans l'extraction de tâches pour cabinet médical.

Voici le transcript nettoyé d'une réunion de cabinet médical avec les participants: ${participantList}

RÈGLES STRICTES POUR L'EXTRACTION:
1. Extrais MAXIMUM 8-10 tâches les plus importantes et CONCRÈTES
2. REGROUPE les tâches similaires ou liées en une seule tâche plus complète
3. ÉVITE les tâches trop génériques comme "faire le point sur X" 
4. PRIVILÉGIE les tâches avec des actions concrètes et des échéances
5. NE PAS créer de tâches redondantes ou en doublon
6. Si plusieurs personnes doivent faire des choses similaires, groupe en une tâche

FORMAT DE SORTIE:
Retourne un tableau JSON avec cette structure exacte:
[{"task": "description précise et actionnable", "assignedTo": "nom du participant ou null"}]

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
            content: 'Tu es un assistant spécialisé dans l\'extraction de tâches concrètes pour cabinet médical. Tu retournes UNIQUEMENT un tableau JSON des tâches les plus importantes, regroupées et déduplicées.'
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

        // Generate enhanced AI recommendation for this task with access to embeddings
        if (todoData) {
          try {
            const response = await fetch('https://ecziljpkvshvapjsxaty.supabase.co/functions/v1/enhanced-todo-recommendations', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                todoId: todoData.id,
                description: taskDescription.trim(),
                meetingContext: cleanedTranscript,
                meetingId: meetingId,
                participantList: participantList
              }),
            });
            
            if (!response.ok) {
              console.error('Enhanced AI recommendation request failed:', await response.text());
            } else {
              console.log('Enhanced AI recommendation generated for task:', taskDescription.substring(0, 50));
            }
          } catch (error) {
            console.error('Error generating enhanced AI recommendation:', error);
          }
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
