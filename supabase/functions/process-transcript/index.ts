
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
      const tasksData = JSON.parse(tasksResponse);
      extractedTasks = tasksData.tasks || [];
    } catch (parseError) {
      console.error('❌ Error parsing tasks JSON:', parseError);
      console.log('📄 Raw tasks response:', tasksResponse);
    }

    // Sauvegarder les tâches
    const savedTasks = [];
    if (extractedTasks.length > 0) {
      console.log(`💾 Saving ${extractedTasks.length} tasks...`);
      for (const task of extractedTasks) {
        try {
          const savedTask = await saveTask(supabaseClient, task, meetingId, meetingParticipants || []);
          if (savedTask) {
            savedTasks.push(savedTask);
          }
        } catch (taskError) {
          console.error('❌ Error saving task:', taskError);
        }
      }
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

    // 5. Générer les recommandations IA pour les tâches - ATTENDRE QUE TOUT SOIT FINI
    let recommendationsGenerated = false;
    if (savedTasks.length > 0) {
      console.log(`⚡ Génération des recommandations pour ${savedTasks.length} tâches - ATTENTE COMPLETE`);
      try {
        await processTaskRecommendations(savedTasks, cleanedTranscript, meetingData, allParticipants);
        recommendationsGenerated = true;
        console.log('✅ TOUTES les recommandations ont été traitées');
      } catch (recError) {
        console.error('❌ Erreur lors de la génération des recommandations:', recError);
        recommendationsGenerated = false;
      }
    }

    // 6. Attendre un délai supplémentaire pour s'assurer que toutes les opérations async sont terminées
    console.log('⏳ Attente finale pour stabilisation des données...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('✅ TOUT le traitement est COMPLETEMENT terminé - prêt pour redirection');

    return new Response(JSON.stringify({
      success: true,
      tasksCreated: savedTasks.length,
      documentProcessed: !!documentResult.id,
      chunksProcessed: documentResult.chunksCount,
      transcriptCleaned: true,
      summaryGenerated: true,
      recommendationsGenerated: recommendationsGenerated,
      completelyFinished: true // Nouveau flag pour confirmer que TOUT est fini
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
