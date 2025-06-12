
export async function processAIRecommendations(
  supabaseClient: any,
  savedTasks: any[],
  cleanedTranscript: string,
  meetingName: string,
  meetingDate: string,
  participantNames: string,
  participants: any[]
) {
  console.log('🤖 Génération recommandations IA intelligentes en parallèle...');
  console.log(`📋 Traitement de ${savedTasks.length} tâches`);
  
  // Traiter toutes les tâches en parallèle avec gestion d'erreur individuelle
  const recommendationPromises = savedTasks.map(async (task) => {
    try {
      console.log(`🎯 Analyse intelligente pour: ${task.description.substring(0, 50)}...`);
      
      // Appel à l'agent intelligent avec retry
      const result = await callRecommendationAgentWithRetry(supabaseClient, {
        task: { description: task.description },
        transcript: cleanedTranscript,
        meetingContext: {
          title: meetingName,
          date: meetingDate,
          participants: participantNames
        },
        participants: participants
      });

      if (result.error) {
        console.error('❌ Erreur agent recommandations pour tâche:', task.id, result.error);
        return { taskId: task.id, success: false, error: result.error };
      }

      const rec = result.data?.recommendation;
      
      if (rec && (rec.hasRecommendation || rec.needsEmail)) {
        console.log(`✅ Recommandation intelligente pour: ${task.description.substring(0, 50)}...`);
        console.log(`💡 Valeur ajoutée: ${rec.valueAddedReason || 'Non spécifiée'}`);
        
        // Construire le commentaire simplifié
        let comment = '';
        
        if (rec.hasRecommendation && rec.recommendation) {
          comment += `💡 **Recommandation IA :**\n\n${rec.recommendation}`;
          
          if (rec.valueAddedReason) {
            comment += `\n\n✨ **Valeur ajoutée :** ${rec.valueAddedReason}`;
          }
        }
        
        if (rec.estimatedCost) {
          comment += `\n\n💰 **Coût estimé :** ${rec.estimatedCost}`;
        }
        
        if (rec.contacts?.length > 0) {
          comment += `\n\n📞 **Contacts spécialisés :**`;
          rec.contacts.forEach((contact: any) => {
            comment += `\n• **${contact.name}**`;
            if (contact.phone) comment += `\n  📞 ${contact.phone}`;
            if (contact.email) comment += `\n  ✉️ ${contact.email}`;
            if (contact.website) comment += `\n  🌐 ${contact.website}`;
            if (contact.address) comment += `\n  📍 ${contact.address}`;
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

        // Sauvegarder la recommandation simplifiée
        const recommendationData: any = {
          todo_id: task.id,
          recommendation_text: rec.recommendation || 'Voir email pré-rédigé ou conseils spécialisés.',
          email_draft: rec.needsEmail ? rec.emailDraft : null
        };

        await supabaseClient
          .from('todo_ai_recommendations')
          .insert(recommendationData);
        
        console.log(`✅ Recommandation intelligente sauvegardée pour tâche ${task.id}`);
        return { taskId: task.id, success: true };
      } else {
        console.log(`ℹ️ Aucune recommandation pertinente pour: ${task.description.substring(0, 50)}...`);
        return { taskId: task.id, success: true, noRecommendation: true };
      }

    } catch (recError) {
      console.error('❌ Erreur traitement recommandation:', task.description.substring(0, 50), recError);
      return { taskId: task.id, success: false, error: recError };
    }
  });

  // Attendre toutes les recommandations en parallèle
  const results = await Promise.all(recommendationPromises);
  
  // Marquer toutes les tâches comme traitées
  const updatePromises = savedTasks.map(task => 
    supabaseClient
      .from('todos')
      .update({ ai_recommendation_generated: true })
      .eq('id', task.id)
  );
  
  await Promise.all(updatePromises);
  
  // Compter les résultats
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const withRecommendations = results.filter(r => r.success && !r.noRecommendation).length;
  
  console.log(`🏁 Traitement recommandations terminé: ${successful}/${savedTasks.length} succès, ${withRecommendations} avec recommandations, ${failed} échecs`);
}

// Fonction utilitaire avec retry
async function callRecommendationAgentWithRetry(supabaseClient: any, payload: any, maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await supabaseClient.functions.invoke('task-recommendation-agent', {
        body: payload
      });
      
      if (!result.error) {
        return result;
      }
      
      if (attempt < maxRetries) {
        console.log(`⚠️ Tentative ${attempt} échouée, retry dans 1s...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        return result;
      }
    } catch (error) {
      if (attempt < maxRetries) {
        console.log(`⚠️ Erreur tentative ${attempt}, retry dans 1s...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        return { error };
      }
    }
  }
}
