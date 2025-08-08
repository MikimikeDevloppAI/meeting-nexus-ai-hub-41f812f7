
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSupabaseClient, saveRawTranscript, saveTranscript, saveSummary, getMeetingData } from './services/database-service.ts';
import { callOpenAI } from './services/openai-service.ts';
import { createTranscriptPrompt } from './prompts/transcript-prompt.ts';
import { createSummaryPrompt } from './prompts/summary-prompt.ts';
import { processTasksWithRecommendations } from './services/unified-todo-service.ts';
import { chunkText } from './utils/text-processing.ts';
import { handleDocumentProcessing } from './services/document-service.ts';

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
    const { meetingId, transcript, participants: meetingParticipants } = await req.json();

    console.log(`📝 [PROCESS-TRANSCRIPT] Processing transcript for meeting: ${meetingId}`);
    console.log(`👥 [PROCESS-TRANSCRIPT] Meeting participants:`, meetingParticipants?.map(p => p.name));
    console.log(`📊 [PROCESS-TRANSCRIPT] Transcript length: ${transcript?.length || 0} characters`);

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error(`❌ [PROCESS-TRANSCRIPT] OpenAI API key not configured`);
      throw new Error('OpenAI API key not configured');
    }

    const supabaseClient = createSupabaseClient();

    // Sauvegarder le transcript brut
    console.log(`💾 [PROCESS-TRANSCRIPT] Saving raw transcript...`);
    await saveRawTranscript(supabaseClient, meetingId, transcript);
    console.log(`✅ [PROCESS-TRANSCRIPT] Raw transcript saved successfully`);

    // Obtenir les données de la réunion
    console.log(`🔍 [PROCESS-TRANSCRIPT] Fetching meeting data...`);
    const meetingData = await getMeetingData(supabaseClient, meetingId);
    console.log(`✅ [PROCESS-TRANSCRIPT] Meeting data fetched:`, { title: meetingData.title, created_at: meetingData.created_at });

    // Récupérer UNIQUEMENT les utilisateurs participants à cette réunion
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

    // 1. Nettoyer le transcript - UTILISER GPT-4.1 avec retry et 16384 tokens
    const cleaningStartTime = Date.now();
    console.log('🧹 [PROCESS-TRANSCRIPT] Cleaning transcript with gpt-5-mini and retry mechanism...');
    const cleanPrompt = createTranscriptPrompt(participantNames, transcript);
    
    try {
      const cleanedTranscript = await callOpenAI(cleanPrompt, openaiApiKey, 0.1, 'gpt-5-mini', 3, 16384);
      await saveTranscript(supabaseClient, meetingId, cleanedTranscript);
      console.log(`✅ [PROCESS-TRANSCRIPT] Transcript cleaned and saved (${Date.now() - cleaningStartTime}ms)`);
      console.log(`📏 [PROCESS-TRANSCRIPT] Cleaned transcript length: ${cleanedTranscript?.length || 0} characters`);

      // 2. TRAITEMENT EN PARALLÈLE : todos unifiés, résumé, et embeddings
      console.log('🔄 [PROCESS-TRANSCRIPT] Démarrage du traitement parallèle UNIFIÉ...');
      
      const parallelStartTime = Date.now();
      
      // Préparer les prompts
      const summaryPrompt = createSummaryPrompt(
        meetingData.title,
        new Date(meetingData.created_at).toLocaleDateString('fr-FR'),
        participantNames,
        cleanedTranscript
      );
      const chunks = chunkText(cleanedTranscript, 1000, 200);

      // Lancer les 3 opérations en parallèle (mais todos unifié maintenant)
      const [todosResult, summaryResult, embeddingsResult] = await Promise.allSettled([
        // Traitement UNIFIÉ des tâches + recommandations avec gpt-4.1
        (async () => {
          console.log('📋 [PARALLEL] TRAITEMENT UNIFIÉ todos + recommandations avec gpt-4.1...');
          const startTime = Date.now();
          const unifiedResult = await processTasksWithRecommendations(cleanedTranscript, meetingData, actualParticipants);
          console.log(`✅ [PARALLEL] Traitement unifié terminé (${Date.now() - startTime}ms)`);
          return unifiedResult;
        })(),
        
        // Génération du résumé avec retry et gpt-4o avec 4096 tokens
        (async () => {
          console.log('📝 [PARALLEL] Generating summary with gpt-5 and retry...');
          const startTime = Date.now();
          const summary = await callOpenAI(summaryPrompt, openaiApiKey, 0.2, 'gpt-5', 3, 4096);
          await saveSummary(supabaseClient, meetingId, summary);
          console.log(`✅ [PARALLEL] Summary generated and saved (${Date.now() - startTime}ms)`);
          return summary;
        })(),
        
        // Traitement des embeddings
        (async () => {
          console.log('🔗 [PARALLEL] Processing document embeddings...');
          const startTime = Date.now();
          const documentResult = await handleDocumentProcessing(
            supabaseClient,
            meetingId,
            cleanedTranscript,
            meetingData.title,
            new Date(meetingData.created_at).toLocaleDateString('fr-FR'),
            chunks
          );
          console.log(`✅ [PARALLEL] Document embeddings processed (${Date.now() - startTime}ms)`);
          return documentResult;
        })()
      ]);

      console.log(`⏱️ [PROCESS-TRANSCRIPT] Traitement parallèle UNIFIÉ terminé (${Date.now() - parallelStartTime}ms)`);

      // Traiter le résultat des todos unifiés
      let tasksCreated = 0;
      let recommendationsGenerated = 0;
      
      if (todosResult.status === 'fulfilled') {
        tasksCreated = todosResult.value.successful || 0;
        recommendationsGenerated = todosResult.value.successful || 0; // Même nombre car traitement unifié
        console.log(`✅ [PROCESS-TRANSCRIPT] Traitement unifié réussi: ${tasksCreated} todos créés avec recommandations`);
      } else {
        console.error('❌ [PROCESS-TRANSCRIPT] Traitement unifié échoué:', todosResult.reason);
      }

      // Vérifier les résultats des autres opérations parallèles
      let summaryGenerated = false;
      let documentProcessed = false;

      if (summaryResult.status === 'fulfilled') {
        summaryGenerated = true;
        console.log('✅ [PROCESS-TRANSCRIPT] Summary generated successfully');
      } else {
        console.error('❌ [PROCESS-TRANSCRIPT] Summary generation failed:', summaryResult.reason);
      }

      if (embeddingsResult.status === 'fulfilled') {
        documentProcessed = true;
        console.log('✅ [PROCESS-TRANSCRIPT] Document embeddings processed successfully');
      } else {
        console.error('❌ [PROCESS-TRANSCRIPT] Document embeddings processing failed:', embeddingsResult.reason);
      }

      const totalTime = Date.now() - startTime;
      console.log(`🏁 [PROCESS-TRANSCRIPT] TRAITEMENT UNIFIÉ COMPLÈTEMENT TERMINÉ (${totalTime}ms)`);
      console.log(`📊 [PROCESS-TRANSCRIPT] RÉSUMÉ FINAL UNIFIÉ: ${tasksCreated} todos avec ${recommendationsGenerated} recommandations, résumé: ${summaryGenerated ? 'OUI' : 'NON'}`);

      return new Response(JSON.stringify({
        success: true,
        tasksCreated: tasksCreated,
        documentProcessed: documentProcessed,
        chunksProcessed: embeddingsResult.status === 'fulfilled' ? embeddingsResult.value?.chunksCount || 0 : 0,
        transcriptCleaned: true,
        summaryGenerated: summaryGenerated,
        recommendationsGenerated: recommendationsGenerated > 0,
        recommendationStats: {
          processed: tasksCreated,
          successful: recommendationsGenerated,
          failed: todosResult.status === 'fulfilled' ? todosResult.value.failed || 0 : 0
        },
        fullyCompleted: todosResult.status === 'fulfilled' ? todosResult.value.fullyCompleted || false : false,
        unified: true,
        parallelProcessing: {
          todosSuccess: todosResult.status === 'fulfilled',
          summarySuccess: summaryResult.status === 'fulfilled',
          embeddingsSuccess: embeddingsResult.status === 'fulfilled'
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (cleaningError) {
      console.error('❌ [PROCESS-TRANSCRIPT] Critical error during transcript cleaning:', cleaningError);
      
      // Essayer de sauvegarder au moins le transcript brut si le nettoyage échoue
      console.log('🔄 [PROCESS-TRANSCRIPT] Attempting to save raw transcript as fallback...');
      await saveTranscript(supabaseClient, meetingId, transcript);
      
      throw new Error(`Transcript cleaning failed: ${cleaningError.message}`);
    }

  } catch (error) {
    console.error('❌ [PROCESS-TRANSCRIPT] Error processing transcript:', error);
    console.error('❌ [PROCESS-TRANSCRIPT] Stack trace:', error.stack);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      fullyCompleted: false,
      unified: true
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
