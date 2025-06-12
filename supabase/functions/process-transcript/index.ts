
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { meetingId, transcript, participants: meetingParticipants } = await req.json();

    console.log(`📝 Processing transcript for meeting: ${meetingId}`);
    console.log(`👥 Meeting participants:`, meetingParticipants?.map(p => p.name));

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseClient = createSupabaseClient();

    // Sauvegarder le transcript brut
    await saveRawTranscript(supabaseClient, meetingId, transcript);

    // Obtenir les données de la réunion
    const meetingData = await getMeetingData(supabaseClient, meetingId);

    // Récupérer TOUS les participants de la base de données (pas seulement ceux de la réunion)
    const { data: allParticipants, error: participantsError } = await supabaseClient
      .from('participants')
      .select('*')
      .order('name');

    if (participantsError) {
      console.error('❌ Error fetching all participants:', participantsError);
      throw participantsError;
    }

    console.log(`👥 Total participants disponibles dans la base: ${allParticipants?.length || 0}`);

    const participantNames = allParticipants?.map(p => p.name).join(', ') || '';

    // 1. Nettoyer le transcript
    console.log('🧹 Cleaning transcript...');
    const cleanPrompt = createTranscriptPrompt(participantNames, transcript);
    const cleanedTranscript = await callOpenAI(cleanPrompt, openaiApiKey, 0.1);
    await saveTranscript(supabaseClient, meetingId, cleanedTranscript);

    // 2. Extraire les tâches
    console.log('📋 Extracting tasks...');
    const tasksPrompt = createTasksPrompt(participantNames, cleanedTranscript);
    const tasksResponse = await callOpenAI(tasksPrompt, openaiApiKey, 0.3);

    let extractedTasks = [];
    try {
      console.log('📄 Raw tasks response:', tasksResponse);
      
      // Nettoyer la réponse avant de parser
      const cleanedResponse = cleanJsonResponse(tasksResponse);
      console.log('🧹 Cleaned tasks response:', cleanedResponse);
      
      const tasksData = JSON.parse(cleanedResponse);
      extractedTasks = tasksData.tasks || [];
      console.log(`📋 Parsed ${extractedTasks.length} tasks successfully`);
    } catch (parseError) {
      console.error('❌ Error parsing tasks JSON:', parseError);
      console.log('📄 Raw tasks response:', tasksResponse);
      console.log('📄 Cleaned response was:', cleanJsonResponse(tasksResponse));
      
      // Essayer une extraction alternative plus robuste
      try {
        console.log('🔧 Tentative d\'extraction alternative...');
        const jsonMatch = tasksResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const tasksData = JSON.parse(jsonMatch[0]);
          extractedTasks = tasksData.tasks || [];
          console.log(`📋 Alternative parsing réussi: ${extractedTasks.length} tasks`);
        }
      } catch (altError) {
        console.error('❌ Alternative parsing failed too:', altError);
      }
    }

    // Sauvegarder les tâches
    const savedTasks = [];
    if (extractedTasks.length > 0) {
      console.log(`💾 Saving ${extractedTasks.length} tasks...`);
      for (const task of extractedTasks) {
        try {
          console.log('💾 Saving task:', task.description?.substring(0, 50) + '...');
          const savedTask = await saveTask(supabaseClient, task, meetingId, meetingParticipants || []);
          if (savedTask) {
            savedTasks.push(savedTask);
            console.log('✅ Task saved successfully:', savedTask.id);
          }
        } catch (taskError) {
          console.error('❌ Error saving task:', taskError);
        }
      }
    } else {
      console.log('⚠️ No tasks extracted from transcript');
    }

    // 3. Générer le résumé
    console.log('📝 Generating summary...');
    const summaryPrompt = createSummaryPrompt(
      meetingData.title,
      new Date(meetingData.created_at).toLocaleDateString('fr-FR'),
      participantNames,
      cleanedTranscript
    );
    const summary = await callOpenAI(summaryPrompt, openaiApiKey, 0.2);
    await saveSummary(supabaseClient, meetingId, summary);

    // 4. Traitement document avec embeddings
    console.log('🔗 Processing document embeddings...');
    const chunks = chunkText(cleanedTranscript, 1000, 200);
    const documentResult = await handleDocumentProcessing(
      supabaseClient,
      meetingId,
      cleanedTranscript,
      meetingData.title,
      new Date(meetingData.created_at).toLocaleDateString('fr-FR'),
      chunks
    );

    // 5. Générer les recommandations IA pour les tâches
    let recommendationResults = null;
    if (savedTasks.length > 0) {
      console.log(`⚡ Génération des recommandations pour ${savedTasks.length} tâches`);
      try {
        recommendationResults = await processTaskRecommendations(savedTasks, cleanedTranscript, meetingData, allParticipants);
        console.log(`✅ Recommandations traitées:`, recommendationResults);

        // NOUVELLE VÉRIFICATION: S'assurer que toutes les recommandations sont bien sauvegardées
        if (recommendationResults.successful > 0) {
          console.log('🔍 Vérification que toutes les recommandations sont bien en base...');
          
          let allRecommendationsSaved = false;
          let verificationAttempts = 0;
          const maxVerificationAttempts = 10;

          while (!allRecommendationsSaved && verificationAttempts < maxVerificationAttempts) {
            const { data: savedRecommendations, error: checkError } = await supabaseClient
              .from('todo_ai_recommendations')
              .select('todo_id')
              .in('todo_id', savedTasks.map(t => t.id));

            if (checkError) {
              console.error('❌ Erreur lors de la vérification des recommandations:', checkError);
              break;
            }

            const savedCount = savedRecommendations?.length || 0;
            console.log(`📊 Vérification ${verificationAttempts + 1}: ${savedCount}/${recommendationResults.successful} recommandations trouvées en base`);

            if (savedCount >= recommendationResults.successful) {
              allRecommendationsSaved = true;
              console.log('✅ TOUTES les recommandations sont confirmées en base de données');
            } else {
              verificationAttempts++;
              await new Promise(resolve => setTimeout(resolve, 500)); // Attendre 500ms avant la prochaine vérification
            }
          }

          if (!allRecommendationsSaved) {
            console.log('⚠️ Certaines recommandations ne sont pas encore visibles en base, mais on continue');
          }
        }

      } catch (recError) {
        console.error('❌ Erreur lors de la génération des recommandations:', recError);
        recommendationResults = { processed: 0, successful: 0, failed: savedTasks.length };
      }
    } else {
      console.log('⚠️ Aucune tâche sauvegardée pour générer des recommandations');
      recommendationResults = { processed: 0, successful: 0, failed: 0 };
    }

    // 6. DÉLAI OBLIGATOIRE de 5 secondes pour s'assurer que TOUT est stabilisé
    console.log('⏳ Attente obligatoire de 5 secondes pour stabilisation complète des données...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('✅ TOUT le traitement est COMPLETEMENT terminé après délai de sécurité - prêt pour redirection');

    return new Response(JSON.stringify({
      success: true,
      tasksCreated: savedTasks.length,
      documentProcessed: !!documentResult.id,
      chunksProcessed: documentResult.chunksCount,
      transcriptCleaned: true,
      summaryGenerated: true,
      recommendationsGenerated: recommendationResults?.successful > 0,
      recommendationStats: {
        processed: recommendationResults?.processed || 0,
        successful: recommendationResults?.successful || 0,
        failed: recommendationResults?.failed || 0
      },
      completelyFinished: true // Confirmé après délai de sécurité
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error processing transcript:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      completelyFinished: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
