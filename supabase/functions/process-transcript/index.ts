
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
    const { meetingId, transcript, participants: meetingParticipants } = await req.json();

    console.log(`🚀 [PROCESS-TRANSCRIPT] DÉBUT traitement UNIFIÉ - ${new Date().toISOString()}`);
    console.log(`📝 [PROCESS-TRANSCRIPT] Processing transcript for meeting: ${meetingId}`);
    console.log(`👥 [PROCESS-TRANSCRIPT] Meeting participants:`, JSON.stringify(meetingParticipants?.map(p => `"${p.name || p.email}"`)));
    console.log(`📊 [PROCESS-TRANSCRIPT] Transcript length: ${transcript?.length || 0} characters`);
    console.log(`🔧 [PROCESS-TRANSCRIPT] Payload validation:`, {
      hasMeetingId: !!meetingId,
      hasTranscript: !!transcript,
      hasParticipants: !!meetingParticipants,
      participantsIsArray: Array.isArray(meetingParticipants)
    });

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

    // NOUVEAU: Traitement unifié avec GPT-5 (nettoyage + résumé + todos en un seul appel)
    console.log('🚀 [PROCESS-TRANSCRIPT] Démarrage du traitement UNIFIÉ GPT-5...');
    
    const { processUnifiedGPT5 } = await import('./services/unified-gpt5-processor.ts');
    const { handleDocumentProcessing } = await import('./services/document-service.ts');
    
    const parallelStartTime = Date.now();
    
    // Traitement en parallèle : GPT-5 unifié + embeddings
    const [unifiedResult, embeddingsResult] = await Promise.allSettled([
      // Traitement UNIFIÉ avec GPT-5 (nettoyage + résumé + todos + recommandations)
      (async () => {
        console.log('🤖 [PARALLEL] Traitement COMPLET avec GPT-5 (nettoyage+résumé+todos)...');
        const startTime = Date.now();
        const result = await processUnifiedGPT5(
          transcript, // transcript RAW directement
          meetingId,
          participantNames,
          meetingData,
          actualParticipants,
          openaiApiKey
        );
        console.log(`✅ [PARALLEL] Traitement GPT-5 unifié terminé (${Date.now() - startTime}ms)`);
        return result;
      })(),
      
      // Traitement des embeddings (en parallèle)
      (async () => {
        console.log('🔗 [PARALLEL] Processing document embeddings...');
        const startTime = Date.now();
        
        // Pour les embeddings, on utilise le transcript brut initialement
        // Les embeddings seront mis à jour quand le transcript nettoyé sera disponible
        const chunks = chunkText(transcript, 1000, 200);
        const documentResult = await handleDocumentProcessing(
          supabaseClient,
          meetingId,
          transcript, // On commence avec le transcript brut
          meetingData.title,
          new Date(meetingData.created_at).toLocaleDateString('fr-FR'),
          chunks
        );
        console.log(`✅ [PARALLEL] Document embeddings processed (${Date.now() - startTime}ms)`);
        return documentResult;
      })()
    ]);

    console.log(`⏱️ [PROCESS-TRANSCRIPT] Traitement UNIFIÉ GPT-5 terminé (${Date.now() - parallelStartTime}ms)`);

    // Traiter le résultat du traitement unifié GPT-5
    let tasksCreated = 0;
    let recommendationsGenerated = 0;
    let transcriptCleaned = false;
    let summaryGenerated = false;
    
    if (unifiedResult.status === 'fulfilled') {
      tasksCreated = unifiedResult.value?.tasksCount || 0;
      transcriptCleaned = unifiedResult.value?.transcriptCleaned || false;
      summaryGenerated = unifiedResult.value?.summaryGenerated || false;
      recommendationsGenerated = tasksCreated; // Chaque tâche a potentiellement une recommandation
      console.log(`✅ [PROCESS-TRANSCRIPT] Traitement GPT-5 unifié réussi:`);
      console.log(`   📋 ${tasksCreated} todos créés`);
      console.log(`   🧹 Transcript nettoyé: ${transcriptCleaned ? 'OUI' : 'NON'}`);
      console.log(`   📝 Résumé généré: ${summaryGenerated ? 'OUI' : 'NON'}`);
    } else {
      console.error('❌ [PROCESS-TRANSCRIPT] Traitement GPT-5 unifié échoué:', unifiedResult.reason);
    }

    // Vérifier le résultat des embeddings
    let documentProcessed = false;

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
      transcriptCleaned: transcriptCleaned,
      summaryGenerated: summaryGenerated,
      recommendationsGenerated: recommendationsGenerated > 0,
      recommendationStats: {
        processed: tasksCreated,
        successful: recommendationsGenerated,
        failed: unifiedResult.status === 'fulfilled' ? 0 : 1
      },
      fullyCompleted: unifiedResult.status === 'fulfilled' && embeddingsResult.status === 'fulfilled',
      unified: true,
      gpt5Unified: true,
      parallelProcessing: {
        unifiedGPT5Success: unifiedResult.status === 'fulfilled',
        embeddingsSuccess: embeddingsResult.status === 'fulfilled'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ [PROCESS-TRANSCRIPT] Error processing transcript:', error);
    console.error('❌ [PROCESS-TRANSCRIPT] Stack trace:', error.stack);
    
    // Essayer de sauvegarder au moins le transcript brut si le traitement unifié échoue
    try {
      console.log('🔄 [PROCESS-TRANSCRIPT] Attempting to save raw transcript as fallback...');
      const supabaseClient = createSupabaseClient();
      await saveTranscript(supabaseClient, meetingId, transcript);
    } catch (fallbackError) {
      console.error('❌ [PROCESS-TRANSCRIPT] Failed to save fallback transcript:', fallbackError);
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      fullyCompleted: false,
      unified: true,
      gpt5Unified: true
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
