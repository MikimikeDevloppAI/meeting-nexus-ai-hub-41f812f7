
import { createSupabaseClient } from './database-service.ts'

export async function processTaskRecommendations(
  tasks: any[], 
  cleanedTranscript: string, 
  meetingData: any,
  participants: any[]
) {
  if (!tasks || tasks.length === 0) {
    console.log('⚡ Aucune tâche à traiter pour les recommandations');
    return { processed: 0, successful: 0, failed: 0 };
  }

  console.log(`⚡ Génération des recommandations pour ${tasks.length} tâches EN PARALLÈLE`);
  
  const supabaseClient = createSupabaseClient();
  
  // Traiter TOUTES les tâches en parallèle avec Promise.allSettled
  const recommendationPromises = tasks.map(async (task) => {
    try {
      console.log(`⚡ [PARALLÈLE] Génération recommandation pour tâche: ${task.description.substring(0, 50)}...`);
      
      const { data: recommendationResult, error: recError } = await supabaseClient.functions.invoke('task-recommendation-agent', {
        body: {
          task: { description: task.description },
          transcript: cleanedTranscript,
          meetingContext: {
            title: meetingData.title || 'Réunion',
            date: meetingData.created_at || new Date().toISOString(),
            participants: participants?.map(p => p.name).join(', ') || ''
          },
          participants: participants || []
        }
      });

      if (recError) {
        console.error(`❌ [PARALLÈLE] Erreur recommandation pour tâche ${task.id}:`, recError);
        return { taskId: task.id, success: false, error: recError };
      }

      const rec = recommendationResult?.recommendation;
      
      if (rec && rec.hasRecommendation) {
        try {
          // Sauvegarder la recommandation
          const { error: saveError } = await supabaseClient
            .from('todo_ai_recommendations')
            .insert({
              todo_id: task.id,
              recommendation_text: rec.recommendation,
              email_draft: rec.emailDraft || null
            });
          
          if (saveError) {
            console.error(`❌ [PARALLÈLE] Erreur sauvegarde recommandation pour tâche ${task.id}:`, saveError);
            return { taskId: task.id, success: false, error: saveError };
          }
          
          console.log(`✅ [PARALLÈLE] Recommandation sauvegardée pour tâche ${task.id}`);
          
          // MARQUER COMME TRAITÉ SEULEMENT SI SAUVEGARDE RÉUSSIE
          const { error: updateError } = await supabaseClient
            .from('todos')
            .update({ ai_recommendation_generated: true })
            .eq('id', task.id);
            
          if (updateError) {
            console.error(`❌ [PARALLÈLE] Erreur marquage tâche ${task.id}:`, updateError);
            return { taskId: task.id, success: false, error: updateError };
          } else {
            console.log(`✅ [PARALLÈLE] Tâche ${task.id} marquée comme traitée`);
            return { taskId: task.id, success: true };
          }
          
        } catch (saveError) {
          console.error(`❌ [PARALLÈLE] Erreur lors de la sauvegarde pour tâche ${task.id}:`, saveError);
          return { taskId: task.id, success: false, error: saveError };
        }
      } else {
        console.log(`⚠️ [PARALLÈLE] Pas de recommandation générée pour tâche ${task.id}`);
        return { taskId: task.id, success: false, error: 'No recommendation generated' };
      }
      
    } catch (error) {
      console.error(`❌ [PARALLÈLE] Erreur lors du traitement de la tâche ${task.id}:`, error);
      return { taskId: task.id, success: false, error };
    }
  });

  // Attendre que TOUTES les promesses se terminent (succès ou échec)
  console.log(`⏳ [PARALLÈLE] Attente de la completion de ${recommendationPromises.length} tâches...`);
  const results = await Promise.allSettled(recommendationPromises);
  
  // Analyser les résultats
  let successful = 0;
  let failed = 0;
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      if (result.value.success) {
        successful++;
        console.log(`✅ [RÉSULTAT] Tâche ${tasks[index].id}: SUCCÈS`);
      } else {
        failed++;
        console.log(`❌ [RÉSULTAT] Tâche ${tasks[index].id}: ÉCHEC -`, result.value.error);
      }
    } else {
      failed++;
      console.log(`❌ [RÉSULTAT] Tâche ${tasks[index].id}: REJETÉ -`, result.reason);
    }
  });
  
  console.log(`🏁 [PARALLÈLE] Traitement terminé: ${successful} succès, ${failed} échecs sur ${tasks.length} tâches`);
  
  return {
    processed: tasks.length,
    successful,
    failed,
    results: results.map((result, index) => ({
      taskId: tasks[index].id,
      status: result.status,
      success: result.status === 'fulfilled' ? result.value.success : false,
      error: result.status === 'fulfilled' ? result.value.error : result.reason
    }))
  };
}
