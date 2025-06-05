
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
  
  for (const task of savedTasks) {
    try {
      console.log(`🎯 Processing recommendations for task: ${task.description}`);
      
      const { data: recommendationResult, error: recommendationError } = await supabaseClient.functions.invoke('task-recommendation-agent', {
        body: {
          task: { description: task.description },
          transcript: cleanedTranscript,
          meetingContext: {
            title: meetingName,
            date: meetingDate,
            participants: participantNames
          },
          participants: participants
        }
      });

      if (recommendationError) {
        console.error('Error calling task recommendation agent:', recommendationError);
        continue;
      }

      if (recommendationResult?.recommendation?.hasRecommendation) {
        const rec = recommendationResult.recommendation;
        
        const { error: saveError } = await supabaseClient
          .from('todo_ai_recommendations')
          .insert({
            todo_id: task.id,
            recommendation_text: rec.recommendation,
            email_draft: rec.needsExternalEmail ? rec.emailDraft : null
          });

        if (saveError) {
          console.error('Error saving AI recommendation:', saveError);
        } else {
          console.log(`✅ AI recommendation saved for task: ${task.description}`);
          if (rec.externalProviders?.length > 0) {
            console.log(`📋 Providers found: ${rec.externalProviders.join(', ')}`);
          }
        }
      } else {
        console.log(`ℹ️ No valuable recommendation for task: ${task.description}`);
      }

      await supabaseClient
        .from('todos')
        .update({ ai_recommendation_generated: true })
        .eq('id', task.id);

    } catch (recError) {
      console.error('Error processing recommendation for task:', task.description, recError);
    }
  }
}
