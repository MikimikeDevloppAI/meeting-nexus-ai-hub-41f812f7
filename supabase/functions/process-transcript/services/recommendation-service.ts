
import { createSupabaseClient } from './database-service.ts'

export async function processTaskRecommendations(
  tasks: any[], 
  cleanedTranscript: string, 
  meetingData: any,
  participants: any[]
) {
  if (!tasks || tasks.length === 0) {
    console.log('⚡ Aucune tâche à traiter pour les recommandations');
    return;
  }

  console.log(`⚡ Génération des recommandations pour ${tasks.length} tâches`);
  
  const supabaseClient = createSupabaseClient();
  
  // Traiter chaque tâche individuellement
  for (const task of tasks) {
    try {
      console.log(`⚡ Génération recommandation pour tâche: ${task.description.substring(0, 50)}...`);
      
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
        console.error('❌ Erreur recommandation pour tâche:', task.id, recError);
        // Ne pas marquer comme traité si erreur
        continue;
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
            console.error('❌ Erreur sauvegarde recommandation pour tâche:', task.id, saveError);
            continue;
          }
          
          console.log(`✅ Recommandation sauvegardée pour tâche ${task.id}`);
          
          // MARQUER COMME TRAITÉ SEULEMENT SI SAUVEGARDE RÉUSSIE
          const { error: updateError } = await supabaseClient
            .from('todos')
            .update({ ai_recommendation_generated: true })
            .eq('id', task.id);
            
          if (updateError) {
            console.error('❌ Erreur marquage tâche:', task.id, updateError);
          } else {
            console.log(`✅ Tâche ${task.id} marquée comme traitée`);
          }
          
        } catch (saveError) {
          console.error(`❌ Erreur lors de la sauvegarde pour tâche ${task.id}:`, saveError);
        }
      } else {
        console.log(`⚠️ Pas de recommandation générée pour tâche ${task.id}`);
        // Ne pas marquer comme traité si pas de recommandation
      }
      
    } catch (error) {
      console.error(`❌ Erreur lors du traitement de la tâche ${task.id}:`, error);
      // Ne pas marquer comme traité si erreur globale
    }
  }
  
  console.log('🏁 Traitement des recommandations terminé');
}
