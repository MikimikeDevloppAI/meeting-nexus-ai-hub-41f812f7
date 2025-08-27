import { createSupabaseClient } from './database-service.ts'
import { callOpenAI } from './openai-service.ts'

export async function processTasksWithRecommendations(
  cleanedTranscript: string, 
  meetingData: any,
  users: any[]
) {
  if (!cleanedTranscript || cleanedTranscript.trim().length === 0) {
    console.log('⚡ [UNIFIED-TODO-SERVICE] Aucun transcript à traiter');
    return { processed: 0, successful: 0, failed: 0, fullyCompleted: true };
  }

  console.log(`⚡ [UNIFIED-TODO-SERVICE] DÉBUT génération UNIFIÉE todos + recommandations avec GPT-5`);
  console.log(`👥 [UNIFIED-TODO-SERVICE] Users fournis pour assignation:`, users?.map(p => ({ id: p.id, name: p.name, email: p.email })));
  
  const supabaseClient = createSupabaseClient();
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    const userNames = users?.map(p => p.name).join(', ') || '';

    // Récupérer TOUS les todos existants (non terminés) pour éviter les doublons
    console.log('📋 [UNIFIED-TODO-SERVICE] Récupération de tous les todos existants...');
    const { data: allUsers, error: usersError } = await supabaseClient
      .from('users')
      .select('*')
      .order('name');

    if (usersError) {
      console.error('❌ [UNIFIED-TODO-SERVICE] Error fetching all users:', usersError);
      throw usersError;
    }

    const { data: existingTodos, error: todosError } = await supabaseClient
      .from('todos')
      .select(`
        id,
        description,
        status,
        created_at,
        todo_users(
          user_id,
          users(name)
        )
      `)
      .neq('status', 'completed')
      .order('created_at', { ascending: false });

    if (todosError) {
      console.error('❌ [UNIFIED-TODO-SERVICE] Error fetching existing todos:', todosError);
    }

    const existingTodosContext = existingTodos?.map(todo => ({
      id: todo.id,
      description: todo.description,
      status: todo.status,
      assignedUsers: todo.todo_users?.map(tu => tu.users?.name).filter(Boolean) || []
    })) || [];

    console.log(`📋 [UNIFIED-TODO-SERVICE] ${existingTodosContext.length} todos existants trouvés pour éviter doublons`);

    const allUserNames = allUsers?.map(u => u.name).join(', ') || '';
    const meetingUserNames = users?.map(p => p.name).join(', ') || '';

    // Récupérer seulement les todos récents pour éviter les doublons côté IA
    const recentTodosContext = existingTodosContext.slice(0, 15); // Top 15 plus récents

    // Prompt optimisé pour GPT-5 avec recherche web intégrée
    const unifiedPrompt = `Basé sur ce transcript de réunion, identifie TOUTES les nouvelles tâches, actions et suivis mentionnés et CRÉÉ-LES comme nouvelles tâches.

UTILISE LA RECHERCHE WEB pour enrichir chaque tâche avec des informations actuelles et pertinentes (coordonnées de prestataires, tarifs, contacts spécialisés, réglementations, etc.) spécifiquement pour le cabinet d'ophtalmologie Dr Tabibian à Genève.

NE PRODUIS QUE des tâches nouvelles qui ne dupliquent pas les todos existantes listées ci-dessous. Si c'est un doublon évident, n'inclus pas cette tâche dans ta réponse.

TOUS LES UTILISATEURS SYSTÈME : ${allUserNames}
PARTICIPANTS À CETTE RÉUNION : ${meetingUserNames}

**TODOS EXISTANTS (pour éviter doublons) :**
${recentTodosContext.length > 0 ? recentTodosContext.map(todo => 
  `- ${todo.description} (${todo.status})`
).join('\n') : 'Aucun todo existant récent'}

**RÈGLES DE CRÉATION:**
- CRÉE une nouvelle tâche pour CHAQUE action/sujet distinct mentionné dans le transcript 
- Regroupe toutes les tâches qui ont le même sujet ou le même outil pour éviter de créer trop de tâches similaires
- Tout point abordé qui nécessite une action doit générer une tâche
- N'inclus dans ta réponse que les tâches réellement nouvelles
- CRÉÉ automatiquement des sous-tâches (subtasks) pour décomposer les tâches complexes en étapes claires

**RÈGLES DE DESCRIPTION:**
- Description enrichie avec contexte complet nécessaire pour comprendre et exécuter la tâche
- Utilise un verbe d'action clair (Contacter, Organiser, Vérifier, Finaliser, etc.)
- Format: "Action + Objet + Contexte détaillé + Informations trouvées via recherche web"

**RÈGLES D'ASSIGNATION MULTI-UTILISATEURS:**
- Tu peux assigner à PLUSIEURS utilisateurs simultanément pour une même tâche
- Format: "assigned_to": ["User1", "User2", "User3"]
- Tu peux assigner à N'IMPORTE QUEL utilisateur du système (liste complète ci-dessus)
- PRIVILÉGIE les participants à cette réunion : ${meetingUserNames}
- Variantes acceptées pour correspondance :
  • Leïla / leila / Leila → "Leila Burnier-Framboret"
  • Émilie / emilie / Emilie → "Emilie Doy"
  • David / david / Tabibian → "David Tabibian"
  • Parmice / parmice / Parmis → "Parmis PARVIN"
  • Sybil / sybil / Sybille → "Sybille Peguiron "
- Si une personne dit "je vais faire X" → assigne à cette personne
- Si aucune assignation claire, laisse "assigned_to" à null

**RÈGLES POUR LES SOUS-TÂCHES:**
- Décompose automatiquement les tâches complexes en étapes logiques
- Chaque sous-tâche doit être une action spécifique et actionnable
- Numérote les étapes dans l'ordre logique d'exécution
- Format: "Étape X: Action spécifique à réaliser"

**RÈGLES POUR LES RECOMMANDATIONS IA ENRICHIES PAR RECHERCHE WEB:**
Pour chaque tâche, utilise la recherche web pour:
1. **Trouver des prestataires/fournisseurs spécialisés** dans le domaine concerné à Genève
2. **Obtenir des coordonnées réelles** (téléphone, email, adresse) quand pertinent
3. **Vérifier les tarifs actuels** et réglementations en vigueur
4. **Identifier des outils/solutions** recommandées dans le secteur médical

Puis génère:
1. **Recommandation détaillée enrichie** avec informations trouvées sur le web
2. **Email pré-rédigé COMPLET** utilisant les coordonnées réelles trouvées, clair et professionnel
3. Si la tâche est simple/évidente, marque hasRecommendation: false

Critères qualité pour les recommandations:
- Structuré, actionnable, enrichi par des informations web actuelles  
- Valeur ajoutée réelle pour le cabinet d'ophtalmologie Dr Tabibian à Genève
- Coordonnées et informations vérifiées par recherche web

CONTEXTE RÉUNION:
- Titre: ${meetingData.title || 'Réunion'}
- Date: ${meetingData.created_at || new Date().toISOString()}
- Utilisateurs PRÉSENTS: ${userNames}

Transcript :
${cleanedTranscript}

IMPORTANT: Retourne UNIQUEMENT un JSON valide avec cette structure exacte :
{
  "tasks": [
    {
      "description": "Action détaillée avec contexte complet et informations web",
      "assigned_to": ["Nom exact utilisateur 1", "Nom exact utilisateur 2"] ou null,
      "due_date": "YYYY-MM-DD ou YYYY-MM-DDTHH:MM:SSZ si échéance mentionnée, sinon null",
      "hasRecommendation": true/false,
      "recommendation": "Recommandation détaillée enrichie par recherche web",
      "emailDraft": "Email COMPLET avec coordonnées réelles trouvées",
      "subtasks": [
        {
          "description": "Étape 1: Action spécifique",
          "order": 1
        },
        {
          "description": "Étape 2: Action suivante", 
          "order": 2
        }
      ],
      "webResearchPerformed": true
    }
  ]
}

**RÈGLES POUR LES DATES D'ÉCHÉANCE:**
- Si une date ou délai est mentionné ("dans 2 semaines", "avant le 15", "d'ici vendredi", "urgent"), calcule la date d'échéance
- Format ISO: YYYY-MM-DDTHH:MM:SSZ pour dates avec heure, ou YYYY-MM-DD pour dates simples
- Date de référence : ${new Date().toISOString().split('T')[0]} (aujourd'hui)
- Si aucune échéance mentionnée, laisse due_date à null`;

    console.log(`🚀 [UNIFIED-TODO-SERVICE] Traitement UNIFIÉ avec GPT-5 + recherche web`);
    
    const callStartTime = Date.now();
    const unifiedResponse = await callOpenAI(unifiedPrompt, openaiApiKey, null, 'gpt-5-2025-08-07', 3, 8192);
    const callDuration = Date.now() - callStartTime;
    
    console.log(`⏱️ [UNIFIED-TODO-SERVICE] Appel unifié terminé (${callDuration}ms)`);

    // Parser la réponse avec tolérance pour le champ action
    let tasksWithRecommendations = [];
    let skippedAsDuplicate = 0;
    let createdCount = 0;
    let existingTodosForDedup = existingTodosContext;
    
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
      
      // Ignorer le champ action s'il existe encore (tolérance)
      tasksWithRecommendations.forEach(task => {
        if (task.action) {
          console.log(`🔄 [UNIFIED-TODO-SERVICE] Ignoring legacy action field: ${task.action}`);
          delete task.action;
        }
      });
      
    } catch (parseError) {
      console.error('❌ [UNIFIED-TODO-SERVICE] Error parsing JSON:', parseError);
      console.log('📄 [UNIFIED-TODO-SERVICE] Raw response:', unifiedResponse);
      throw new Error('Failed to parse unified response');
    }

    // Fonction de normalisation pour la déduplication côté code
    const normalizeDescription = (desc: string): string => {
      return desc
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^\w\s]/g, ' ') // Remove punctuation
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();
    };

    // Fonction de test de doublon
    const isDuplicate = (candidate: string, existing: string): boolean => {
      const candidateNorm = normalizeDescription(candidate);
      const existingNorm = normalizeDescription(existing);
      
      // Test 1: Match exact sur description normalisée
      if (candidateNorm === existingNorm) {
        return true;
      }
      
      // Test 2: Similarité par tokens (Jaccard)
      const candidateTokens = new Set(candidateNorm.split(' ').filter(t => t.length > 2));
      const existingTokens = new Set(existingNorm.split(' ').filter(t => t.length > 2));
      
      if (candidateTokens.size === 0 || existingTokens.size === 0) {
        return false;
      }
      
      const intersection = new Set([...candidateTokens].filter(x => existingTokens.has(x)));
      const union = new Set([...candidateTokens, ...existingTokens]);
      const jaccardSimilarity = intersection.size / union.size;
      
      if (jaccardSimilarity > 0.85) {
        return true;
      }
      
      // Test 3: Substring longue (inclusion)
      if (candidateNorm.length > 25 && existingNorm.length > 25) {
        if (candidateNorm.includes(existingNorm) || existingNorm.includes(candidateNorm)) {
          return true;
        }
      }
      
      return false;
    };

    // Set pour éviter les doublons intra-lot
    const processedDescriptions = new Set<string>();

    // Filtrer les tâches en appliquant la déduplication côté code
    const filteredTasks = [];
    for (const taskData of tasksWithRecommendations) {
      const description = taskData.description;
      const normalizedDesc = normalizeDescription(description);
      
      // Vérifier contre les descriptions déjà traitées dans ce lot
      if (processedDescriptions.has(normalizedDesc)) {
        console.log(`🔄 [DEDUP] SKIP intra-batch duplicate: ${description}`);
        skippedAsDuplicate++;
        continue;
      }
      
      // Vérifier contre les todos existants
      let isExistingDuplicate = false;
      for (const existingTodo of existingTodosForDedup) {
        if (isDuplicate(description, existingTodo.description)) {
          console.log(`🔄 [DEDUP] SKIP duplicate of existing: "${description}" vs "${existingTodo.description}"`);
          isExistingDuplicate = true;
          skippedAsDuplicate++;
          break;
        }
      }
      
      if (!isExistingDuplicate) {
        filteredTasks.push(taskData);
        processedDescriptions.add(normalizedDesc);
        console.log(`✅ [DEDUP] ACCEPTED new task: ${description}`);
      }
    }

    console.log(`🔍 [DEDUP] Filtering results: ${tasksWithRecommendations.length} candidates → ${filteredTasks.length} accepted, ${skippedAsDuplicate} skipped as duplicates`);

    // Sauvegarder les tâches filtrées
    let totalSuccessful = 0;
    let totalFailed = 0;
    let savedTasks = [];

    console.log(`💾 [CREATE-ONLY-SERVICE] Sauvegarde de ${filteredTasks.length} tâches nouvelles avec recommandations`);

    for (let i = 0; i < filteredTasks.length; i++) {
      const taskData = filteredTasks[i];
      try {
        console.log(`💾 [CREATE-ONLY-SERVICE] Sauvegarde tâche ${i+1}/${filteredTasks.length}: ${taskData.description}`);
        
        const savedTask = await saveTaskUnified(supabaseClient, taskData, meetingData.id, users, allUsers);
        
        if (savedTask) {
          savedTasks.push(savedTask);
          
          // Créer les sous-tâches si elles existent
          if (taskData.subtasks && Array.isArray(taskData.subtasks)) {
            console.log(`📋 [CREATE-ONLY-SERVICE] Création de ${taskData.subtasks.length} sous-tâches pour tâche ${savedTask.id}`);
            
            for (const subtask of taskData.subtasks) {
              const { error: subtaskError } = await supabaseClient
                .from('todo_subtasks')
                .insert({
                  todo_id: savedTask.id,
                  description: subtask.description,
                  order: subtask.order || 1,
                  completed: false
                });
              
              if (subtaskError) {
                console.error(`❌ [CREATE-ONLY-SERVICE] Erreur création sous-tâche:`, subtaskError);
              } else {
                console.log(`✅ [CREATE-ONLY-SERVICE] Sous-tâche créée: ${subtask.description}`);
              }
            }
          }
          
          // Créer la recommandation
          if (taskData.hasRecommendation !== false && taskData.recommendation) {
            const { error: recError } = await supabaseClient
              .from('todo_ai_recommendations')
              .insert({
                todo_id: savedTask.id,
                recommendation_text: taskData.recommendation,
                email_draft: taskData.emailDraft || null
              });
            
            if (recError) {
              console.error(`❌ [CREATE-ONLY-SERVICE] Erreur sauvegarde recommandation pour tâche ${savedTask.id}:`, recError);
            } else {
              console.log(`✅ [CREATE-ONLY-SERVICE] Recommandation sauvegardée pour tâche ${savedTask.id}`);
            }
          }
          
          // Marquer comme traité
          await supabaseClient
            .from('todos')
            .update({ ai_recommendation_generated: true })
            .eq('id', savedTask.id);
          
          totalSuccessful++;
          createdCount++;
          console.log(`✅ [CREATE-ONLY-SERVICE] Tâche ${i+1} sauvegardée avec succès avec ID: ${savedTask.id}`);
        }
        
      } catch (error) {
        console.error(`❌ [CREATE-ONLY-SERVICE] Erreur sauvegarde tâche ${i+1}:`, error);
        totalFailed++;
      }
    }
    
    console.log(`🏁 [CREATE-ONLY-SERVICE] Traitement terminé: ${createdCount} créées, ${skippedAsDuplicate} doublons ignorés, ${totalFailed} échecs sur ${tasksWithRecommendations.length} candidates`);
    
    return {
      processed: tasksWithRecommendations.length,
      successful: totalSuccessful,
      failed: totalFailed,
      createdCount: createdCount,
      skippedAsDuplicateCount: skippedAsDuplicate,
      fullyCompleted: true,
      savedTasks: savedTasks,
      unified: true,
      createOnly: true,
      model: 'gpt-5-2025-08-07'
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

// Fonction pour sauvegarder UNIQUEMENT de nouvelles tâches (CREATE only)
async function saveTaskUnified(supabaseClient: any, task: any, meetingId: string, meetingUsers: any[], allUsers: any[]) {
  console.log('💾 [CREATE-ONLY-SERVICE] Creating new task:', task.description);
  console.log('👥 Tous les utilisateurs système:', allUsers?.map(u => ({ id: u.id, name: u.name })));
  console.log('👥 Participants de la réunion:', meetingUsers?.map(p => ({ id: p.id, name: p.name })));
  
  try {
    // Fonction pour nettoyer les descriptions
    const makeDescriptionConcise = (description: string): string => {
      if (!description) return '';
      let cleaned = description.trim();
      const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim().length > 0);
      let result = sentences.join('. ').trim();
      if (result && !result.endsWith('.')) {
        result += '.';
      }
      return result;
    };

    // Fonction pour trouver l'utilisateur dans TOUS les utilisateurs du système
    const findBestUserMatch = (searchName: string, allUsers: any[]): any | null => {
      if (!searchName || !allUsers?.length) return null;

      console.log(`🔍 [CREATE-ONLY-SERVICE] Recherche "${searchName}" parmi TOUS les utilisateurs système`);

      const normalizeUserName = (name: string): string => {
        return name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim();
      };

      const getNameVariants = (searchName: string): string[] => {
        const normalized = normalizeUserName(searchName);
        
        const nameMapping: Record<string, string[]> = {
          'leila': ['leïla', 'leila'],
          'emilie': ['émilie', 'emilie'],
          'david': ['david', 'david tabibian', 'tabibian'],
          'parmice': ['parmice', 'parmis'],
          'sybil': ['sybil'],
          'tabibian': ['tabibian', 'dr tabibian', 'docteur tabibian', 'david tabibian']
        };
        
        for (const [key, variants] of Object.entries(nameMapping)) {
          if (variants.some(variant => normalizeUserName(variant) === normalized)) {
            return variants;
          }
        }
        
        return [searchName];
      };

      const variants = getNameVariants(searchName);
      console.log(`🔄 [CREATE-ONLY-SERVICE] Variantes testées:`, variants);
      
      for (const variant of variants) {
        const normalizedVariant = normalizeUserName(variant);
        
        for (const user of allUsers) {
          const normalizedUserName = normalizeUserName(user.name);
          const normalizedEmail = normalizeUserName(user.email?.split('@')[0] || '');
          
          if (normalizedUserName === normalizedVariant || 
              normalizedEmail === normalizedVariant ||
              normalizedUserName.includes(normalizedVariant) ||
              normalizedVariant.includes(normalizedUserName)) {
            console.log(`✅ [CREATE-ONLY-SERVICE] Correspondance trouvée: ${user.name}`);
            return user;
          }
        }
      }
      
      const firstName = normalizeUserName(searchName.split(' ')[0]);
      for (const user of allUsers) {
        const userFirstName = normalizeUserName(user.name.split(' ')[0]);
        if (userFirstName === firstName) {
          console.log(`✅ [CREATE-ONLY-SERVICE] Correspondance par prénom: ${user.name}`);
          return user;
        }
      }
      
      console.log(`⚠️ [CREATE-ONLY-SERVICE] Aucune correspondance trouvée pour "${searchName}"`);
      return null;
    };

    const conciseDescription = makeDescriptionConcise(task.description);
    console.log('📝 Description concise:', conciseDescription);

    // Créer UNIQUEMENT une nouvelle tâche
    const { data: newTask, error } = await supabaseClient
      .from('todos')
      .insert([{
        description: conciseDescription,
        status: 'confirmed',
        due_date: task.due_date || null
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating new task:', error);
      throw error;
    }

    console.log('✅ Nouvelle tâche créée avec ID:', newTask.id);

    // Créer le lien avec la réunion
    const { error: linkError } = await supabaseClient
      .from('todo_meetings')
      .insert([{
        todo_id: newTask.id,
        meeting_id: meetingId
      }]);

    if (linkError) {
      console.error('❌ Error linking task to meeting:', linkError);
    } else {
      console.log('✅ Tâche liée à la réunion:', meetingId);
    }

    // Traiter les assignations avec TOUS les utilisateurs du système
    if (task.assigned_to) {
      console.log('👥 [CREATE-ONLY-SERVICE] Assignation demandée pour:', task.assigned_to);
      
      // Gérer à la fois les chaînes simples et les tableaux
      const assignedUsers = Array.isArray(task.assigned_to) ? task.assigned_to : [task.assigned_to];
      
      for (const userName of assignedUsers) {
        if (!userName || typeof userName !== 'string') continue;
        
        // Chercher parmi TOUS les utilisateurs du système  
        const user = findBestUserMatch(userName.toString(), allUsers || []);
        
        if (user) {
          // Créer l'assignation (pas de vérification d'existant car nouvelles tâches)
          const { error: assignError } = await supabaseClient
            .from('todo_users')
            .insert([{
              todo_id: newTask.id,
              user_id: user.id
            }]);
          
          if (assignError) {
            console.error('❌ [CREATE-ONLY-SERVICE] Error assigning user:', assignError);
          } else {  
            console.log('✅ [CREATE-ONLY-SERVICE] User assigné:', user.name, 'to task:', newTask.id);
          }
        } else {
          console.warn(`⚠️ [CREATE-ONLY-SERVICE] User "${userName}" non trouvé dans le système`);
        }
      }
    } else {
      console.log('ℹ️ [CREATE-ONLY-SERVICE] Pas de users à assigner pour cette tâche');
    }

    return newTask;
  } catch (error) {
    console.error('❌ [CREATE-ONLY-SERVICE] Error in saveTaskUnified:', error);
    throw error;
  }
}
