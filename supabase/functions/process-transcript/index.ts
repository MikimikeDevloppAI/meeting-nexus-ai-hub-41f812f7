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

// Improved helper function to chunk text for embeddings with better content preservation
const chunkText = (text: string, maxChunkSize: number = 800, overlap: number = 100): string[] => {
  if (!text || text.trim().length === 0) {
    return [];
  }

  console.log(`[CHUNKING-EDGE] Processing text of ${text.length} characters`);
  
  // Split by paragraphs first, then sentences
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let totalCharactersProcessed = 0;
  
  for (const paragraph of paragraphs) {
    if (paragraph.trim().length === 0) continue;
    
    totalCharactersProcessed += paragraph.length;
    
    // If paragraph is small enough, add it as a chunk (reduced threshold)
    if (paragraph.length <= maxChunkSize) {
      if (paragraph.trim().length >= 30) { // Reduced from 150 to 30
        chunks.push(`[Segment ${chunks.length + 1}] ${paragraph.trim()}`);
        console.log(`[CHUNKING-EDGE] Added small paragraph chunk: ${paragraph.length} chars`);
      } else {
        // Preserve small paragraphs by combining with previous chunk if possible
        if (chunks.length > 0 && chunks[chunks.length - 1].length + paragraph.length <= maxChunkSize) {
          chunks[chunks.length - 1] += ` ${paragraph.trim()}`;
          console.log(`[CHUNKING-EDGE] Combined small paragraph with previous chunk`);
        } else {
          // Create a minimal chunk to not lose content
          chunks.push(`[Mini-segment ${chunks.length + 1}] ${paragraph.trim()}`);
          console.log(`[CHUNKING-EDGE] Created mini-chunk to preserve content: ${paragraph.length} chars`);
        }
      }
      continue;
    }
    
    // Split large paragraphs by sentences with improved logic
    const sentences = paragraph.split(/[.!?]+\s+/);
    let currentChunk = '';
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      if (!sentence) continue;
      
      // Add proper punctuation if missing
      const punctuatedSentence = sentence.endsWith('.') || sentence.endsWith('!') || sentence.endsWith('?') 
        ? sentence 
        : sentence + '.';
      
      // Check if adding this sentence would exceed the limit
      const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + punctuatedSentence;
      
      if (potentialChunk.length > maxChunkSize && currentChunk.length > 0) {
        // Save current chunk with reduced minimum threshold
        if (currentChunk.trim().length >= 50) { // Reduced from 150 to 50
          chunks.push(`[Segment ${chunks.length + 1}] ${currentChunk.trim()}`);
          console.log(`[CHUNKING-EDGE] Added sentence-based chunk: ${currentChunk.length} chars`);
        }
        
        // Start new chunk with smart overlap
        const words = currentChunk.split(' ');
        const overlapWords = words.slice(-Math.min(15, Math.floor(words.length / 3))); // More intelligent overlap
        currentChunk = overlapWords.join(' ') + (overlapWords.length > 0 ? ' ' : '') + punctuatedSentence;
      } else {
        currentChunk = potentialChunk;
      }
    }
    
    // Add the final chunk with reduced threshold
    if (currentChunk.trim().length >= 30) { // Reduced from 150 to 30
      chunks.push(`[Segment ${chunks.length + 1}] ${currentChunk.trim()}`);
      console.log(`[CHUNKING-EDGE] Added final chunk: ${currentChunk.length} chars`);
    } else if (currentChunk.trim().length > 0) {
      // Don't lose any content - create mini-chunk
      chunks.push(`[Final-mini ${chunks.length + 1}] ${currentChunk.trim()}`);
      console.log(`[CHUNKING-EDGE] Created final mini-chunk: ${currentChunk.length} chars`);
    }
  }
  
  // Recovery phase: if we lost too much content, create additional chunks from remaining text
  const processedLength = chunks.reduce((total, chunk) => {
    const cleanChunk = chunk.replace(/^\[(?:Segment|Part|Mini-segment|Final-mini) \d+\]\s*/, '');
    return total + cleanChunk.length;
  }, 0);
  
  const retentionRate = processedLength / text.length;
  console.log(`[CHUNKING-EDGE] Content retention rate: ${(retentionRate * 100).toFixed(1)}% (${processedLength}/${text.length} chars)`);
  
  if (retentionRate < 0.85) { // If we're losing more than 15% of content
    console.log(`[CHUNKING-EDGE] Low retention detected, attempting content recovery...`);
    
    // Find text portions that might have been missed
    const allChunkText = chunks.join(' ').toLowerCase();
    const originalWords = text.toLowerCase().split(/\s+/);
    const missingWords = originalWords.filter(word => 
      word.length > 3 && !allChunkText.includes(word)
    );
    
    if (missingWords.length > 0) {
      // Create recovery chunks from missing content
      const recoveryText = missingWords.join(' ');
      if (recoveryText.length >= 20) {
        chunks.push(`[Recovery ${chunks.length + 1}] Content analysis: ${recoveryText.substring(0, 400)}`);
        console.log(`[CHUNKING-EDGE] Added recovery chunk with ${missingWords.length} missing words`);
      }
    }
  }
  
  // Final filtering with much more lenient criteria
  const finalChunks = chunks.filter(chunk => {
    const cleanChunk = chunk.replace(/^\[(?:Segment|Part|Mini-segment|Final-mini|Recovery) \d+\]\s*/, '');
    return cleanChunk.length >= 20; // Very permissive minimum - reduced from 100 to 20
  });
  
  console.log(`[CHUNKING-EDGE] Final result: ${finalChunks.length} chunks from ${text.length} chars (${chunks.length} initial chunks)`);
  
  // Log chunk distribution for debugging
  const chunkSizes = finalChunks.map(chunk => {
    const cleanChunk = chunk.replace(/^\[(?:Segment|Part|Mini-segment|Final-mini|Recovery) \d+\]\s*/, '');
    return cleanChunk.length;
  });
  
  if (chunkSizes.length > 0) {
    console.log(`[CHUNKING-EDGE] Chunk size distribution: min=${Math.min(...chunkSizes)}, max=${Math.max(...chunkSizes)}, avg=${Math.round(chunkSizes.reduce((a,b) => a+b, 0) / chunkSizes.length)}`);
  }
  
  return finalChunks;
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

    // CORRECTION: Vérifier d'abord si un document existe déjà pour ce meeting
    console.log('Checking if document already exists for this meeting...')
    const { data: existingDocument, error: checkError } = await supabaseClient
      .from('documents')
      .select('id')
      .eq('metadata->meeting_id', meetingId)
      .eq('type', 'meeting_transcript')
      .maybeSingle()

    if (checkError) {
      console.error('Error checking existing document:', checkError)
    }

    let documentData;
    if (existingDocument) {
      console.log('Document already exists, updating content...')
      // Mettre à jour le document existant
      const { data: updatedDoc, error: updateError } = await supabaseClient
        .from('documents')
        .update({
          content: cleanedTranscript,
          title: `Transcript - ${meetingName}`,
        })
        .eq('id', existingDocument.id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating existing document:', updateError)
        throw new Error('Failed to update existing document')
      }
      documentData = updatedDoc;
    } else {
      console.log('Creating new document for transcript...')
      // Créer un nouveau document seulement s'il n'existe pas
      const { data: newDoc, error: documentError } = await supabaseClient
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
      documentData = newDoc;
    }

    console.log('Document processed successfully:', documentData.id)

    // Créer les chunks pour les embeddings avec la logique améliorée
    console.log('Creating chunks for embeddings with improved logic...')
    const chunks = chunkText(cleanedTranscript)
    console.log(`Created ${chunks.length} chunks for embeddings`)

    if (chunks.length > 0) {
      // CORRECTION: Supprimer les anciens embeddings pour ce document s'ils existent
      console.log('Removing existing embeddings for this document...')
      const { error: deleteError } = await supabaseClient
        .from('document_embeddings')
        .delete()
        .eq('document_id', documentData.id)

      if (deleteError) {
        console.warn('Warning: Could not delete existing embeddings:', deleteError)
      }

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
    } else {
      console.warn('No chunks created - this might indicate an issue with the chunking logic')
    }

    // Deuxième appel OpenAI : Générer un résumé avec le nouveau prompt modifié
    const summaryPrompt = `Tu es un assistant IA spécialisé dans la rédaction de résumés de réunions administratives pour un cabinet ophtalmologique situé à Genève, dirigé par le Dr Tabibian.

Voici le transcript nettoyé d'une réunion intitulée ${meetingName} ayant eu lieu le ${meetingDate}, avec les participants suivants : ${participantNames}.

Objectif : Génère un résumé structuré en Markdown, clair, synthétique mais complet, qui n'omet aucun point important discuté. Organise les informations selon les catégories suivantes uniquement si elles ont été abordées :

🎯 CATÉGORIES À UTILISER (uniquement si pertinentes) avec emojis thématiques :
- 👥 Suivi patient
- 🔬 Matériel médical  
- 🖥️ Matériel bureau
- 🏢 Organisation cabinet
- 🌐 Site internet
- 📚 Formation
- 🔧 Service cabinet
- ⚠️ Problèmes divers
- 📅 Agenda du personnel

STRUCTURE À RESPECTER :
En-tête du résumé :

**📅 Date :** ${meetingDate}

**💼 Réunion :** ${meetingName}

**👥 Participants :** ${participantNames}

Pour chaque catégorie abordée :

### [Emoji] [Nom de la catégorie]

- Point discuté 1
  → Décision prise (si une décision a été prise pour ce point)
- Point discuté 2
  → Décision prise (si une décision a été prise pour ce point)

RÈGLES :
- TOUJOURS utiliser l'emoji correspondant devant chaque section
- Si une catégorie n'a pas été abordée, ne l'affiche pas
- Pour chaque point discuté, ajoute immédiatement en dessous la décision prise (avec → ) si il y en a eu une
- Si aucune décision n'a été prise pour un point, ne mets pas de ligne avec →
- Utilise les noms des participants dans les décisions/actions
- Sois précis et concis
- Ne renvoie que le résumé en Markdown avec les emojis

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

    // Troisième appel OpenAI : Extraire les tâches avec assignation améliorée
    const tasksPrompt = `Basé sur ce transcript de réunion, identifie TOUTES les tâches, actions et suivis mentionnés ou impliqués.

