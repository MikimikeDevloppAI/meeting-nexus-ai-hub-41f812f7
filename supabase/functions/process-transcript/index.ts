
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

// Helper function to format date
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Helper function to chunk text for embeddings
const chunkText = (text: string, maxChunkSize: number = 800, overlap: number = 100): string[] => {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Split by paragraphs first, then sentences
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  
  for (const paragraph of paragraphs) {
    if (paragraph.trim().length === 0) continue;
    
    // If paragraph is small enough, add it as a chunk
    if (paragraph.length <= maxChunkSize) {
      chunks.push(paragraph.trim());
      continue;
    }
    
    // Split large paragraphs by sentences
    const sentences = paragraph.split(/[.!?]+\s+/);
    let currentChunk = '';
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      if (!sentence) continue;
      
      // Check if adding this sentence would exceed the limit
      const potentialChunk = currentChunk + (currentChunk ? '. ' : '') + sentence;
      
      if (potentialChunk.length > maxChunkSize && currentChunk.length > 0) {
        // Only save chunk if it's substantial enough
        if (currentChunk.trim().length >= 150) {
          chunks.push(`[Segment ${chunks.length + 1}] ${currentChunk.trim()}.`);
        }
        
        // Start new chunk with overlap from previous
        const words = currentChunk.split(' ');
        const overlapWords = words.slice(-Math.min(overlap / 5, words.length / 2));
        currentChunk = overlapWords.join(' ') + (overlapWords.length > 0 ? '. ' : '') + sentence;
      } else {
        currentChunk = potentialChunk;
      }
    }
    
    // Add the final chunk if it has content and is substantial
    if (currentChunk.trim().length >= 150) {
      chunks.push(`[Segment ${chunks.length + 1}] ${currentChunk.trim()}${currentChunk.endsWith('.') ? '' : '.'}`);
    }
  }
  
  // Filter out chunks that are too small and ensure uniqueness
  return chunks
    .filter(chunk => chunk.length >= 150)
    .map((chunk, index) => {
      const uniqueContent = chunk.includes('[Segment') ? chunk : `[Part ${index + 1}] ${chunk}`;
      return uniqueContent;
    })
    .filter(chunk => {
      const cleanChunk = chunk.replace(/^\[(?:Segment|Part) \d+\]\s*/, '');
      return cleanChunk.length >= 100;
    });
};

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

    // Récupérer les informations de la réunion
    const { data: meetingData, error: meetingError } = await supabaseClient
      .from('meetings')
      .select('title, created_at')
      .eq('id', meetingId)
      .single()

    if (meetingError) {
      console.error('Error fetching meeting data:', meetingError)
      throw new Error('Could not fetch meeting information')
    }

    const meetingName = meetingData.title
    const meetingDate = formatDate(meetingData.created_at)
    const participantNames = participants.map((p: any) => p.name).join(', ')
    
    console.log('Meeting details:', { meetingName, meetingDate, participantNames })

    // Premier appel OpenAI : Nettoyer et structurer le transcript
    const transcriptPrompt = `Tu es un assistant IA spécialisé dans la transcription intelligente de réunions administratives pour un cabinet médical d'ophtalmologie situé à Genève, dirigé par le Dr Tabibian.

Tu vas traiter un transcript brut issu d'une réunion administrative, avec les participants suivants : ${participantNames}.

🎯 OBJECTIF :
Nettoyer et améliorer le transcript pour qu'il soit intelligible, fluide et fidèle, sans perdre aucune information importante.

INSTRUCTIONS DÉTAILLÉES :
Remplace les mentions "Speaker 1", "Speaker 2", etc. par les noms des participants, en les assignant intelligemment en fonction du contexte et du contenu.

Corrige les erreurs de transcription évidentes : reformule ou remplace des mots qui ne font pas sens, pour rendre le propos compréhensible, tout en respectant l'intention d'origine.

Supprime les échanges inutiles (bruits, hésitations, redites sans intérêt, interjections sans valeur ajoutée) pour garder uniquement les informations pertinentes.

Structure le texte en paragraphes clairs, sans le résumer.

Ne supprime aucune information utile ou décision importante, même si elle semble mineure.

Garde tous les noms et références mentionnés dans le transcript, même s'ils ne sont pas dans la liste des participants.

TON RÉSULTAT DOIT ÊTRE :
Un transcript lisible, structuré, intelligent

Avec les bons noms de participants attribués

Corrigé pour éliminer les erreurs de compréhension

Nettoyé pour enlever les échanges inutiles

Entièrement fidèle au contenu de la réunion

Transcript brut à traiter :
${transcript}`

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

    // Sauvegarder le transcript nettoyé dans la table meetings
    const { error: transcriptError } = await supabaseClient
      .from('meetings')
      .update({ transcript: cleanedTranscript })
      .eq('id', meetingId)

    if (transcriptError) {
      console.error('Error saving cleaned transcript:', transcriptError)
      throw transcriptError
    }

    // Sauvegarder le transcript dans la table documents pour les embeddings
    console.log('Saving transcript to documents table...')
    const { data: documentData, error: documentError } = await supabaseClient
      .from('documents')
      .insert({
        title: `Transcript - ${meetingName}`,
        type: 'meeting_transcript',
        content: cleanedTranscript,
        metadata: { meeting_id: meetingId, meeting_date: meetingDate }
      })
      .select()
      .single()

    if (documentError) {
      console.error('Error saving document:', documentError)
      throw new Error('Failed to save document for embeddings')
    }

    console.log('Document saved successfully:', documentData.id)

    // Créer les chunks pour les embeddings
    console.log('Creating chunks for embeddings...')
    const chunks = chunkText(cleanedTranscript)
    console.log(`Created ${chunks.length} chunks for embeddings`)

    if (chunks.length > 0) {
      // Générer les embeddings via la fonction edge
      console.log('Generating embeddings...')
      const { data: embeddingsResult, error: embeddingsError } = await supabaseClient.functions.invoke('generate-embeddings', {
        body: { texts: chunks }
      });

      if (embeddingsError) {
        console.error('Error generating embeddings:', embeddingsError)
        throw new Error('Failed to generate embeddings')
      }

      const embeddings = embeddingsResult.embeddings;
      console.log(`Generated ${embeddings.length} embeddings`)

      // Sauvegarder les embeddings dans la base de données
      console.log('Saving embeddings to database...')
      const batchSize = 10;
      for (let i = 0; i < embeddings.length; i += batchSize) {
        const batch = [];
        const endIndex = Math.min(i + batchSize, embeddings.length);
        
        for (let j = i; j < endIndex; j++) {
          const embeddingVector = `[${embeddings[j].join(',')}]`;
          
          batch.push({
            document_id: documentData.id,
            meeting_id: meetingId,
            embedding: embeddingVector,
            chunk_text: chunks[j],
            chunk_index: j,
            type: 'meeting_transcript',
            metadata: { meeting_id: meetingId, chunk_index: j }
          });
        }

        const { error: embeddingError } = await supabaseClient
          .from('document_embeddings')
          .insert(batch);

        if (embeddingError) {
          console.error(`Error saving batch ${i / batchSize + 1}:`, embeddingError);
          throw embeddingError;
        }

        console.log(`Saved batch ${i / batchSize + 1}/${Math.ceil(embeddings.length / batchSize)}`);
      }

      console.log(`Successfully saved all ${embeddings.length} embeddings`);
    }

    // Deuxième appel OpenAI : Générer un résumé avec le nouveau prompt spécialisé
    const summaryPrompt = `Tu es un assistant IA spécialisé dans la rédaction de résumés de réunions administratives pour un cabinet ophtalmologique situé à Genève, dirigé par le Dr Tabibian.

Voici le transcript nettoyé d'une réunion intitulée ${meetingName} ayant eu lieu le ${meetingDate}, avec les participants suivants : ${participantNames}.

Objectif : Génère un résumé structuré en Markdown, clair, synthétique mais complet, qui n'omet aucun point important discuté. Organise les informations selon les catégories suivantes uniquement si elles ont été abordées :

🧩 CATÉGORIES À UTILISER (uniquement si pertinentes) :
- Suivi patient
- Matériel médical
- Matériel bureau
- Organisation cabinet
- Site internet
- Formation
- Service cabinet
- Problèmes divers
- Agenda du personnel

STRUCTURE À RESPECTER :
En-tête du résumé :

**Date :** ${meetingDate}

**Réunion :** ${meetingName}

**Participants :** ${participantNames}

Pour chaque catégorie abordée :

### [Nom de la catégorie avec emoji]

**Points discutés :**

- Liste à puces des points abordés

**Décisions prises :**

- Liste à puces des décisions prises (ou - Aucune décision)

RÈGLES :
- Si une catégorie n'a pas été abordée, ne l'affiche pas
- Utilise les noms des participants dans les décisions/actions
- Sois précis et concis
- Ne renvoie que le résumé en Markdown

Transcript :
${cleanedTranscript}`

    const summaryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: summaryPrompt }],
        temperature: 0.3,
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
    console.log(`Generated ${chunks.length} embedding chunks for the document`)

    return new Response(
      JSON.stringify({
        success: true,
        processedTranscript: cleanedTranscript,
        summary: summary,
        tasks: savedTasks,
        embeddingsCount: chunks.length,
        documentId: documentData.id,
        message: `Successfully processed transcript, extracted ${savedTasks.length} tasks, and created ${chunks.length} embedding chunks`
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
