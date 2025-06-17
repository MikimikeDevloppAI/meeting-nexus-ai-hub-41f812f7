
import { createSupabaseClient } from './database-service.ts'

export async function processTaskRecommendations(
  tasks: any[], 
  cleanedTranscript: string, 
  meetingData: any,
  participants: any[]
) {
  if (!tasks || tasks.length === 0) {
    console.log('⚡ Aucune tâche à traiter pour les recommandations');
    return { processed: 0, successful: 0, failed: 0, fullyCompleted: true };
  }

  console.log(`⚡ DÉBUT génération des recommandations pour ${tasks.length} tâches`);
  
  const supabaseClient = createSupabaseClient();

  try {
    // Préparer les données pour le prompt
    const tasksForPrompt = tasks.map((task, index) => ({
      index: index,
      id: task.id,
      description: task.description,
      assigned_to: task.todo_participants?.map(tp => tp.participants?.name).join(', ') || 'Non assigné'
    }));

    const participantNames = participants?.map(p => p.name).join(', ') || '';

    console.log(`📝 Préparation du prompt pour ${tasksForPrompt.length} tâches`);

    // Créer un prompt pour traiter toutes les tâches d'un coup avec instructions pour réponses détaillées
    const batchPrompt = `
Tu es un assistant IA spécialisé dans la génération de recommandations TRÈS DÉTAILLÉES pour des tâches issues de réunions du cabinet d'ophtalmologie Dr Tabibian à Genève.

Ton objectif est d'analyser la tâche et de :
1. Proposer un **plan d'exécution clair** si la tâche est complexe ou nécessite plusieurs étapes.
2. **Signaler les éléments importants à considérer** (contraintes réglementaires, risques, coordination nécessaire, points d'attention).
3. **Suggérer des prestataires, fournisseurs ou outils** qui peuvent faciliter l’exécution.
4. Si pertinent, **challenger les décisions prises** ou proposer une alternative plus efficace ou moins risquée.
5. Ne faire **aucune recommandation** si la tâche est simple ou évidente (dans ce cas, répondre uniquement : “Aucune recommandation.”).
6. Un email pré-rédigé COMPLET qui doit comprendre à qui doit être fait la communication et adapter le ton si l'email doit être envoyé en interne ou en externe. Si l'email est pour l'interne sois direct, si il est destiné à l'externe donne tout le contexte nécessaire DÉTAILLÉ pour que le fournisseur externe comprenne parfaitement la demande et soit professionnel.

Critères de qualité :
- Sois **concis, structuré et actionnable**.
- Fournis uniquement des recommandations qui **ajoutent une vraie valeur**.
- N’invente pas de contacts si tu n’en as pas.
- Évite les banalités ou les évidences.
CONTEXTE DE LA RÉUNION :
- Titre: ${meetingData.title || 'Réunion'}
- Date: ${meetingData.created_at || new Date().toISOString()}
- Participants: ${participantNames}

TRANSCRIPT DE LA RÉUNION :
${cleanedTranscript}

TÂCHES À ANALYSER (${tasks.length} tâches) :
${tasksForPrompt.map(task => `
${task.index}. [ID: ${task.id}] ${task.description}
   - Assigné à: ${task.assigned_to}
`).join('')}



7. Un email pré-rédigé COMPLET qui doit comprendre à qui doit être fait la communication et adapter le ton si l'email doit être envoyé en interne ou en externe. Si l'email est pour l'interne sois direct, si il est destiné à l'externe donne tout le contexte nécessaire DÉTAILLÉ pour que le fournisseur externe comprenne parfaitement la demande et soit professionnel.

IMPORTANT : 
- Traite TOUTES les tâches (indices 0 à ${tasks.length - 1})
- Sois EXTRÊMEMENT DÉTAILLÉ dans chaque recommandation
- Développe tous les aspects pertinents en profondeur

Réponds UNIQUEMENT en JSON avec cette structure EXACTE :
{
  "recommendations": [
    {
      "taskIndex": 0,
      "taskId": "uuid-de-la-tache",
      "hasRecommendation": true,
      "recommendation": "Recommandation ici...",
      "emailDraft": "Email pré-rédigé COMPLET et DÉTAILLÉ (optionnel mais fortement recommandé)"
    },
    {
      "taskIndex": 1,
      "taskId": "uuid-de-la-tache",
      "hasRecommendation": true,
      "recommendation": "Recommandation DÉTAILLÉE pour la tâche 2...",
      "emailDraft": null
    }
  ]
}

ASSURE-TOI d'inclure TOUTES les ${tasks.length} tâches dans ta réponse avec des recommandations TRÈS DÉTAILLÉES.`;

    console.log(`⏳ Appel OpenAI pour ${tasks.length} tâches en batch...`);

    // Appel unique à OpenAI pour toutes les tâches
    const { data: batchResult, error: openaiError } = await supabaseClient.functions.invoke('task-recommendation-agent', {
      body: {
        batchPrompt,
        tasks: tasksForPrompt,
        transcript: cleanedTranscript,
        meetingContext: {
          title: meetingData.title || 'Réunion',
          date: meetingData.created_at || new Date().toISOString(),
          participants: participantNames
        }
      }
    });

    if (openaiError) {
      console.error('❌ Erreur lors de l\'appel OpenAI batch:', openaiError);
      
      // En cas d'erreur, marquer quand même toutes les tâches comme traitées
      console.log('🔧 Marquage des tâches comme traitées malgré l\'erreur...');
      for (const task of tasks) {
        try {
          await supabaseClient
            .from('todos')
            .update({ ai_recommendation_generated: true })
            .eq('id', task.id);
          console.log(`✅ Tâche ${task.id} marquée comme traitée (erreur)`);
        } catch (updateError) {
          console.error(`❌ Erreur marquage tâche ${task.id}:`, updateError);
        }
      }
      
      return { processed: tasks.length, successful: 0, failed: tasks.length, fullyCompleted: true };
    }

    console.log('✅ Réponse OpenAI batch reçue - traitement des recommandations');

    const recommendations = batchResult?.recommendation?.recommendations || [];
    console.log(`📊 ${recommendations.length} recommandations reçues pour ${tasks.length} tâches`);

    // Traitement et sauvegarde des recommandations
    let successful = 0;
    let failed = 0;

    for (const task of tasks) {
      try {
        // Trouver la recommandation correspondante par taskId
        const recommendation = recommendations.find(rec => rec.taskId === task.id);
        
        if (recommendation && recommendation.hasRecommendation) {
          console.log(`💾 Sauvegarde recommandation pour tâche ${task.id}`);
          
          // Sauvegarder la recommandation
          const { error: saveError } = await supabaseClient
            .from('todo_ai_recommendations')
            .insert({
              todo_id: task.id,
              recommendation_text: recommendation.recommendation,
              email_draft: recommendation.emailDraft || null
            });
          
          if (saveError) {
            console.error(`❌ Erreur sauvegarde recommandation pour tâche ${task.id}:`, saveError);
            failed++;
          } else {
            console.log(`✅ Recommandation sauvegardée pour tâche ${task.id}`);
            successful++;
          }
          
        } else {
          console.log(`⚠️ Pas de recommandation trouvée pour tâche ${task.id} - création d'une recommandation par défaut`);
          
          // Créer une recommandation par défaut pour éviter les blocages
          const { error: saveError } = await supabaseClient
            .from('todo_ai_recommendations')
            .insert({
              todo_id: task.id,
              recommendation_text: "Cette tâche nécessite votre attention. Veuillez consulter le contexte de la réunion pour plus de détails.",
              email_draft: null
            });
          
          if (saveError) {
            console.error(`❌ Erreur sauvegarde recommandation par défaut pour tâche ${task.id}:`, saveError);
            failed++;
          } else {
            console.log(`✅ Recommandation par défaut sauvegardée pour tâche ${task.id}`);
            successful++;
          }
        }
        
        // TOUJOURS marquer la tâche comme ayant une recommandation IA (même si c'est par défaut)
        const { error: updateError } = await supabaseClient
          .from('todos')
          .update({ ai_recommendation_generated: true })
          .eq('id', task.id);
          
        if (updateError) {
          console.error(`❌ Erreur marquage tâche ${task.id}:`, updateError);
        } else {
          console.log(`✅ Tâche ${task.id} marquée comme traitée`);
        }
        
      } catch (error) {
        console.error(`❌ Erreur lors du traitement de la tâche ${task.id}:`, error);
        
        // En cas d'erreur sur une tâche, quand même la marquer comme traitée
        try {
          await supabaseClient
            .from('todos')
            .update({ ai_recommendation_generated: true })
            .eq('id', task.id);
          console.log(`✅ Tâche ${task.id} marquée comme traitée (après erreur)`);
        } catch (updateError) {
          console.error(`❌ Erreur final marquage tâche ${task.id}:`, updateError);
        }
        
        failed++;
      }
    }
    
    console.log(`🏁 [BATCH] Traitement des recommandations COMPLÈTEMENT terminé: ${successful} succès, ${failed} échecs sur ${tasks.length} tâches`);
    
    return {
      processed: tasks.length,
      successful,
      failed,
      fullyCompleted: true
    };
    
  } catch (error) {
    console.error('❌ Erreur générale lors du traitement batch des recommandations:', error);
    
    // En cas d'erreur générale, marquer quand même toutes les tâches comme traitées
    console.log('🔧 Marquage final des tâches comme traitées...');
    for (const task of tasks) {
      try {
        await supabaseClient
          .from('todos')
          .update({ ai_recommendation_generated: true })
          .eq('id', task.id);
        console.log(`✅ Tâche ${task.id} marquée comme traitée (erreur générale)`);
      } catch (updateError) {
        console.error(`❌ Erreur final marquage tâche ${task.id}:`, updateError);
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
