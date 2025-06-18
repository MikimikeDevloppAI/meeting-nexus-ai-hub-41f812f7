
import { createSupabaseClient } from './database-service.ts'

export async function processTaskRecommendations(
  tasks: any[], 
  cleanedTranscript: string, 
  meetingData: any,
  participants: any[]
) {
  if (!tasks || tasks.length === 0) {
    console.log('⚡ [RECOMMENDATION-SERVICE] Aucune tâche à traiter pour les recommandations');
    return { processed: 0, successful: 0, failed: 0, fullyCompleted: true };
  }

  console.log(`⚡ [RECOMMENDATION-SERVICE] DÉBUT génération des recommandations pour ${tasks.length} tâches par batch de 5`);
  
  const supabaseClient = createSupabaseClient();
  const BATCH_SIZE = 5;
  const batches = [];
  
  // Diviser les tâches en groupes de 5
  for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
    batches.push(tasks.slice(i, i + BATCH_SIZE));
  }
  
  console.log(`📊 [RECOMMENDATION-SERVICE] ${batches.length} batches créés (${BATCH_SIZE} tâches par batch)`);

  try {
    const participantNames = participants?.map(p => p.name).join(', ') || '';

    // Traiter tous les batches en parallèle
    const batchPromises = batches.map(async (batchTasks, batchIndex) => {
      console.log(`🚀 [RECOMMENDATION-SERVICE] Démarrage batch ${batchIndex + 1}/${batches.length} (${batchTasks.length} tâches)`);
      
      const tasksForPrompt = batchTasks.map((task, index) => ({
        index: index,
        id: task.id,
        description: task.description,
        assigned_to: task.todo_participants?.map(tp => tp.participants?.name).join(', ') || 'Non assigné'
      }));

      // Créer un prompt optimisé pour ce batch spécifique
      const batchPrompt = `
Tu es un assistant IA spécialisé dans la génération de recommandations DÉTAILLÉES pour des tâches issues de réunions du cabinet d'ophtalmologie Dr Tabibian à Genève.

CONTEXTE DE LA RÉUNION :
- Titre: ${meetingData.title || 'Réunion'}
- Date: ${meetingData.created_at || new Date().toISOString()}
- Participants: ${participantNames}

TRANSCRIPT DE LA RÉUNION :
${cleanedTranscript}

TÂCHES À ANALYSER (Batch ${batchIndex + 1} - ${batchTasks.length} tâches) :
${tasksForPrompt.map(task => `
${task.index}. [ID: ${task.id}] ${task.description}
   - Assigné à: ${task.assigned_to}
`).join('')}

INSTRUCTIONS :
Pour chaque tâche, génère une recommandation DÉTAILLÉE qui :
1. Propose un **plan d'exécution clair** si complexe
2. **Signale les éléments importants** (contraintes, risques, coordination)
3. **Suggère des prestataires/outils** utiles
4. **Challenge les décisions** si nécessaire
5. Génère un email pré-rédigé si communication nécessaire
6. Répond "Aucune recommandation." si la tâche est évidente

Réponds UNIQUEMENT en JSON avec cette structure EXACTE :
{
  "recommendations": [
    {
      "taskIndex": 0,
      "taskId": "uuid-de-la-tache",
      "hasRecommendation": true,
      "recommendation": "Recommandation détaillée...",
      "emailDraft": "Email COMPLET (optionnel)"
    }
  ]
}

ASSURE-TOI d'inclure TOUTES les ${batchTasks.length} tâches de ce batch.`;

      const payload = {
        batchPrompt,
        tasks: tasksForPrompt,
        transcript: cleanedTranscript,
        meetingContext: {
          title: meetingData.title || 'Réunion',
          date: meetingData.created_at || new Date().toISOString(),
          participants: participantNames,
          batchInfo: `Batch ${batchIndex + 1}/${batches.length}`
        }
      };

      console.log(`📤 [RECOMMENDATION-SERVICE] Envoi batch ${batchIndex + 1} à task-recommendation-agent`);
      const callStartTime = Date.now();

      const { data: batchResult, error: openaiError } = await supabaseClient.functions.invoke('task-recommendation-agent', {
        body: payload
      });
      
      const callDuration = Date.now() - callStartTime;
      console.log(`⏱️ [RECOMMENDATION-SERVICE] Batch ${batchIndex + 1} terminé (${callDuration}ms)`);

      if (openaiError) {
        console.error(`❌ [RECOMMENDATION-SERVICE] Erreur batch ${batchIndex + 1}:`, openaiError);
        // Retourner des recommandations par défaut pour ce batch
        return {
          batchIndex,
          recommendations: batchTasks.map((task, index) => ({
            taskIndex: index,
            taskId: task.id,
            hasRecommendation: false,
            recommendation: "Erreur lors de la génération de la recommandation",
            emailDraft: null
          })),
          success: false
        };
      }

      // Extraire les recommandations
      let recommendations = [];
      if (batchResult?.recommendation?.recommendations) {
        recommendations = batchResult.recommendation.recommendations;
      } else if (batchResult?.recommendations) {
        recommendations = batchResult.recommendations;
      } else if (Array.isArray(batchResult)) {
        recommendations = batchResult;
      }

      console.log(`✅ [RECOMMENDATION-SERVICE] Batch ${batchIndex + 1}: ${recommendations.length} recommandations extraites`);

      return {
        batchIndex,
        recommendations,
        tasks: batchTasks,
        success: true
      };
    });

    // Attendre que tous les batches soient terminés
    console.log(`🔄 [RECOMMENDATION-SERVICE] Traitement de ${batches.length} batches en parallèle...`);
    const batchResults = await Promise.all(batchPromises);
    console.log(`✅ [RECOMMENDATION-SERVICE] Tous les batches terminés`);

    // Sauvegarder toutes les recommandations
    let totalSuccessful = 0;
    let totalFailed = 0;

    for (const batchResult of batchResults) {
      const { batchIndex, recommendations, tasks: batchTasks, success } = batchResult;
      
      console.log(`💾 [RECOMMENDATION-SERVICE] Sauvegarde batch ${batchIndex + 1}: ${recommendations.length} recommandations`);

      for (let i = 0; i < batchTasks.length; i++) {
        const task = batchTasks[i];
        try {
          // Trouver la recommandation correspondante
          let recommendation = recommendations.find(rec => rec.taskId === task.id);
          
          if (!recommendation) {
            recommendation = recommendations.find(rec => rec.taskIndex === i);
          }
          
          if (!recommendation) {
            recommendation = {
              hasRecommendation: false,
              recommendation: "Recommandation non trouvée dans la réponse du batch",
              emailDraft: null
            };
          }

          if (recommendation.hasRecommendation !== false) {
            // Sauvegarder la recommandation
            const { error: saveError } = await supabaseClient
              .from('todo_ai_recommendations')
              .insert({
                todo_id: task.id,
                recommendation_text: recommendation.recommendation || "Recommandation générée avec succès",
                email_draft: recommendation.emailDraft || null
              });
            
            if (saveError) {
              console.error(`❌ [RECOMMENDATION-SERVICE] Erreur sauvegarde tâche ${task.id}:`, saveError);
              totalFailed++;
            } else {
              console.log(`✅ [RECOMMENDATION-SERVICE] Recommandation sauvegardée pour tâche ${task.id}`);
              totalSuccessful++;
            }
          } else {
            // Créer une recommandation par défaut
            const { error: saveError } = await supabaseClient
              .from('todo_ai_recommendations')
              .insert({
                todo_id: task.id,
                recommendation_text: recommendation.recommendation || "Cette tâche nécessite votre attention.",
                email_draft: null
              });
            
            if (saveError) {
              totalFailed++;
            } else {
              totalSuccessful++;
            }
          }
          
          // Marquer la tâche comme traitée
          await supabaseClient
            .from('todos')
            .update({ ai_recommendation_generated: true })
            .eq('id', task.id);
            
        } catch (error) {
          console.error(`❌ [RECOMMENDATION-SERVICE] Erreur traitement tâche ${task.id}:`, error);
          
          // Marquer quand même comme traitée
          try {
            await supabaseClient
              .from('todos')
              .update({ ai_recommendation_generated: true })
              .eq('id', task.id);
          } catch (updateError) {
            console.error(`❌ [RECOMMENDATION-SERVICE] Erreur marquage tâche ${task.id}:`, updateError);
          }
          
          totalFailed++;
        }
      }
    }
    
    console.log(`🏁 [RECOMMENDATION-SERVICE] Traitement par batches terminé: ${totalSuccessful} succès, ${totalFailed} échecs sur ${tasks.length} tâches`);
    
    return {
      processed: tasks.length,
      successful: totalSuccessful,
      failed: totalFailed,
      fullyCompleted: true,
      batchInfo: {
        totalBatches: batches.length,
        batchSize: BATCH_SIZE
      }
    };
    
  } catch (error) {
    console.error('❌ [RECOMMENDATION-SERVICE] Erreur générale lors du traitement par batches:', error);
    
    // Marquer toutes les tâches comme traitées
    for (const task of tasks) {
      try {
        await supabaseClient
          .from('todos')
          .update({ ai_recommendation_generated: true })
          .eq('id', task.id);
      } catch (updateError) {
        console.error(`❌ [RECOMMENDATION-SERVICE] Erreur final marquage tâche ${task.id}:`, updateError);
      }
    }
    
    return { 
      processed: tasks.length, 
      successful: 0, 
      failed: tasks.length,
      fullyCompleted: true,
      error: error.message 
    };
  }
}
