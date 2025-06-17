
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

  console.log(`⚡ [RECOMMENDATION-SERVICE] DÉBUT génération des recommandations pour ${tasks.length} tâches`);
  console.log(`🎯 [RECOMMENDATION-SERVICE] Tâches reçues:`, tasks.map(t => ({ id: t.id, description: t.description?.substring(0, 50) + '...' })));
  
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

    console.log(`📝 [RECOMMENDATION-SERVICE] Préparation du prompt pour ${tasksForPrompt.length} tâches`);
    console.log(`👥 [RECOMMENDATION-SERVICE] Participants pour contexte: ${participantNames}`);
    console.log(`📄 [RECOMMENDATION-SERVICE] Transcript length: ${cleanedTranscript?.length || 0} characters`);

    // Créer un prompt pour traiter toutes les tâches d'un coup avec instructions pour réponses détaillées
    const batchPrompt = `
Tu es un assistant IA spécialisé dans la génération de recommandations TRÈS DÉTAILLÉES pour des tâches issues de réunions du cabinet d'ophtalmologie Dr Tabibian à Genève.

Ton objectif est d'analyser la tâche et de :
1. Proposer un **plan d'exécution clair** si la tâche est complexe ou nécessite plusieurs étapes.
2. **Signaler les éléments importants à considérer** (contraintes réglementaires, risques, coordination nécessaire, points d'attention).
3. **Suggérer des prestataires, fournisseurs ou outils** qui peuvent faciliter l'exécution.
4. Si pertinent, **challenger les décisions prises** ou proposer une alternative plus efficace ou moins risquée.
5. Ne faire **aucune recommandation** si la tâche est simple ou évidente (dans ce cas, répondre uniquement : "Aucune recommandation.").
6. Un email pré-rédigé COMPLET qui doit comprendre à qui doit être fait la communication et adapter le ton si l'email doit être envoyé en interne ou en externe. Si l'email est pour l'interne sois direct, si il est destiné à l'externe donne tout le contexte nécessaire DÉTAILLÉ pour que le fournisseur externe comprenne parfaitement la demande et soit professionnel.

Critères de qualité :
- Sois **concis, structuré et actionnable**.
- Fournis uniquement des recommandations qui **ajoutent une vraie valeur**.
- N'invente pas de contacts si tu n'en as pas.
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

    console.log(`📏 [RECOMMENDATION-SERVICE] Prompt length: ${batchPrompt.length} characters`);
    console.log(`⏳ [RECOMMENDATION-SERVICE] Appel OpenAI pour ${tasks.length} tâches en batch...`);

    // Préparer le payload pour task-recommendation-agent
    const payload = {
      batchPrompt,
      tasks: tasksForPrompt,
      transcript: cleanedTranscript,
      meetingContext: {
        title: meetingData.title || 'Réunion',
        date: meetingData.created_at || new Date().toISOString(),
        participants: participantNames
      }
    };

    console.log(`📤 [RECOMMENDATION-SERVICE] Payload préparé:`, {
      promptLength: payload.batchPrompt.length,
      tasksCount: payload.tasks.length,
      transcriptLength: payload.transcript.length,
      meetingContext: payload.meetingContext
    });

    // Appel unique à OpenAI pour toutes les tâches
    const callStartTime = Date.now();
    const { data: batchResult, error: openaiError } = await supabaseClient.functions.invoke('task-recommendation-agent', {
      body: payload
    });
    const callDuration = Date.now() - callStartTime;

    console.log(`⏱️ [RECOMMENDATION-SERVICE] Appel task-recommendation-agent terminé (${callDuration}ms)`);

    if (openaiError) {
      console.error('❌ [RECOMMENDATION-SERVICE] Erreur lors de l\'appel OpenAI batch:', openaiError);
      console.error('❌ [RECOMMENDATION-SERVICE] Payload qui a échoué:', JSON.stringify(payload, null, 2));
      
      // En cas d'erreur, marquer quand même toutes les tâches comme traitées
      console.log('🔧 [RECOMMENDATION-SERVICE] Marquage des tâches comme traitées malgré l\'erreur...');
      for (const task of tasks) {
        try {
          await supabaseClient
            .from('todos')
            .update({ ai_recommendation_generated: true })
            .eq('id', task.id);
          console.log(`✅ [RECOMMENDATION-SERVICE] Tâche ${task.id} marquée comme traitée (erreur)`);
        } catch (updateError) {
          console.error(`❌ [RECOMMENDATION-SERVICE] Erreur marquage tâche ${task.id}:`, updateError);
        }
      }
      
      return { processed: tasks.length, successful: 0, failed: tasks.length, fullyCompleted: true };
    }

    console.log('✅ [RECOMMENDATION-SERVICE] Réponse OpenAI batch reçue');
    console.log('📊 [RECOMMENDATION-SERVICE] Réponse brute:', JSON.stringify(batchResult, null, 2));

    const recommendations = batchResult?.recommendation?.recommendations || [];
    console.log(`📊 [RECOMMENDATION-SERVICE] ${recommendations.length} recommandations extraites pour ${tasks.length} tâches`);

    if (recommendations.length === 0) {
      console.error('❌ [RECOMMENDATION-SERVICE] Aucune recommandation reçue dans la réponse!');
      console.log('📄 [RECOMMENDATION-SERVICE] Structure de la réponse reçue:', Object.keys(batchResult || {}));
    }

    // Traitement et sauvegarde des recommandations
    let successful = 0;
    let failed = 0;

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      try {
        console.log(`🔄 [RECOMMENDATION-SERVICE] Traitement tâche ${i+1}/${tasks.length}: ${task.id}`);
        
        // Trouver la recommandation correspondante par taskId
        const recommendation = recommendations.find(rec => rec.taskId === task.id);
        
        if (recommendation && recommendation.hasRecommendation) {
          console.log(`💾 [RECOMMENDATION-SERVICE] Sauvegarde recommandation pour tâche ${task.id}`);
          console.log(`📝 [RECOMMENDATION-SERVICE] Recommandation preview: ${recommendation.recommendation?.substring(0, 100)}...`);
          console.log(`📧 [RECOMMENDATION-SERVICE] Email draft: ${recommendation.emailDraft ? 'Oui' : 'Non'}`);
          
          // Sauvegarder la recommandation
          const { error: saveError } = await supabaseClient
            .from('todo_ai_recommendations')
            .insert({
              todo_id: task.id,
              recommendation_text: recommendation.recommendation,
              email_draft: recommendation.emailDraft || null
            });
          
          if (saveError) {
            console.error(`❌ [RECOMMENDATION-SERVICE] Erreur sauvegarde recommandation pour tâche ${task.id}:`, saveError);
            failed++;
          } else {
            console.log(`✅ [RECOMMENDATION-SERVICE] Recommandation sauvegardée pour tâche ${task.id}`);
            successful++;
          }
          
        } else {
          console.log(`⚠️ [RECOMMENDATION-SERVICE] Pas de recommandation trouvée pour tâche ${task.id} - création d'une recommandation par défaut`);
          console.log(`🔍 [RECOMMENDATION-SERVICE] Recommandations disponibles:`, recommendations.map(r => r.taskId));
          
          // Créer une recommandation par défaut pour éviter les blocages
          const { error: saveError } = await supabaseClient
            .from('todo_ai_recommendations')
            .insert({
              todo_id: task.id,
              recommendation_text: "Cette tâche nécessite votre attention. Veuillez consulter le contexte de la réunion pour plus de détails.",
              email_draft: null
            });
          
          if (saveError) {
            console.error(`❌ [RECOMMENDATION-SERVICE] Erreur sauvegarde recommandation par défaut pour tâche ${task.id}:`, saveError);
            failed++;
          } else {
            console.log(`✅ [RECOMMENDATION-SERVICE] Recommandation par défaut sauvegardée pour tâche ${task.id}`);
            successful++;
          }
        }
        
        // TOUJOURS marquer la tâche comme ayant une recommandation IA (même si c'est par défaut)
        const { error: updateError } = await supabaseClient
          .from('todos')
          .update({ ai_recommendation_generated: true })
          .eq('id', task.id);
          
        if (updateError) {
          console.error(`❌ [RECOMMENDATION-SERVICE] Erreur marquage tâche ${task.id}:`, updateError);
        } else {
          console.log(`✅ [RECOMMENDATION-SERVICE] Tâche ${task.id} marquée comme traitée`);
        }
        
      } catch (error) {
        console.error(`❌ [RECOMMENDATION-SERVICE] Erreur lors du traitement de la tâche ${task.id}:`, error);
        console.error(`❌ [RECOMMENDATION-SERVICE] Stack trace pour tâche ${task.id}:`, error.stack);
        
        // En cas d'erreur sur une tâche, quand même la marquer comme traitée
        try {
          await supabaseClient
            .from('todos')
            .update({ ai_recommendation_generated: true })
            .eq('id', task.id);
          console.log(`✅ [RECOMMENDATION-SERVICE] Tâche ${task.id} marquée comme traitée (après erreur)`);
        } catch (updateError) {
          console.error(`❌ [RECOMMENDATION-SERVICE] Erreur final marquage tâche ${task.id}:`, updateError);
        }
        
        failed++;
      }
    }
    
    console.log(`🏁 [RECOMMENDATION-SERVICE] Traitement des recommandations COMPLÈTEMENT terminé: ${successful} succès, ${failed} échecs sur ${tasks.length} tâches`);
    
    return {
      processed: tasks.length,
      successful,
      failed,
      fullyCompleted: true
    };
    
  } catch (error) {
    console.error('❌ [RECOMMENDATION-SERVICE] Erreur générale lors du traitement batch des recommandations:', error);
    console.error('❌ [RECOMMENDATION-SERVICE] Stack trace général:', error.stack);
    
    // En cas d'erreur générale, marquer quand même toutes les tâches comme traitées
    console.log('🔧 [RECOMMENDATION-SERVICE] Marquage final des tâches comme traitées...');
    for (const task of tasks) {
      try {
        await supabaseClient
          .from('todos')
          .update({ ai_recommendation_generated: true })
          .eq('id', task.id);
        console.log(`✅ [RECOMMENDATION-SERVICE] Tâche ${task.id} marquée comme traitée (erreur générale)`);
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
