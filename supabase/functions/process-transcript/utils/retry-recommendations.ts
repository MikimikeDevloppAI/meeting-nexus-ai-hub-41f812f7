
export async function retryMissingRecommendations(supabaseClient: any, meetingId?: string) {
  console.log('🔄 Recherche des tâches sans recommandations...');
  
  let query = supabaseClient
    .from('todos')
    .select('*')
    .eq('ai_recommendation_generated', false);
    
  if (meetingId) {
    query = query.eq('meeting_id', meetingId);
  }
  
  const { data: tasksWithoutRec, error } = await query;
  
  if (error) {
    console.error('❌ Erreur lors de la recherche des tâches:', error);
    return;
  }
  
  if (!tasksWithoutRec || tasksWithoutRec.length === 0) {
    console.log('✅ Toutes les tâches ont déjà des recommandations');
    return;
  }
  
  console.log(`🎯 ${tasksWithoutRec.length} tâches trouvées sans recommandations`);
  
  // Obtenir les participants pour le contexte
  const { data: participants } = await supabaseClient
    .from('participants')
    .select('*')
    .order('name');
  
  // Traiter chaque tâche individuellement
  for (const task of tasksWithoutRec) {
    try {
      console.log(`⚡ Génération recommandation pour tâche: ${task.description.substring(0, 50)}...`);
      
      const { data: recommendationResult, error: recError } = await supabaseClient.functions.invoke('task-recommendation-agent', {
        body: {
          task: { description: task.description },
          transcript: '', // Pas de transcript disponible pour retry
          meetingContext: {
            title: 'Retry Recommendations',
            date: new Date().toISOString(),
            participants: participants?.map(p => p.name).join(', ') || ''
          },
          participants: participants || []
        }
      });

      if (recError) {
        console.error('❌ Erreur recommandation pour tâche:', task.id, recError);
        continue;
      }

      const rec = recommendationResult?.recommendation;
      
      if (rec && rec.hasRecommendation) {
        // Sauvegarder la recommandation
        await supabaseClient
          .from('todo_ai_recommendations')
          .insert({
            todo_id: task.id,
            recommendation_text: rec.recommendation,
            email_draft: rec.emailDraft || null
          });
        
        console.log(`✅ Recommandation générée pour tâche ${task.id}`);
      }
      
      // Marquer comme traité
      await supabaseClient
        .from('todos')
        .update({ ai_recommendation_generated: true })
        .eq('id', task.id);
        
    } catch (error) {
      console.error(`❌ Erreur lors du retry pour tâche ${task.id}:`, error);
    }
  }
  
  console.log('🏁 Retry des recommandations terminé');
}
