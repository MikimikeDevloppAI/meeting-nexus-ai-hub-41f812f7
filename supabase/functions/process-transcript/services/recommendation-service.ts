
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

    // Créer un prompt pour traiter toutes les tâches d'un coup
    const batchPrompt = `
Tu es un assistant IA spécialisé dans la génération de recommandations pour des tâches issues de réunions.

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

INSTRUCTIONS :
Génère des recommandations IA personnalisées pour CHAQUE tâche listée ci-dessus.
Pour chaque tâche, analyse le contexte de la réunion et génère une recommendation qui :

1. Donner des **tips pratiques ou des alertes** sur ce à quoi il faut faire attention (technique, administratif, juridique, logistique…).
2. Proposer des **options ou choix concrets**, avec leurs avantages/inconvénients (ex. : deux types de fontaines à eau, ou trois options de bureaux ergonomiques).
3. Suggérer des **outils numériques,fournisseur prestataires ou intégrations utiles** (ex. : plugin Outlook, service de réservation, site pour commander…) en sitant le nom des fournisseurs connus qui peuvent founrir le service sur genève.
4. Alerter sur les **risques ou oublis fréquents** liés à cette tâche, même s'ils ne sont pas explicitement mentionnés.
5. Créer un plan d'action clair est structuré quand c'est nécessaire.
6. Être **structuré et pertinent**, sans remplir s'il n'y a rien d'utile à ajouter et ne pas juste paraphraser la tache. il faut que les recommendations amène une vrai valeur ajouté.
7. Un email pré-rédigé qui doit comprendre à qui doit etre fait la communication et adapté le ton si l'email doit etre envoyé en interne ou en externe. si l'email est pour l'interne soit directe si il est destiné à l'externe donne tout le contexte nécessaire pour que le fournisseur externe comprenne la demande et soit professionnel

IMPORTANT : 
- Traite TOUTES les tâches (indices 0 à ${tasks.length - 1})

Réponds UNIQUEMENT en JSON avec cette structure EXACTE :
{
  "recommendations": [
    {
      "taskIndex": 0,
      "taskId": "uuid-de-la-tache",
      "hasRecommendation": true,
      "recommendation": "Recommandation détaillée pour la tâche...",
      "emailDraft": "Email pré-rédigé  (optionnel masi fortement recommendé)"
    },
    {
      "taskIndex": 1,
      "taskId": "uuid-de-la-tache",
      "hasRecommendation": true,
      "recommendation": "Recommandation pour la tâche 2...",
      "emailDraft": null
    }
  ]
}

ASSURE-TOI d'inclure TOUTES les ${tasks.length} tâches dans ta réponse.`;

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
