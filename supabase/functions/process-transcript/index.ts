
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { cleanJSONResponse, formatDate, chunkText } from './utils/text-processing.ts'
import { createTranscriptPrompt } from './prompts/transcript-prompt.ts'
import { createSummaryPrompt } from './prompts/summary-prompt.ts'
import { createTasksPrompt } from './prompts/tasks-prompt.ts'
import { callOpenAI } from './services/openai-service.ts'
import { 
  createSupabaseClient, 
  saveRawTranscript,
  saveTranscript, 
  saveSummary, 
  getMeetingData, 
  saveTask 
} from './services/database-service.ts'
import { handleDocumentProcessing } from './services/document-service.ts'
import { processAIRecommendations } from './services/recommendation-service.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    console.log('🎬 Processing transcript for meeting:', meetingId)
    console.log('📏 Original transcript length from AssemblyAI:', transcript.length, 'characters')
    console.log('👥 Participants:', participants?.map((p: any) => p.name).join(', '))

    const supabaseClient = createSupabaseClient()

    const openAIKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAIKey) {
      throw new Error('OpenAI API key not found')
    }

    const meetingData = await getMeetingData(supabaseClient, meetingId)
    const meetingName = meetingData.title
    const meetingDate = formatDate(meetingData.created_at)
    const participantNames = participants?.map((p: any) => p.name).join(', ') || 'Participants non spécifiés'
    
    console.log('📋 Meeting details:', { meetingName, meetingDate, participantNames })

    // ÉTAPE 1: Sauvegarder le transcript brut UNIQUEMENT dans raw_transcript
    console.log('💾 Saving raw transcript from AssemblyAI in raw_transcript column only...')
    await saveRawTranscript(supabaseClient, meetingId, transcript)
    console.log('✅ Raw transcript saved successfully in raw_transcript column')

    // ÉTAPE 2: Nettoyer le transcript avec OpenAI
    console.log('🧹 Starting OpenAI transcript cleaning...')
    const transcriptPrompt = createTranscriptPrompt(participantNames, transcript)
    
    let cleanedTranscript;
    try {
      cleanedTranscript = await callOpenAI(transcriptPrompt, openAIKey, 0.1)
      
      if (!cleanedTranscript) {
        console.error('❌ No cleaned transcript returned from OpenAI')
        throw new Error('No cleaned transcript returned from OpenAI')
      }
      
      console.log('📏 Cleaned transcript length:', cleanedTranscript.length, 'characters')
      console.log('📊 Length comparison: Original:', transcript.length, '→ Cleaned:', cleanedTranscript.length)
      
      if (cleanedTranscript.length < transcript.length * 0.7) {
        console.warn('⚠️ WARNING: Cleaned transcript is significantly shorter than original! Possible content loss.')
      }

      // ÉTAPE 3: Sauvegarder le transcript nettoyé UNIQUEMENT dans la colonne transcript
      console.log('💾 Saving cleaned transcript in transcript column...')
      await saveTranscript(supabaseClient, meetingId, cleanedTranscript)
      console.log('✅ Cleaned transcript saved successfully in transcript column')
      
    } catch (openaiError) {
      console.error('❌ OpenAI cleaning failed:', openaiError)
      
      // En cas d'erreur OpenAI, utiliser le transcript brut pour continuer le traitement
      console.log('⚠️ Fallback: Using raw transcript for processing due to OpenAI failure')
      cleanedTranscript = transcript
      
      // Sauvegarder quand même le transcript brut dans la colonne transcript pour continuer
      await saveTranscript(supabaseClient, meetingId, transcript)
    }

    // ÉTAPE 4: Traitement parallèle des embeddings
    const documentProcessingPromise = handleDocumentProcessing(
      supabaseClient, 
      meetingId, 
      cleanedTranscript, 
      meetingName,
      meetingDate,
      chunkText(cleanedTranscript)
    )

    // ÉTAPE 5: Traitement parallèle du résumé et des tâches
    console.log('⚡ Starting parallel processing of summary and tasks...')
    const summaryPrompt = createSummaryPrompt(meetingName, meetingDate, participantNames, cleanedTranscript)
    const tasksPrompt = createTasksPrompt(participantNames, cleanedTranscript)

    let summaryResult, tasksResult;
    try {
      [summaryResult, tasksResult] = await Promise.all([
        callOpenAI(summaryPrompt, openAIKey),
        callOpenAI(tasksPrompt, openAIKey)
      ])
      console.log('✅ Parallel AI processing completed')
    } catch (parallelError) {
      console.error('❌ Error in parallel processing:', parallelError)
      
      // Essayer séquentiellement en cas d'erreur parallèle
      console.log('🔄 Retrying sequentially...')
      try {
        summaryResult = await callOpenAI(summaryPrompt, openAIKey)
        tasksResult = await callOpenAI(tasksPrompt, openAIKey)
        console.log('✅ Sequential processing completed')
      } catch (sequentialError) {
        console.error('❌ Sequential processing also failed:', sequentialError)
        summaryResult = null
        tasksResult = null
      }
    }

    // ÉTAPE 6: Sauvegarder le résumé
    if (summaryResult) {
      try {
        await saveSummary(supabaseClient, meetingId, summaryResult)
        console.log('📝 Summary generated and saved successfully')
      } catch (summaryError) {
        console.error('❌ Error saving summary:', summaryError)
      }
    } else {
      console.log('⚠️ No summary to save')
    }

    // ÉTAPE 7: Traiter et sauvegarder les tâches
    let extractedTasks = []
    if (tasksResult) {
      try {
        const cleanedTasksContent = cleanJSONResponse(tasksResult)
        console.log('🔍 Cleaned tasks content:', cleanedTasksContent.substring(0, 200) + '...')
        
        const tasksJson = JSON.parse(cleanedTasksContent)
        extractedTasks = tasksJson.tasks || []
        console.log(`📋 Extracted ${extractedTasks.length} tasks from transcript`)
      } catch (parseError) {
        console.error('❌ Error parsing tasks JSON:', parseError)
        console.log('📄 Raw tasks content:', tasksResult?.substring(0, 500))
        extractedTasks = []
      }
    } else {
      console.log('⚠️ No tasks result to process')
    }

    const savedTasks = []
    console.log('💾 Saving tasks to database...')
    for (const task of extractedTasks) {
      try {
        const savedTask = await saveTask(supabaseClient, task, meetingId, participants)
        savedTasks.push(savedTask)
        console.log(`✅ Task saved: ${savedTask.description.substring(0, 50)}...`)
      } catch (taskError) {
        console.error('❌ Error processing task:', taskError)
      }
    }

    // ÉTAPE 8: Attendre le traitement des documents
    let documentData;
    try {
      documentData = await documentProcessingPromise
      console.log(`📄 Document processing completed with ${documentData.chunksCount} chunks`)
    } catch (documentError) {
      console.error('❌ Document processing failed:', documentError)
      documentData = { chunksCount: 0, id: null }
    }

    // ÉTAPE 9: Traiter les recommandations IA
    if (savedTasks.length > 0) {
      console.log('🤖 Starting AI recommendations generation...')
      try {
        await processAIRecommendations(
          supabaseClient,
          savedTasks,
          cleanedTranscript,
          meetingName,
          meetingDate,
          participantNames,
          participants || []
        )
        console.log('✅ AI recommendations processing completed')
      } catch (recommendationError) {
        console.error('❌ AI recommendations failed:', recommendationError)
      }
    } else {
      console.log('ℹ️ No tasks to process for AI recommendations')
    }

    console.log(`🎉 Successfully processed transcript for meeting ${meetingId}`)
    console.log(`📊 Final summary: ${savedTasks.length} tasks with AI recommendations, ${documentData.chunksCount} embedding chunks`)

    return new Response(
      JSON.stringify({
        success: true,
        processedTranscript: cleanedTranscript,
        rawTranscriptLength: transcript.length,
        cleanedTranscriptLength: cleanedTranscript.length,
        summary: summaryResult,
        tasks: savedTasks,
        embeddingsCount: documentData.chunksCount,
        documentId: documentData.id,
        message: `Successfully processed transcript, extracted ${savedTasks.length} tasks with AI recommendations, and created ${documentData.chunksCount} embedding chunks`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Error in process-transcript function:', error)
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
