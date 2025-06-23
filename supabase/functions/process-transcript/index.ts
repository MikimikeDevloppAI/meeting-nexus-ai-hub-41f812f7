import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSupabaseClient, saveRawTranscript, saveTranscript, saveSummary, saveTask, getMeetingData } from './services/database-service.ts';
import { callOpenAI } from './services/openai-service.ts';
import { createTranscriptPrompt } from './prompts/transcript-prompt.ts';
import { createTasksPrompt } from './prompts/tasks-prompt.ts';
import { createSummaryPrompt } from './prompts/summary-prompt.ts';
import { processTaskRecommendations } from './services/recommendation-service.ts';
import { chunkText } from './utils/text-processing.ts';
import { handleDocumentProcessing } from './services/document-service.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fonction pour nettoyer la réponse JSON d'OpenAI
function cleanJsonResponse(response: string): string {
  // Supprimer les balises markdown ```json et ```
  let cleaned = response.trim();
  
  // Supprimer les balises de début
  cleaned = cleaned.replace(/^```json\s*/i, '');
  cleaned = cleaned.replace(/^```\s*/i, '');
  
  // Supprimer les balises de fin
  cleaned = cleaned.replace(/\s*```\s*$/i, '');
  
  return cleaned.trim();
}

serve(async (req) => {
  const startTime = Date.now();
  console.log(`🚀 [PROCESS-TRANSCRIPT] DÉBUT traitement - ${new Date().toISOString()}`);
  
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

    // Récupérer TOUS les participants de la base de données (pas seulement ceux de la réunion)
    console.log(`👥 [PROCESS-TRANSCRIPT] Fetching all participants from database...`);
    const { data: allParticipants, error: participantsError } = await supabaseClient
      .from('participants')
      .select('*')
      .order('name');

    if (participantsError) {
      console.error('❌ [PROCESS-TRANSCRIPT] Error fetching all participants:', participantsError);
      throw participantsError;
    }

    console.log(`👥 [PROCESS-TRANSCRIPT] Total participants disponibles dans la base: ${allParticipants?.length || 0}`);

    const participantNames = allParticipants?.map(p => p.name).join(', ') || '';

    // 1. Nettoyer le transcript - UTILISER GPT-4.1 avec retry et 16384 tokens
    const cleaningStartTime = Date.now();
    console.log('🧹 [PROCESS-TRANSCRIPT] Cleaning transcript with gpt-4.1-2025-04-14 and retry mechanism...');
    const cleanPrompt = createTranscriptPrompt(participantNames, transcript);
    
    try {
      const cleanedTranscript = await callOpenAI(cleanPrompt, openaiApiKey, 0.1, 'gpt-4.1-2025-04-14', 3, 16384);
      await saveTranscript(supabaseClient, meetingId, cleanedTranscript);
      console.log(`✅ [PROCESS-TRANSCRIPT] Transcript cleaned and saved (${Date.now() - cleaningStartTime}ms)`);
      console.log(`📏 [PROCESS-TRANSCRIPT] Cleaned transcript length: ${cleanedTranscript?.length || 0} characters`);

      // 2. TRAITEMENT EN PARALLÈLE : tâches, résumé, et embeddings
      console.log('🔄 [PROCESS-TRANSCRIPT] Démarrage du traitement parallèle...');
      
      const parallelStartTime = Date.now();
      
      // Préparer les prompts
      const tasksPrompt = createTasksPrompt(participantNames, cleanedTranscript);
      const summaryPrompt = createSummaryPrompt(
        meetingData.title,
        new Date(meetingData.created_at).toLocaleDateString('fr-FR'),
        participantNames,
        cleanedTranscript
      );
      const chunks = chunkText(cleanedTranscript, 1000, 200);

      // Lancer les 3 opérations en parallèle
      const [tasksResult, summaryResult, embeddingsResult] = await Promise.allSettled([
        // Extraction des tâches avec retry et gpt-4o avec 4096 tokens
        (async () => {
          console.log('📋 [PARALLEL] Extracting tasks with gpt-4o and retry...');
          const startTime = Date.now();
          const tasksResponse = await callOpenAI(tasksPrompt, openaiApiKey, 0.3, 'gpt-4o', 3, 4096);
          console.log(`✅ [PARALLEL] Tasks extraction completed (${Date.now() - startTime}ms)`);
          return tasksResponse;
        })(),
        
        // Génération du résumé avec retry et gpt-4o avec 4096 tokens
        (async () => {
          console.log('📝 [PARALLEL] Generating summary with gpt-4o and retry...');
          const startTime = Date.now();
          const summary = await callOpenAI(summaryPrompt, openaiApiKey, 0.2, 'gpt-4o', 3, 4096);
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

      console.log(`⏱️ [PROCESS-TRANSCRIPT] Traitement parallèle terminé (${Date.now() - parallelStartTime}ms)`);

      // Traiter le résultat des tâches
      let extractedTasks = [];
      let savedTasks = [];
      
      if (tasksResult.status === 'fulfilled') {
        try {
          console.log('📄 [PROCESS-TRANSCRIPT] Raw tasks response length:', tasksResult.value?.length || 0);
          
          // Nettoyer la réponse avant de parser
          const cleanedResponse = cleanJsonResponse(tasksResult.value);
          console.log('🧹 [PROCESS-TRANSCRIPT] Cleaned tasks response preview:', cleanedResponse.substring(0, 200) + '...');
          
          const tasksData = JSON.parse(cleanedResponse);
          extractedTasks = tasksData.tasks || [];
          console.log(`📋 [PROCESS-TRANSCRIPT] Parsed ${extractedTasks.length} tasks successfully`);
        } catch (parseError) {
          console.error('❌ [PROCESS-TRANSCRIPT] Error parsing tasks JSON:', parseError);
          console.log('📄 [PROCESS-TRANSCRIPT] Raw tasks response:', tasksResult.value);
          
          // Essayer une extraction alternative plus robuste
          try {
            console.log('🔧 [PROCESS-TRANSCRIPT] Tentative d\'extraction alternative...');
            const jsonMatch = tasksResult.value.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const tasksData = JSON.parse(jsonMatch[0]);
              extractedTasks = tasksData.tasks || [];
              console.log(`📋 [PROCESS-TRANSCRIPT] Alternative parsing réussi: ${extractedTasks.length} tasks`);
            }
          } catch (altError) {
            console.error('❌ [PROCESS-TRANSCRIPT] Alternative parsing failed too:', altError);
          }
        }

        // Sauvegarder les tâches
        if (extractedTasks.length > 0) {
          console.log(`💾 [PROCESS-TRANSCRIPT] Saving ${extractedTasks.length} tasks...`);
          for (let i = 0; i < extractedTasks.length; i++) {
            const task = extractedTasks[i];
            try {
              console.log(`💾 [PROCESS-TRANSCRIPT] Saving task ${i+1}/${extractedTasks.length}:`, task.description?.substring(0, 50) + '...');
              const savedTask = await saveTask(supabaseClient, task, meetingId, meetingParticipants || []);
              if (savedTask) {
                savedTasks.push(savedTask);
                console.log(`✅ [PROCESS-TRANSCRIPT] Task ${i+1} saved successfully with ID:`, savedTask.id);
              }
            } catch (taskError) {
              console.error(`❌ [PROCESS-TRANSCRIPT] Error saving task ${i+1}:`, taskError);
            }
          }
        } else {
          console.log('⚠️ [PROCESS-TRANSCRIPT] No tasks extracted from transcript');
        }
      } else {
        console.error('❌ [PROCESS-TRANSCRIPT] Tasks extraction failed:', tasksResult.reason);
      }

      console.log(`📊 [PROCESS-TRANSCRIPT] TÂCHES SAUVEGARDÉES FINALES: ${savedTasks.length} tâches avec IDs:`, savedTasks.map(t => t.id));

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

      // 3. Générer les recommandations IA pour les tâches - EN ARRIÈRE-PLAN dès que les tâches sont sauvegardées
      let recommendationResults = null;
      if (savedTasks.length > 0) {
        console.log(`⚡ [PROCESS-TRANSCRIPT] DÉBUT génération des recommandations avec gpt-4o pour ${savedTasks.length} tâches`);
        console.log(`🎯 [PROCESS-TRANSCRIPT] IDs des tâches à traiter:`, savedTasks.map(t => t.id));
        
        try {
          const recommendationsStartTime = Date.now();
          console.log(`🚀 [PROCESS-TRANSCRIPT] Appel processTaskRecommendations...`);
          recommendationResults = await processTaskRecommendations(savedTasks, cleanedTranscript, meetingData, allParticipants);
          console.log(`✅ [PROCESS-TRANSCRIPT] RECOMMANDATIONS TERMINÉES (${Date.now() - recommendationsStartTime}ms):`, recommendationResults);

          // Vérification finale que toutes les recommandations sont en base
          if (recommendationResults.successful > 0) {
            console.log('🔍 [PROCESS-TRANSCRIPT] Vérification finale que toutes les recommandations sont bien sauvegardées...');
            
            const { data: finalCheck, error: checkError } = await supabaseClient
              .from('todo_ai_recommendations')
              .select('todo_id, recommendation_text')
              .in('todo_id', savedTasks.map(t => t.id));

            if (checkError) {
              console.error('❌ [PROCESS-TRANSCRIPT] Erreur lors de la vérification finale:', checkError);
            } else {
              const savedRecommendationsCount = finalCheck?.length || 0;
              console.log(`📊 [PROCESS-TRANSCRIPT] Vérification finale: ${savedRecommendationsCount}/${recommendationResults.successful} recommandations confirmées en base`);
              
              // Logger les recommandations trouvées
              if (finalCheck && finalCheck.length > 0) {
                console.log(`✅ [PROCESS-TRANSCRIPT] Recommandations trouvées:`, finalCheck.map(r => ({ 
                  todo_id: r.todo_id, 
                  preview: r.recommendation_text?.substring(0, 100) + '...' 
                })));
              }
            }
          }

        } catch (recError) {
          console.error('❌ [PROCESS-TRANSCRIPT] Erreur lors de la génération des recommandations:', recError);
          console.error('❌ [PROCESS-TRANSCRIPT] Stack trace:', recError.stack);
          recommendationResults = { processed: 0, successful: 0, failed: savedTasks.length, fullyCompleted: false };
        }
      } else {
        console.log('⚠️ [PROCESS-TRANSCRIPT] Aucune tâche sauvegardée pour générer des recommandations');
        recommendationResults = { processed: 0, successful: 0, failed: 0, fullyCompleted: true };
      }

      const totalTime = Date.now() - startTime;
      console.log(`🏁 [PROCESS-TRANSCRIPT] TRAITEMENT COMPLÈTEMENT TERMINÉ (${totalTime}ms) - Traitement parallèle optimisé`);
      console.log(`📊 [PROCESS-TRANSCRIPT] RÉSUMÉ FINAL: ${savedTasks.length} tâches, ${recommendationResults?.successful || 0} recommandations, résumé: ${summaryGenerated ? 'OUI' : 'NON'}`);

      return new Response(JSON.stringify({
        success: true,
        tasksCreated: savedTasks.length,
        documentProcessed: documentProcessed,
        chunksProcessed: embeddingsResult.status === 'fulfilled' ? embeddingsResult.value?.chunksCount || 0 : 0,
        transcriptCleaned: true,
        summaryGenerated: summaryGenerated,
        recommendationsGenerated: recommendationResults?.successful > 0,
        recommendationStats: {
          processed: recommendationResults?.processed || 0,
          successful: recommendationResults?.successful || 0,
          failed: recommendationResults?.failed || 0
        },
        fullyCompleted: recommendationResults?.fullyCompleted || false,
        parallelProcessing: {
          tasksSuccess: tasksResult.status === 'fulfilled',
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
      fullyCompleted: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
