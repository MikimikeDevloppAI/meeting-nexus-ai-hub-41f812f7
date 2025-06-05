
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to clean JSON response from OpenAI
function cleanJSONResponse(content: string): string {
  // Remove markdown code blocks
  let cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  
  // Remove any leading/trailing whitespace
  cleaned = cleaned.trim();
  
  // If it starts with { or [, it's likely valid JSON
  if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
    return cleaned;
  }
  
  // Try to find JSON within the response
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }
  
  throw new Error('No valid JSON found in response');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { transcript, participants, meetingId } = await req.json()
    
    if (!transcript || !meetingId) {
      return new Response(
        JSON.stringify({ error: 'Missing transcript or meetingId' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Processing transcript for meeting:', meetingId)
    console.log('Participants:', participants)

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const openAIKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAIKey) {
      throw new Error('OpenAI API key not found')
    }

    // Créer la liste des noms de participants pour le prompt
    const participantNames = participants.map((p: any) => p.name).join(', ')
    
    console.log('Participant names for transcript processing:', participantNames)

    // Premier appel OpenAI : Nettoyer et structurer le transcript
    const transcriptPrompt = `Tu es un assistant spécialisé dans la transcription de réunions. 

Voici un transcript brut d'une réunion avec les participants suivants : ${participantNames}

INSTRUCTIONS IMPORTANTES :
1. Remplace UNIQUEMENT les mentions "Speaker 1", "Speaker 2", etc. par les noms des participants de la liste fournie
2. Assigne intelligemment chaque speaker à un participant en fonction du contexte et du contenu
3. Conserve INTÉGRALEMENT tout le contenu, tous les détails, toutes les nuances
4. NE SUPPRIME AUCUNE INFORMATION, même les détails qui semblent mineurs
5. Conserve tous les noms mentionnés dans la conversation, même s'ils ne sont pas dans la liste des participants
6. Formate proprement mais garde l'intégralité du contenu
7. Structure avec des paragraphes clairs mais sans résumer

Transcript à traiter :
${transcript}

Retourne le transcript complet avec les noms des participants assignés intelligemment aux speakers, en conservant absolument tout le contenu.`

    const transcriptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: transcriptPrompt }],
        temperature: 0.3,
      }),
    })

    if (!transcriptResponse.ok) {
      const errorText = await transcriptResponse.text()
      console.error('OpenAI transcript API error:', errorText)
      throw new Error(`OpenAI transcript API error: ${transcriptResponse.status}`)
    }

    const transcriptData = await transcriptResponse.json()
    const cleanedTranscript = transcriptData.choices[0]?.message?.content

    if (!cleanedTranscript) {
      throw new Error('No transcript returned from OpenAI')
    }

    console.log('Cleaned transcript generated successfully')

    // Sauvegarder le transcript nettoyé
    const { error: transcriptError } = await supabaseClient
      .from('meetings')
      .update({ transcript: cleanedTranscript })
      .eq('id', meetingId)

    if (transcriptError) {
      console.error('Error saving cleaned transcript:', transcriptError)
      throw transcriptError
    }

    // Deuxième appel OpenAI : Générer un résumé
    const summaryPrompt = `Basé sur ce transcript de réunion, génère un résumé concis et structuré qui inclut :

1. **Contexte et objectif** : Pourquoi cette réunion a eu lieu
2. **Points clés discutés** : Les sujets principaux abordés
3. **Décisions prises** : Les conclusions et choix effectués
4. **Points d'action** : Ce qui doit être fait suite à cette réunion

Transcript :
${cleanedTranscript}

Le résumé doit être informatif mais concis, mettant l'accent sur les éléments actionnables et les décisions importantes.`

    const summaryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: summaryPrompt }],
        temperature: 0.5,
      }),
    })

    if (!summaryResponse.ok) {
      const errorText = await summaryResponse.text()
      console.error('OpenAI summary API error:', errorText)
      throw new Error(`OpenAI summary API error: ${summaryResponse.status}`)
    }

    const summaryData = await summaryResponse.json()
    const summary = summaryData.choices[0]?.message?.content

    if (summary) {
      // Sauvegarder le résumé
      const { error: summaryError } = await supabaseClient
        .from('meetings')
        .update({ summary })
        .eq('id', meetingId)

      if (summaryError) {
        console.error('Error saving summary:', summaryError)
        throw summaryError
      }
      console.log('Summary generated and saved successfully')
    }

    // Troisième appel OpenAI : Extraire les tâches avec format JSON strict
    const tasksPrompt = `Basé sur ce transcript de réunion, identifie TOUTES les tâches, actions et suivis mentionnés ou impliqués.

Participants de la réunion : ${participantNames}

Pour chaque tâche identifiée, détermine :
1. La description précise de la tâche
2. La personne responsable (si mentionnée explicitement ou si on peut l'inférer)
3. Si une communication (email, appel, message) est nécessaire pour cette tâche

IMPORTANT pour les communications :
- Si la tâche implique de contacter quelqu'un, coordonner avec une équipe, demander des informations, faire un suivi, etc.
- Génère automatiquement un draft d'email professionnel même si ce n'est pas explicitement mentionné
- L'email doit être personnalisé selon le contexte et l'objectif de la communication

Transcript :
${cleanedTranscript}

IMPORTANT: Retourne UNIQUEMENT un JSON valide sans balises markdown, avec cette structure exacte :
{
  "tasks": [
    {
      "description": "Description précise de la tâche",
      "assignedTo": "Nom du participant responsable ou null",
      "needsCommunication": true/false,
      "emailDraft": "Draft d'email si needsCommunication est true, sinon null"
    }
  ]
}`

    const tasksResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: tasksPrompt }],
        temperature: 0.3,
      }),
    })

    if (!tasksResponse.ok) {
      const errorText = await tasksResponse.text()
      console.error('OpenAI tasks API error:', errorText)
      throw new Error(`OpenAI tasks API error: ${tasksResponse.status}`)
    }

    const tasksData = await tasksResponse.json()
    const tasksContent = tasksData.choices[0]?.message?.content

    let extractedTasks = []
    if (tasksContent) {
      try {
        // Nettoyer la réponse avant le parsing
        const cleanedTasksContent = cleanJSONResponse(tasksContent)
        console.log('Cleaned tasks content:', cleanedTasksContent)
        
        const tasksJson = JSON.parse(cleanedTasksContent)
        extractedTasks = tasksJson.tasks || []
        console.log(`Extracted ${extractedTasks.length} tasks from transcript`)
      } catch (parseError) {
        console.error('Error parsing tasks JSON:', parseError)
        console.log('Raw tasks content:', tasksContent)
        
        // Fallback: essayer de récupérer les tâches manuellement
        console.log('Attempting manual task extraction as fallback')
        extractedTasks = []
      }
    }

    // Sauvegarder les tâches dans la base de données
    const savedTasks = []
    for (const task of extractedTasks) {
      try {
        // Trouver l'ID du participant assigné
        let assignedToId = null
        if (task.assignedTo) {
          const assignedParticipant = participants.find((p: any) => 
            p.name.toLowerCase().includes(task.assignedTo.toLowerCase()) ||
            task.assignedTo.toLowerCase().includes(p.name.toLowerCase())
          )
          assignedToId = assignedParticipant?.id || null
        }

        // Insérer la tâche
        const { data: todoData, error: todoError } = await supabaseClient
          .from('todos')
          .insert({
            description: task.description,
            meeting_id: meetingId,
            assigned_to: assignedToId,
            status: 'pending'
          })
          .select()
          .single()

        if (todoError) {
          console.error('Error saving todo:', todoError)
          continue
        }

        // Si une communication est nécessaire, générer une recommandation avec email
        if (task.needsCommunication && task.emailDraft) {
          const recommendationText = `Communication recommandée pour cette tâche. Un email draft a été préparé pour faciliter le suivi.`
          
          const { error: recommendationError } = await supabaseClient
            .from('todo_ai_recommendations')
            .insert({
              todo_id: todoData.id,
              recommendation_text: recommendationText,
              email_draft: task.emailDraft
            })

          if (recommendationError) {
            console.error('Error saving AI recommendation:', recommendationError)
          } else {
            console.log('AI recommendation with email draft saved for task:', task.description)
          }
        }

        savedTasks.push({
          id: todoData.id,
          description: task.description,
          assignedTo: task.assignedTo,
          needsCommunication: task.needsCommunication
        })

      } catch (taskError) {
        console.error('Error processing task:', taskError)
      }
    }

    console.log(`Successfully processed transcript for meeting ${meetingId}`)
    console.log(`Saved ${savedTasks.length} tasks with recommendations`)

    return new Response(
      JSON.stringify({
        success: true,
        processedTranscript: cleanedTranscript,
        summary: summary,
        tasks: savedTasks,
        message: `Successfully processed transcript and extracted ${savedTasks.length} tasks`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in process-transcript function:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Check function logs for more information'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
