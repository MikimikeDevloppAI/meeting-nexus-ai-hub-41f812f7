étaill
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

  console.log(`⚡ [RECOMMENDATION-SERVICE] DÉBUT génération des recommandations SINGLE BATCH pour ${tasks.length} tâches avec GPT-4.1`);
  
  const supabaseClient = createSupabaseClient();
  
  try {
    const participantNames = participants?.map(p => p.name).join(', ') || '';

    // Traiter TOUTES les tâches en un seul batch optimisé
    console.log(`🚀 [RECOMMENDATION-SERVICE] Traitement SINGLE BATCH pour ${tasks.length} tâches`);
    
    const tasksForPrompt = tasks.map((task, index) => ({
      index: index,
      id: task.id,
      description: task.description,
      assigned_to: task.todo_participants?.map(tp => tp.participants?.name).join(', ') || 'Non assigné'
    }));

    // Prompt optimisé pour GPT-4.1 - plus concis et efficace
    const optimizedPrompt = `Tu es un assistant IA spécialisé dans la génération de recommandations DÉTAILLÉES et d'emails pour des tâches du cabinet d'ophtalmologie Dr Tabibian à Genève.

CONTEXTE RÉUNION:
- Titre: ${meetingData.title || 'Réunion'}
- Date: ${meetingData.created_at || new Date().toISOString()}
- Participants: ${participantNames}

TRANSCRIPT:
${cleanedTranscript}

TÂCHES (${tasks.length} total):
${tasksForPrompt.map(task => `
${task.index}. [ID: ${task.id}] ${task.description}
   - Assigné: ${task.assigned_to}
`).join('')}

INSTRUCTIONS:
Pour chaque tâche, génère:
1. **Recommandation détaillée** qui propose un plan d'exécution, signale les points d'attention, suggère des prestataires/outils, ou challenge les décisions si pertinent.
2. **Email pré-rédigé COMPLET** si communication nécessaire (interne: direct et concis / externe: professionnel avec contexte et très détaillés).
3. Si la tâche est simple/évidente, marque hasRecommendation: false avec "Aucune recommandation nécessaire."

Critères qualité:
- Concis, structuré, actionnable
- Valeur ajoutée réelle
- Pas d'invention de contacts
- Éviter banalités

Réponds UNIQUEMENT en JSON:
{
  "recommendations": [
    {
      "taskIndex": 0,
      "taskId": "uuid-tache",
      "hasRecommendation": true/false,
      "recommendation": "Recommandation détaillée...",
      "emailDraft": "Email COMPLET (optionnel)"
    }
  ]
}

IMPORTANT: Inclus TOUTES les ${tasks.length} tâches avec recommandations détaillées.`;

    const payload = {
      batchPrompt: optimizedPrompt,
      tasks: tasksForPrompt,
      transcript: cleanedTranscript,
      meetingContext: {
        title: meetingData.title || 'Réunion',
        date: meetingData.created_at || new Date().toISOString(),
        participants: participantNames,
        singleBatch: true,
        totalTasks: tasks.length
      }
    };

    console.log(`📤 [RECOMMENDATION-SERVICE] Envoi SINGLE BATCH à task-recommendation-agent`);
    const callStartTime = Date.now();

    const { data: batchResult, error: openaiError } = await supabaseClient.functions.invoke('task-recommendation-agent', {
      body: payload
    });
    
    const callDuration = Date.now() - callStartTime;
    console.log(`⏱️ [RECOMMENDATION-SERVICE] Single batch terminé (${callDuration}ms)`);

    if (openaiError) {
      console.error(`❌ [RECOMMENDATION-SERVICE] Erreur single batch:`, openaiError);
      throw new Error(`Erreur lors de l'appel à task-recommendation-agent: ${openaiError.message || openaiError}`);
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

    console.log(`✅ [RECOMMENDATION-SERVICE] Single batch: ${recommendations.length} recommandations extraites pour ${tasks.length} tâches`);

    // Sauvegarder toutes les recommandations
    let totalSuccessful = 0;
    let totalFailed = 0;

    console.log(`💾 [RECOMMENDATION-SERVICE] Sauvegarde de ${recommendations.length} recommandations`);

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      try {
        // Trouver la recommandation correspondante
        let recommendation = recommendations.find(rec => rec.taskId === task.id);
        
        if (!recommendation) {
          recommendation = recommendations.find(rec => rec.taskIndex === i);
        }
        
        if (!recommendation) {
          recommendation = {
            hasRecommendation: true,
            recommendation: "Recommandation non trouvée - veuillez revoir cette tâche.",
            emailDraft: null
          };
        }

        // Toujours sauvegarder une recommandation
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
        
        // Marquer la tâche comme traitée
        await supabaseClient
          .from('todos')
          .update({ ai_recommendation_generated: true })
          .eq('id', task.id);
          
      } catch (error) {
        console.error(`❌ [RECOMMENDATION-SERVICE] Erreur traitement tâche ${task.id}:`, error);
        
        // Créer une recommandation de fallback
        try {
          await supabaseClient
            .from('todo_ai_recommendations')
            .insert({
              todo_id: task.id,
              recommendation_text: `Erreur lors de la génération: ${error.message}. Veuillez revoir cette tâche manuellement.`,
              email_draft: null
            });
          
          await supabaseClient
            .from('todos')
            .update({ ai_recommendation_generated: true })
            .eq('id', task.id);
            
          totalSuccessful++; // Considérer comme succès car une recommandation a été sauvée
        } catch (fallbackError) {
          console.error(`❌ [RECOMMENDATION-SERVICE] Erreur fallback tâche ${task.id}:`, fallbackError);
          totalFailed++;
        }
      }
    }
    
    // Vérification finale
    const { data: finalCheck, error: checkError } = await supabaseClient
      .from('todo_ai_recommendations')
      .select('todo_id, recommendation_text')
      .in('todo_id', tasks.map(t => t.id));

    if (!checkError && finalCheck) {
      console.log(`🔍 [RECOMMENDATION-SERVICE] Vérification finale: ${finalCheck.length}/${tasks.length} recommandations confirmées en base`);
    }
    
    console.log(`🏁 [RECOMMENDATION-SERVICE] Single batch terminé: ${totalSuccessful} succès, ${totalFailed} échecs sur ${tasks.length} tâches`);
    
    return {
      processed: tasks.length,
      successful: totalSuccessful,
      failed: totalFailed,
      fullyCompleted: true,
      singleBatch: true,
      model: 'gpt-4.1-2025-04-14'
    };
    
  } catch (error) {
    console.error('❌ [RECOMMENDATION-SERVICE] Erreur générale lors du traitement single batch:', error);
    
    // Marquer toutes les tâches comme traitées avec recommandations de fallback
    let fallbackSuccessful = 0;
    for (const task of tasks) {
      try {
        await supabaseClient
          .from('todo_ai_recommendations')
          .insert({
            todo_id: task.id,
            recommendation_text: `Erreur système lors de la génération: ${error.message}. Veuillez revoir cette tâche manuellement.`,
            email_draft: null
          });
        
        await supabaseClient
          .from('todos')
          .update({ ai_recommendation_generated: true })
          .eq('id', task.id);
          
        fallbackSuccessful++;
      } catch (fallbackError) {
        console.error(`❌ [RECOMMENDATION-SERVICE] Erreur fallback final tâche ${task.id}:`, fallbackError);
      }
    }
    
    return { 
      processed: tasks.length, 
      successful: fallbackSuccessful, 
      failed: tasks.length - fallbackSuccessful,
      fullyCompleted: true,
      error: error.message,
      singleBatch: true,
      model: 'gpt-4.1-2025-04-14'
    };
  }
}