Participants de la réunion : ${participantNames}

**RÈGLES D'ASSIGNATION STRICTES:**
- Assigne une tâche à un participant SEULEMENT si c'est explicitement mentionné ou clairement déductible du contexte
- Si aucune assignation claire n'est possible, laisse "assignedTo" à null
- Utilise les noms EXACTS des participants : ${participantNames}
- Ne génère AUCUN email draft - ceci sera géré séparément

**RÈGLES D'EXTRACTION:**
- Identifie toutes les actions concrètes à entreprendre
- Inclus les suivis, communications, recherches, achats, etc.
- Sois précis dans la description de chaque tâche
- N'invente pas de tâches qui ne sont pas mentionnées

Transcript :
${cleanedTranscript}

IMPORTANT: Retourne UNIQUEMENT un JSON valide avec cette structure exacte :
{
  "tasks": [
    {
      "description": "Description précise de la tâche",
      "assignedTo": "Nom exact du participant ou null"
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
        const cleanedTasksContent = cleanJSONResponse(tasksContent)
        console.log('Cleaned tasks content:', cleanedTasksContent)
        
        const tasksJson = JSON.parse(cleanedTasksContent)
        extractedTasks = tasksJson.tasks || []
        console.log(`Extracted ${extractedTasks.length} tasks from transcript`)
      } catch (parseError) {
        console.error('Error parsing tasks JSON:', parseError)
        console.log('Raw tasks content:', tasksContent)
        extractedTasks = []
      }
    }

    // Sauvegarder les tâches avec assignation améliorée
    const savedTasks = []
    for (const task of extractedTasks) {
      try {
        // Améliorer la logique de matching des participants
        let assignedToId = null
        if (task.assignedTo) {
          // Recherche exacte d'abord
          let assignedParticipant = participants.find((p: any) => 
            p.name.toLowerCase() === task.assignedTo.toLowerCase()
          )
          
          // Si pas trouvé, recherche partielle améliorée
          if (!assignedParticipant) {
            assignedParticipant = participants.find((p: any) => {
              const participantNameLower = p.name.toLowerCase()
              const assignedToLower = task.assignedTo.toLowerCase()
              
              // Vérifier si l'un contient l'autre avec un minimum de caractères
              return (participantNameLower.includes(assignedToLower) && assignedToLower.length >= 3) ||
                     (assignedToLower.includes(participantNameLower) && participantNameLower.length >= 3)
            })
          }
          
          // Si toujours pas trouvé, recherche par mots individuels
          if (!assignedParticipant) {
            const assignedWords = task.assignedTo.toLowerCase().split(' ')
            assignedParticipant = participants.find((p: any) => {
              const participantWords = p.name.toLowerCase().split(' ')
              return assignedWords.some(word => 
                word.length >= 3 && participantWords.some(pWord => pWord.includes(word))
              )
            })
          }
          
          assignedToId = assignedParticipant?.id || null
          
          if (assignedToId) {
            console.log(`✅ Assigned task "${task.description}" to ${assignedParticipant.name}`)
          } else {
            console.log(`⚠️ Could not match "${task.assignedTo}" to any participant for task: ${task.description}`)
          }
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

        savedTasks.push({
          id: todoData.id,
          description: task.description,
          assignedTo: task.assignedTo,
          assignedToId: assignedToId
        })

      } catch (taskError) {
        console.error('Error processing task:', taskError)
      }
    }

    // NOUVELLE LOGIQUE: Générer des recommandations avec le nouvel agent
    console.log('🤖 Generating AI recommendations using specialized agent...')
    
    for (const task of savedTasks) {
      try {
        console.log(`🎯 Processing recommendations for task: ${task.description}`)
        
        // Appeler le nouvel agent de recommandations
        const { data: recommendationResult, error: recommendationError } = await supabaseClient.functions.invoke('task-recommendation-agent', {
          body: {
            task: { description: task.description },
            transcript: cleanedTranscript,
            meetingContext: {
              title: meetingName,
              date: meetingDate,
              participants: participantNames
            },
            participants: participants
          }
        });

        if (recommendationError) {
          console.error('Error calling task recommendation agent:', recommendationError);
          continue;
        }

        if (recommendationResult?.recommendation?.hasRecommendation) {
          const rec = recommendationResult.recommendation;
          
          // Sauvegarder la recommandation
          const { error: saveError } = await supabaseClient
            .from('todo_ai_recommendations')
            .insert({
              todo_id: task.id,
              recommendation_text: rec.recommendation,
              email_draft: rec.needsExternalEmail ? rec.emailDraft : null
            });

          if (saveError) {
            console.error('Error saving AI recommendation:', saveError);
          } else {
            console.log(`✅ AI recommendation saved for task: ${task.description}`);
            if (rec.externalProviders?.length > 0) {
              console.log(`📋 Providers found: ${rec.externalProviders.join(', ')}`);
            }
          }
        } else {
          console.log(`ℹ️ No valuable recommendation for task: ${task.description}`);
        }

        // Marquer que l'IA a traité cette tâche
        await supabaseClient
          .from('todos')
          .update({ ai_recommendation_generated: true })
          .eq('id', task.id);

      } catch (recError) {
        console.error('Error processing recommendation for task:', task.description, recError);
      }
    }

    console.log(`Successfully processed transcript for meeting ${meetingId}`)
    console.log(`Saved ${savedTasks.length} tasks with AI recommendations`)
    console.log(`Generated ${chunks.length} embedding chunks for the document`)

    return new Response(
      JSON.stringify({
        success: true,
        processedTranscript: cleanedTranscript,
        summary: summary,
        tasks: savedTasks,
        embeddingsCount: chunks.length,
        documentId: documentData.id,
        message: `Successfully processed transcript, extracted ${savedTasks.length} tasks with AI recommendations, and created ${chunks.length} embedding chunks`
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
