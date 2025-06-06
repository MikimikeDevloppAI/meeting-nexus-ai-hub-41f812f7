
export async function processAIRecommendations(
  supabaseClient: any,
  savedTasks: any[],
  cleanedTranscript: string,
  meetingName: string,
  meetingDate: string,
  participantNames: string,
  participants: any[]
) {
  console.log('🤖 Generating AI recommendations using specialized agent...');
  console.log(`📋 Processing ${savedTasks.length} tasks for AI recommendations`);
  
  for (const task of savedTasks) {
    try {
      console.log(`🎯 Processing recommendations for task: ${task.description.substring(0, 50)}...`);
      
      // Appeler l'agent de recommandations contextuel amélioré
      const { data: recommendationResult, error: recommendationError } = await supabaseClient.functions.invoke('enhanced-todo-recommendations', {
        body: {
          todoId: task.id,
          description: task.description,
          meetingContext: `Réunion: ${meetingName} (${meetingDate}) - Participants: ${participantNames}`,
          meetingId: task.meeting_id,
          participantList: participantNames
        }
      });

      if (recommendationError) {
        console.error('❌ Error calling enhanced recommendation agent:', recommendationError);
        
        // Fallback vers l'agent de base si l'agent amélioré échoue
        console.log('🔄 Trying fallback recommendation agent...');
        const { data: fallbackResult, error: fallbackError } = await supabaseClient.functions.invoke('todo-recommendations', {
          body: {
            todoId: task.id,
            description: task.description,
            meetingContext: `Réunion: ${meetingName} (${meetingDate})`
          }
        });

        if (fallbackError) {
          console.error('❌ Fallback recommendation also failed:', fallbackError);
        } else {
          console.log('✅ Fallback recommendation generated successfully');
        }
        continue;
      }

      if (recommendationResult?.success) {
        console.log(`✅ Enhanced AI recommendation generated for task: ${task.description.substring(0, 50)}...`);
        if (recommendationResult.recommendation) {
          console.log(`📝 Recommendation preview: ${recommendationResult.recommendation.recommendation?.substring(0, 100)}...`);
        }
      } else {
        console.log(`ℹ️ No enhanced recommendation for task: ${task.description.substring(0, 50)}...`);
      }

      // Marquer que la recommandation IA a été générée
      await supabaseClient
        .from('todos')
        .update({ ai_recommendation_generated: true })
        .eq('id', task.id);

    } catch (recError) {
      console.error('❌ Error processing recommendation for task:', task.description.substring(0, 50), recError);
      
      // Marquer comme traité même en cas d'erreur pour éviter les boucles
      await supabaseClient
        .from('todos')
        .update({ ai_recommendation_generated: true })
        .eq('id', task.id);
    }
  }
  
  console.log(`🏁 AI recommendations processing completed for ${savedTasks.length} tasks`);
}
