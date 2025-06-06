
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { cleanJSONResponse, formatDate, chunkText } from './utils/text-processing.ts'
import { createTranscriptPrompt } from './prompts/transcript-prompt.ts'
import { createSummaryPrompt } from './prompts/summary-prompt.ts'
import { createTasksPrompt } from './prompts/tasks-prompt.ts'
import { callOpenAI } from './services/openai-service.ts'
import { 
  createSupabaseClient, 
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

    // Clean transcript
    const transcriptPrompt = createTranscriptPrompt(participantNames, transcript)
    const cleanedTranscript = await callOpenAI(transcriptPrompt, openAIKey)

    if (!cleanedTranscript) {
      throw new Error('No transcript returned from OpenAI')
    }

    console.log('✨ Cleaned transcript generated successfully')
    await saveTranscript(supabaseClient, meetingId, cleanedTranscript)

    // Process document and embeddings in parallel with AI processing
    const documentProcessingPromise = handleDocumentProcessing(
      supabaseClient, 
      meetingId, 
      cleanedTranscript, 
      meetingName,
      meetingDate,
      chunkText(cleanedTranscript)
    )

    // Parallelize summary and tasks extraction
    console.log('⚡ Starting parallel processing of summary and tasks...')
    const summaryPrompt = createSummaryPrompt(meetingName, meetingDate, participantNames, cleanedTranscript)
    const tasksPrompt = createTasksPrompt(participantNames, cleanedTranscript)

    const [summaryResult, tasksResult] = await Promise.all([
      callOpenAI(summaryPrompt, openAIKey),
      callOpenAI(tasksPrompt, openAIKey)
    ])

    console.log('✅ Parallel AI processing completed')

    // Save summary
    if (summaryResult) {
      await saveSummary(supabaseClient, meetingId, summaryResult)
      console.log('📝 Summary generated and saved successfully')
    }

    // Process and save tasks
    let extractedTasks = []
    if (tasksResult) {
      try {
        const cleanedTasksContent = cleanJSONResponse(tasksResult)
        console.log('🔍 Cleaned tasks content:', cleanedTasksContent)
        
        const tasksJson = JSON.parse(cleanedTasksContent)
        extractedTasks = tasksJson.tasks || []
        console.log(`📋 Extracted ${extractedTasks.length} tasks from transcript`)
      } catch (parseError) {
        console.error('❌ Error parsing tasks JSON:', parseError)
        console.log('📄 Raw tasks content:', tasksResult)
        extractedTasks = []
      }
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

    // Wait for document processing to complete
    const documentData = await documentProcessingPromise
    console.log(`📄 Document processing completed with ${documentData.chunksCount} chunks`)

    // IMPORTANT: Process AI recommendations for all saved tasks
    console.log('🤖 Starting AI recommendations generation...')
    await processAIRecommendations(
      supabaseClient,
      savedTasks,
      cleanedTranscript,
      meetingName,
      meetingDate,
      participantNames,
      participants || []
    )

    console.log(`🎉 Successfully processed transcript for meeting ${meetingId}`)
    console.log(`📊 Final summary: ${savedTasks.length} tasks with AI recommendations, ${documentData.chunksCount} embedding chunks`)

    return new Response(
      JSON.stringify({
        success: true,
        processedTranscript: cleanedTranscript,
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
