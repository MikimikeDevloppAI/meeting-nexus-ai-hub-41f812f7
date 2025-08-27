
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSupabaseClient, saveRawTranscript, saveTranscript, getMeetingData } from './services/database-service.ts';
import { chunkText } from './utils/text-processing.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const startTime = Date.now();
  console.log(`🚀 [PROCESS-TRANSCRIPT] DÉBUT traitement UNIFIÉ - ${new Date().toISOString()}`);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { meetingId, transcript, participants: meetingParticipants, traceId } = await req.json();
    const sessionTraceId = traceId || `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sessionStartTime = Date.now();

    console.log(`🚀 [TRACE:${sessionTraceId}] DÉBUT traitement UNIFIÉ - ${new Date().toISOString()}`);
    console.log(`📝 [TRACE:${sessionTraceId}] Processing transcript for meeting: ${meetingId}`);
    console.log(`👥 [TRACE:${sessionTraceId}] Meeting participants:`, JSON.stringify(meetingParticipants?.map(p => `"${p.name || p.email}"`)));
    console.log(`📊 [TRACE:${sessionTraceId}] Transcript length: ${transcript?.length || 0} characters`);
    console.log(`🔧 [TRACE:${sessionTraceId}] Payload validation:`, {
      hasMeetingId: !!meetingId,
      hasTranscript: !!transcript,
      hasParticipants: !!meetingParticipants,
      participantsIsArray: Array.isArray(meetingParticipants),
      traceIdReceived: !!traceId,
      requestMethod: req.method,
      requestUrl: req.url,
      timestamp: new Date().toISOString()
    });

    // Critical validation with detailed logging
    if (!meetingId) {
      console.error(`[TRACE:${sessionTraceId}] ❌ CRITICAL VALIDATION FAILED: Missing meetingId`);
      return new Response(JSON.stringify({ error: 'Meeting ID is required', traceId: sessionTraceId }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (!transcript) {
      console.error(`[TRACE:${sessionTraceId}] ❌ CRITICAL VALIDATION FAILED: Missing transcript`);
      return new Response(JSON.stringify({ error: 'Transcript is required', traceId: sessionTraceId }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (!Array.isArray(meetingParticipants) || meetingParticipants.length === 0) {
      console.error(`[TRACE:${sessionTraceId}] ❌ CRITICAL VALIDATION FAILED: Invalid participants`);
      return new Response(JSON.stringify({ error: 'Valid participants array is required', traceId: sessionTraceId }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error(`❌ [PROCESS-TRANSCRIPT] OpenAI API key not configured`);
      throw new Error('OpenAI API key not configured');
    }

    const supabaseClient = createSupabaseClient();

    // Save raw transcript immediately - this is fast
    console.log(`💾 [PROCESS-TRANSCRIPT] Saving raw transcript...`);
    await saveRawTranscript(supabaseClient, meetingId, transcript);
    console.log(`✅ [PROCESS-TRANSCRIPT] Raw transcript saved successfully`);

    // Get meeting data - this is also fast
    console.log(`🔍 [PROCESS-TRANSCRIPT] Fetching meeting data...`);
    const meetingData = await getMeetingData(supabaseClient, meetingId);
    console.log(`✅ [PROCESS-TRANSCRIPT] Meeting data fetched:`, { title: meetingData.title, created_at: meetingData.created_at });

    // Get meeting participants - also fast
    console.log(`👥 [PROCESS-TRANSCRIPT] Fetching meeting participants from database...`);
    const { data: meetingUsers, error: meetingUsersError } = await supabaseClient
      .from('meeting_users')
      .select(`
        user_id,
        users(id, name, email)
      `)
      .eq('meeting_id', meetingId);

    if (meetingUsersError) {
      console.error('❌ [PROCESS-TRANSCRIPT] Error fetching meeting users:', meetingUsersError);
      throw meetingUsersError;
    }

    const actualParticipants = meetingUsers?.map(mu => mu.users) || [];
    console.log(`👥 [PROCESS-TRANSCRIPT] Participants de cette réunion: ${actualParticipants?.length || 0}`);

    const participantNames = actualParticipants?.map(p => p.name).join(', ') || '';

    // 🚀 RETURN IMMEDIATE 202 RESPONSE - Client gets instant response
    console.log(`[TRACE:${sessionTraceId}] 🚀 Sending immediate 202 response to client...`);
    const immediateResponse = new Response(JSON.stringify({
      success: true,
      message: 'Processing started in background',
      traceId: sessionTraceId,
      meetingId,
      status: 'processing'
    }), {
      status: 202, // Accepted - processing in background
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

    // 🔄 START HEAVY PROCESSING IN BACKGROUND
    console.log(`[TRACE:${sessionTraceId}] 🔄 Starting background processing...`);
    
    // Use EdgeRuntime.waitUntil to run heavy processing in background
    // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
    EdgeRuntime.waitUntil((async () => {
      try {
        console.log(`[TRACE:${sessionTraceId}] 🤖 Background: Starting UNIFIED GPT-5 processing...`);
        
        const { processUnifiedGPT5 } = await import('./services/unified-gpt5-processor.ts');
        const { handleDocumentProcessing } = await import('./services/document-service.ts');
        
        const parallelStartTime = Date.now();
        
        // Heavy processing in parallel - GPT-5 unified + embeddings
        console.log(`[TRACE:${sessionTraceId}] 🔄 Background: Starting parallel processing...`);
        const [unifiedResult, embeddingsResult] = await Promise.allSettled([
          // Unified GPT-5 processing (cleaning + summary + todos + recommendations)
          (async () => {
            console.log(`[TRACE:${sessionTraceId}] 🤖 [BACKGROUND-PARALLEL] Starting COMPLETE GPT-5 processing...`);
            const startTime = Date.now();
            const result = await processUnifiedGPT5(
              transcript, 
              meetingId,
              participantNames,
              meetingData,
              actualParticipants,
              openaiApiKey,
              sessionTraceId
            );
            console.log(`[TRACE:${sessionTraceId}] ✅ [BACKGROUND-PARALLEL] GPT-5 unified processing completed (${Date.now() - startTime}ms)`);
            return result;
          })(),
          
          // Document embeddings processing
          (async () => {
            console.log(`[TRACE:${sessionTraceId}] 🔗 [BACKGROUND-PARALLEL] Processing document embeddings...`);
            const startTime = Date.now();
            
            const chunks = chunkText(transcript, 1000, 200);
            const documentResult = await handleDocumentProcessing(
              supabaseClient,
              meetingId,
              transcript, 
              meetingData.title,
              new Date(meetingData.created_at).toLocaleDateString('fr-FR'),
              chunks
            );
            console.log(`[TRACE:${sessionTraceId}] ✅ [BACKGROUND-PARALLEL] Document embeddings processed (${Date.now() - startTime}ms)`);
            return documentResult;
          })()
        ]);

        console.log(`⏱️ [TRACE:${sessionTraceId}] Background: UNIFIED processing completed (${Date.now() - parallelStartTime}ms)`);

        // Process results
        let tasksCreated = 0;
        let recommendationsGenerated = 0;
        let transcriptCleaned = false;
        let summaryGenerated = false;
        
        if (unifiedResult.status === 'fulfilled') {
          tasksCreated = unifiedResult.value?.tasksCount || 0;
          transcriptCleaned = unifiedResult.value?.transcriptCleaned || false;
          summaryGenerated = unifiedResult.value?.summaryGenerated || false;
          recommendationsGenerated = tasksCreated;
          console.log(`✅ [TRACE:${sessionTraceId}] Background: GPT-5 unified processing succeeded:`);
          console.log(`   📋 ${tasksCreated} todos created`);
          console.log(`   🧹 Transcript cleaned: ${transcriptCleaned ? 'YES' : 'NO'}`);
          console.log(`   📝 Summary generated: ${summaryGenerated ? 'YES' : 'NO'}`);
        } else {
          console.error(`❌ [TRACE:${sessionTraceId}] Background: GPT-5 unified processing failed:`, unifiedResult.reason);
        }

        let documentProcessed = false;
        if (embeddingsResult.status === 'fulfilled') {
          documentProcessed = true;
          console.log(`✅ [TRACE:${sessionTraceId}] Background: Document embeddings processed successfully`);
        } else {
          console.error(`❌ [TRACE:${sessionTraceId}] Background: Document embeddings processing failed:`, embeddingsResult.reason);
        }

        const totalBackgroundTime = Date.now() - sessionStartTime;
        console.log(`[TRACE:${sessionTraceId}] 🏁 BACKGROUND PROCESSING COMPLETELY FINISHED (${totalBackgroundTime}ms)`);
        console.log(`[TRACE:${sessionTraceId}] 📊 BACKGROUND FINAL SUMMARY: ${tasksCreated} todos with ${recommendationsGenerated} recommendations, summary: ${summaryGenerated ? 'YES' : 'NO'}`);

      } catch (backgroundError) {
        const totalDuration = Date.now() - sessionStartTime;
        console.error(`[TRACE:${sessionTraceId}] ❌ Background processing failed after ${totalDuration}ms:`, backgroundError);
        console.error(`[TRACE:${sessionTraceId}] ❌ Background error stack:`, backgroundError.stack);
        
        // Try to save raw transcript as fallback
        try {
          console.log(`[TRACE:${sessionTraceId}] 🔄 Background: Attempting to save raw transcript as fallback...`);
          await saveTranscript(supabaseClient, meetingId, transcript);
          console.log(`[TRACE:${sessionTraceId}] ✅ Background: Raw transcript saved as fallback`);
        } catch (fallbackError) {
          console.error(`[TRACE:${sessionTraceId}] ❌ Background: Failed to save fallback transcript:`, fallbackError);
        }
      }
    })());

    return immediateResponse;


  } catch (error) {
    const totalDuration = Date.now() - sessionStartTime;
    console.error(`[TRACE:${sessionTraceId}] ❌ Error processing transcript after ${totalDuration}ms:`, error);
    console.error(`[TRACE:${sessionTraceId}] ❌ Error stack:`, error.stack);
    
    // Essayer de sauvegarder au moins le transcript brut si le traitement unifié échoue
    try {
      console.log(`[TRACE:${sessionTraceId}] 🔄 Attempting to save raw transcript as fallback...`);
      const supabaseClient = createSupabaseClient();
      await saveTranscript(supabaseClient, meetingId, transcript);
      console.log(`[TRACE:${sessionTraceId}] ✅ Raw transcript saved as fallback`);
    } catch (fallbackError) {
      console.error(`[TRACE:${sessionTraceId}] ❌ Failed to save fallback transcript:`, fallbackError);
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      fullyCompleted: false,
      unified: true,
      gpt5Unified: true,
      traceId: sessionTraceId,
      processingTimeMs: totalDuration
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
