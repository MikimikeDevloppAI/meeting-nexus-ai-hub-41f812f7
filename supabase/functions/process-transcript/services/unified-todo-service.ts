
import { createSupabaseClient } from './database-service.ts'
import { callOpenAI } from './openai-service.ts'

export async function processTasksWithRecommendations(
  cleanedTranscript: string, 
  meetingData: any,
  participants: any[]
) {
  if (!cleanedTranscript || cleanedTranscript.trim().length === 0) {
    console.log('⚡ [UNIFIED-TODO-SERVICE] Aucun transcript à traiter');
    return { processed: 0, successful: 0, failed: 0, fullyCompleted: true };
  }

  console.log(`⚡ [UNIFIED-TODO-SERVICE] DÉBUT génération UNIFIÉE todos + recommandations avec GPT-4.1`);
  console.log(`👥 [UNIFIED-TODO-SERVICE] Participants fournis pour assignation:`, participants?.map(p => ({ id: p.id, name: p.name, email: p.email })));
  
  const supabaseClient = createSupabaseClient();
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    const participantNames = participants?.map(p => p.name).join(', ') || '';

    // Prompt unifié avec descriptions plus concises
    const unifiedPrompt = `Basé sur ce transcript de réunion, identifie et REGROUPE INTELLIGEMMENT toutes les tâches, actions et suivis par SUJETS COHÉRENTS pour éviter les doublons. Privilégie le regroupement pour minimiser le nombre de tâches.

Participants disponibles dans le système : ${participantNames}

**RÈGLES DE REGROUPEMENT OBLIGATOIRES:**
- Regroupe toutes les actions liées au MÊME SUJET/FOURNISSEUR/OUTIL en UNE SEULE tâche
- Une tâche = un sujet principal avec un contexte CONCIS et ACTIONNABLE
- Évite absolument les doublons (ex: "contacter X" et "appeler X" = 1 seule tâche)
- Regroupe les actions séquentielles (ex: "demander devis" + "comparer prix" + "négocier" = 1 tâche complète)
- Privilégie les macro-tâches sur les micro-actions

**RÈGLES DE DESCRIPTION CONCISE:**
- description concise mais qui donne le contexte nécessaire pour la compréhension
- Utilise un verbe d'action clair (Contacter, Organiser, Vérifier, Finaliser, etc.)
- Format: "Action + Objet + Contexte "


**RÈGLES D'ASSIGNATION STRICTES:**
- Utilise SEULEMENT les noms EXACTS de cette liste : ${participantNames}
- Variantes acceptées pour correspondance :
  • Leïla / leila / Leila
  • Émilie / emilie / Emilie  
  • David / david / David Tabibian / Tabibian
  • Parmice / parmice / Parmis
  • Sybil / sybil
- Si une personne dit "je vais faire X" → assigne à cette personne
- Si plusieurs personnes impliquées → assigne à la personne principale
- Si aucune assignation claire, laisse "assigned_to" à null
- IMPORTANT: Tu ne peux assigner qu'aux participants PRÉSENTS dans cette réunion

**RÈGLES POUR LES RECOMMANDATIONS IA:**
Pour chaque tâche, génère:
1. **Recommandation détaillée** qui propose un plan d'exécution, signale les points d'attention, suggère des prestataires/outils, ou challenge les décisions si pertinent.
2. **Email pré-rédigé COMPLET** si communication interne est nécessaire: direct et concis et si une communication externe est nécessaire professionnel avec tout le contexte et très détaillés.
3. Si la tâche est simple/évidente, marque hasRecommendation: false avec "Aucune recommandation nécessaire."

Critères qualité pour les recommandations:
- Concis, structuré, actionnable
- Valeur ajoutée réelle pour le cabinet d'ophtalmologie Dr Tabibian à Genève
- Pas d'invention de contacts
- Éviter banalités

CONTEXTE RÉUNION:
- Titre: ${meetingData.title || 'Réunion'}
- Date: ${meetingData.created_at || new Date().toISOString()}
- Participants PRÉSENTS: ${participantNames}

Transcript :
${cleanedTranscript}

IMPORTANT: Retourne UNIQUEMENT un JSON valide avec cette structure exacte :
{
  "tasks": [
    {
      "description": "Action concise et claire avec contexte ",
      "assigned_to": ["Nom exact du participant tel qu'il apparaît dans la liste"] ou null,
      "hasRecommendation": true/false,
      "recommendation": "Recommandation détaillée ou 'Aucune recommandation nécessaire.'",
      "emailDraft": "Email COMPLET (optionnel)" ou null
    }
  ]
}`;

    console.log(`🚀 [UNIFIED-TODO-SERVICE] Traitement UNIFIÉ avec GPT-4.1`);
    
    const callStartTime = Date.now();
    const unifiedResponse = await callOpenAI(unifiedPrompt, openaiApiKey, 0.3, 'gpt-4.1-2025-04-14', 3, 16384);
    const callDuration = Date.now() - callStartTime;
    
    console.log(`⏱️ [UNIFIED-TODO-SERVICE] Appel unifié terminé (${callDuration}ms)`);

    // Parser la réponse
    let tasksWithRecommendations = [];
    try {
      console.log('📄 [UNIFIED-TODO-SERVICE] Raw response length:', unifiedResponse?.length || 0);
      
      // Nettoyer la réponse avant de parser
      const cleanedResponse = unifiedResponse.trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```\s*$/i, '');
      
      const parsedData = JSON.parse(cleanedResponse);
      tasksWithRecommendations = parsedData.tasks || [];
      console.log(`📋 [UNIFIED-TODO-SERVICE] Parsed ${tasksWithRecommendations.length} tasks avec recommandations`);
    } catch (parseError) {
      console.error('❌ [UNIFIED-TODO-SERVICE] Error parsing JSON:', parseError);
      console.log('📄 [UNIFIED-TODO-SERVICE] Raw response:', unifiedResponse);
      throw new Error('Failed to parse unified response');
    }

    // Sauvegarder les tâches ET les recommandations simultanément
    let totalSuccessful = 0;
    let totalFailed = 0;
    let savedTasks = [];

    console.log(`💾 [UNIFIED-TODO-SERVICE] Sauvegarde de ${tasksWithRecommendations.length} tâches avec recommandations`);

    for (let i = 0; i < tasksWithRecommendations.length; i++) {
      const taskData = tasksWithRecommendations[i];
      try {
        console.log(`💾 [UNIFIED-TODO-SERVICE] Sauvegarde tâche ${i+1}/${tasksWithRecommendations.length}: ${taskData.description}`);
        
        // 1. Créer la tâche d'abord avec assignation limitée aux participants de la réunion
        const savedTask = await saveTaskUnified(supabaseClient, taskData, meetingData.id, participants);
        
        if (savedTask) {
          savedTasks.push(savedTask);
          
          // 2. Créer la recommandation immédiatement après
          if (taskData.hasRecommendation !== false && taskData.recommendation) {
            const { error: recError } = await supabaseClient
              .from('todo_ai_recommendations')
              .insert({
                todo_id: savedTask.id,
                recommendation_text: taskData.recommendation,
                email_draft: taskData.emailDraft || null
              });
            
            if (recError) {
              console.error(`❌ [UNIFIED-TODO-SERVICE] Erreur sauvegarde recommandation pour tâche ${savedTask.id}:`, recError);
            } else {
              console.log(`✅ [UNIFIED-TODO-SERVICE] Recommandation sauvegardée pour tâche ${savedTask.id}`);
            }
          }
          
          // 3. Marquer comme traité
          await supabaseClient
            .from('todos')
            .update({ ai_recommendation_generated: true })
            .eq('id', savedTask.id);
          
          totalSuccessful++;
          console.log(`✅ [UNIFIED-TODO-SERVICE] Tâche ${i+1} sauvegardée avec succès avec ID: ${savedTask.id}`);
        }
        
      } catch (error) {
        console.error(`❌ [UNIFIED-TODO-SERVICE] Erreur sauvegarde tâche ${i+1}:`, error);
        totalFailed++;
      }
    }
    
    console.log(`🏁 [UNIFIED-TODO-SERVICE] Traitement unifié terminé: ${totalSuccessful} succès, ${totalFailed} échecs sur ${tasksWithRecommendations.length} tâches`);
    
    return {
      processed: tasksWithRecommendations.length,
      successful: totalSuccessful,
      failed: totalFailed,
      fullyCompleted: true,
      savedTasks: savedTasks,
      unified: true,
      model: 'gpt-4.1-2025-04-14'
    };
    
  } catch (error) {
    console.error('❌ [UNIFIED-TODO-SERVICE] Erreur générale:', error);
    return { 
      processed: 0, 
      successful: 0, 
      failed: 0,
      fullyCompleted: false,
      error: error.message,
      unified: true
    };
  }
}

// Fonction pour sauvegarder une tâche avec assignation limitée aux participants de la réunion
async function saveTaskUnified(supabaseClient: any, task: any, meetingId: string, meetingParticipants: any[]) {
  console.log('💾 Saving unified task:', task.description);
  console.log('👥 Participants de la réunion disponibles pour assignation:', meetingParticipants?.map(p => ({ id: p.id, name: p.name, email: p.email })));
  
  try {
    // Fonction pour nettoyer les descriptions sans limitation de longueur
    const makeDescriptionConcise = (description: string): string => {
      if (!description) return '';
      
      // Nettoyer la description
      let cleaned = description.trim();
      
      // Supprimer les répétitions évidentes et nettoyer
      const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim().length > 0);
      
      // Rejoindre toutes les phrases importantes
      let result = sentences.join('. ').trim();
      
      // S'assurer qu'il y a un point à la fin
      if (result && !result.endsWith('.')) {
        result += '.';
      }
      
      return result;
    };

    // Fonction pour trouver le participant UNIQUEMENT parmi les participants de la réunion
    const findBestParticipantMatch = (searchName: string, participants: any[]): any | null => {
      if (!searchName || !participants?.length) return null;

      console.log(`🔍 [UNIFIED-TODO-SERVICE] Recherche "${searchName}" parmi les participants de la réunion UNIQUEMENT`);

      const normalizeParticipantName = (name: string): string => {
        return name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim();
      };

      const getNameVariants = (searchName: string): string[] => {
        const normalized = normalizeParticipantName(searchName);
        
        const nameMapping: Record<string, string[]> = {
          'leila': ['leïla', 'leila'],
          'emilie': ['émilie', 'emilie'],
          'david': ['david', 'david tabibian', 'tabibian'],
          'parmice': ['parmice', 'parmis'],
          'sybil': ['sybil'],
          'tabibian': ['tabibian', 'dr tabibian', 'docteur tabibian', 'david tabibian']
        };
        
        for (const [key, variants] of Object.entries(nameMapping)) {
          if (variants.some(variant => normalizeParticipantName(variant) === normalized)) {
            return variants;
          }
        }
        
        return [searchName];
      };

      const variants = getNameVariants(searchName);
      console.log(`🔄 [UNIFIED-TODO-SERVICE] Variantes testées:`, variants);
      
      for (const variant of variants) {
        const normalizedVariant = normalizeParticipantName(variant);
        
        for (const participant of participants) {
          const normalizedParticipantName = normalizeParticipantName(participant.name);
          const normalizedEmail = normalizeParticipantName(participant.email?.split('@')[0] || '');
          
          if (normalizedParticipantName === normalizedVariant || 
              normalizedEmail === normalizedVariant ||
              normalizedParticipantName.includes(normalizedVariant) ||
              normalizedVariant.includes(normalizedParticipantName)) {
            console.log(`✅ [UNIFIED-TODO-SERVICE] Correspondance trouvée: ${participant.name} (présent à la réunion)`);
            return participant;
          }
        }
      }
      
      const firstName = normalizeParticipantName(searchName.split(' ')[0]);
      for (const participant of participants) {
        const participantFirstName = normalizeParticipantName(participant.name.split(' ')[0]);
        if (participantFirstName === firstName) {
          console.log(`✅ [UNIFIED-TODO-SERVICE] Correspondance par prénom: ${participant.name} (présent à la réunion)`);
          return participant;
        }
      }
      
      console.log(`⚠️ [UNIFIED-TODO-SERVICE] Aucune correspondance trouvée pour "${searchName}" parmi les participants de la réunion`);
      return null;
    };

    // Rendre la description plus concise
    const conciseDescription = makeDescriptionConcise(task.description);
    console.log('📝 Description concise:', conciseDescription);

    // Créer la tâche sans assigned_to puisque cette colonne n'existe plus
    const { data: savedTask, error } = await supabaseClient
      .from('todos')
      .insert([{
        meeting_id: meetingId,
        description: conciseDescription,
        status: 'confirmed',
        due_date: task.due_date || null
      }])
      .select()
      .single()

    if (error) {
      console.error('❌ Error saving unified task:', error)
      throw error
    }

    console.log('✅ Unified task saved with ID:', savedTask.id)

    // Traiter les assignations UNIQUEMENT avec les participants de la réunion
    if (task.assigned_to && Array.isArray(task.assigned_to) && task.assigned_to.length > 0) {
      console.log('👥 [UNIFIED-TODO-SERVICE] Assignation demandée pour:', task.assigned_to);
      
      for (const participantName of task.assigned_to) {
        if (!participantName || typeof participantName !== 'string') continue;
        
        // Chercher UNIQUEMENT parmi les participants de la réunion
        const participant = findBestParticipantMatch(participantName.toString(), meetingParticipants || []);
        
        if (participant) {
          const { error: assignError } = await supabaseClient
            .from('todo_participants')
            .insert([{
              todo_id: savedTask.id,
              participant_id: participant.id
            }])
          
          if (assignError) {
            console.error('❌ [UNIFIED-TODO-SERVICE] Error assigning participant:', assignError)
          } else {
            console.log('✅ [UNIFIED-TODO-SERVICE] Participant assigné:', participant.name, 'to unified task:', savedTask.id)
          }
        } else {
          console.warn(`⚠️ [UNIFIED-TODO-SERVICE] Participant "${participantName}" non trouvé parmi les participants de la réunion`);
          console.log('👥 [UNIFIED-TODO-SERVICE] Participants disponibles:', meetingParticipants?.map(p => p.name));
        }
      }
    } else {
      console.log('ℹ️ [UNIFIED-TODO-SERVICE] Pas de participants à assigner pour cette tâche');
    }

    return savedTask
  } catch (error) {
    console.error('❌ [UNIFIED-TODO-SERVICE] Error in saveTaskUnified:', error)
    throw error
  }
}
