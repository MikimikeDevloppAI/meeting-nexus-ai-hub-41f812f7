
export async function processAIRecommendations(
  supabaseClient: any,
  savedTasks: any[],
  cleanedTranscript: string,
  meetingName: string,
  meetingDate: string,
  participantNames: string,
  participants: any[]
) {
  console.log('🤖 Génération recommandations IA avec agent unique intelligent...');
  console.log(`📋 Traitement de ${savedTasks.length} tâches`);
  
  for (const task of savedTasks) {
    try {
      console.log(`🎯 Analyse intelligente pour: ${task.description.substring(0, 50)}...`);
      
      // Appel direct à l'agent unique intelligent
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
        console.error('❌ Erreur agent recommandations:', recommendationError);
        
        // Marquer comme traité même en cas d'erreur
        await supabaseClient
          .from('todos')
          .update({ ai_recommendation_generated: true })
          .eq('id', task.id);
        continue;
      }

      const rec = recommendationResult?.recommendation;
      
      if (rec && (rec.hasRecommendation || rec.needsEmail)) {
        console.log(`✅ Traitement pour tâche: ${task.description.substring(0, 50)}...`);
        
        // Construire le commentaire avec les informations pertinentes
        let comment = '';
        
        if (rec.hasRecommendation && rec.recommendation) {
          comment += `💡 **${rec.recommendationType === 'action_plan' ? 'Plan d\'Action' : 
                                rec.recommendationType === 'ai_assistance' ? 'Assistance IA' : 
                                'Contacts & Fournisseurs'} :**\n\n${rec.recommendation}`;
        }
        
        if (rec.estimatedCost) {
          comment += `\n\n💰 **Coût estimé :** ${rec.estimatedCost}`;
        }
        
        if (rec.contacts?.length > 0) {
          comment += `\n\n📞 **Contacts identifiés :**`;
          rec.contacts.forEach((contact: any) => {
            comment += `\n• **${contact.name}**`;
            if (contact.phone) comment += `\n  Tél: ${contact.phone}`;
            if (contact.email) comment += `\n  Email: ${contact.email}`;
            if (contact.website) comment += `\n  Web: ${contact.website}`;
            if (contact.address) comment += `\n  Adresse: ${contact.address}`;
          });
        }

        // Ajouter le commentaire si nécessaire
        if (comment) {
          await supabaseClient
            .from('todo_comments')
            .insert({
              todo_id: task.id,
              user_id: '00000000-0000-0000-0000-000000000000', // System user
              comment: comment
            });
        }

        // Sauvegarder la recommandation
        const recommendationData: any = {
          todo_id: task.id,
          recommendation_text: rec.recommendation || 'Aucune recommandation spécifique, voir email pré-rédigé.',
          email_draft: rec.needsEmail ? rec.emailDraft : null
        };

        await supabaseClient
          .from('todo_ai_recommendations')
          .insert(recommendationData);
        
        console.log(`✅ ${rec.hasRecommendation ? 'Recommandation' : ''} ${rec.needsEmail ? 'Email' : ''} ajouté(e)`);
      } else {
        console.log(`ℹ️ Aucune recommandation nécessaire pour: ${task.description.substring(0, 50)}...`);
      }

      // Marquer que la recommandation IA a été générée
      await supabaseClient
        .from('todos')
        .update({ ai_recommendation_generated: true })
        .eq('id', task.id);

    } catch (recError) {
      console.error('❌ Erreur traitement recommandation:', task.description.substring(0, 50), recError);
      
      // Marquer comme traité même en cas d'erreur
      await supabaseClient
        .from('todos')
        .update({ ai_recommendation_generated: true })
        .eq('id', task.id);
    }
  }
  
  console.log(`🏁 Traitement recommandations terminé pour ${savedTasks.length} tâches`);
}
