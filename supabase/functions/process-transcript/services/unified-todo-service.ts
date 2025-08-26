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

    console.log(`⚡ [UNIFIED-TODO-SERVICE] DÉBUT génération UNIFIÉE todos + recommandations avec GPT-5-Mini`);
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

    // Prompt unifié avec descriptions plus concises et contexte des todos existants
    const unifiedPrompt = `Basé sur ce transcript de réunion, identifie et REGROUPE INTELLIGEMMENT toutes les tâches, actions et suivis par SUJETS COHÉRENTS pour éviter les doublons. Privilégie le regroupement pour minimiser le nombre de tâches.

TOUS LES UTILISATEURS SYSTÈME : ${allUserNames}
PARTICIPANTS À CETTE RÉUNION : ${meetingUserNames}

**TODOS EXISTANTS À ÉVITER (ne pas recréer de doublons) :**
${existingTodosContext.length > 0 ? existingTodosContext.map(todo => 
  `- ${todo.description} (${todo.status}) | Assigné: ${todo.assignedUsers.join(', ') || 'Non assigné'}`
).join('\n') : 'Aucun todo existant'}

**RÈGLE CRITIQUE : ÉVITER LES DOUBLONS**
- VÉRIFIE attentivement les tâches existantes ci-dessus
- Si une tâche similaire existe déjà (même sujet, même action), NE PAS la recréer
- Seules les nouvelles tâches vraiment différentes doivent être créées
- En cas de doute, privilégier de NE PAS créer plutôt que de dupliquer

**RÈGLES DE REGROUPEMENT OBLIGATOIRES:**
- Regroupe toutes les actions liées au MÊME SUJET/FOURNISSEUR/OUTIL en UNE SEULE tâche
- Une tâche = un sujet principal avec un contexte CONCIS et ACTIONNABLE
- Évite absolument les doublons (ex: "contacter X" et "appeler X" = 1 seule tâche)
- Regroupe les actions séquentielles (ex: "demander devis" + "comparer prix" + "négocier" = 1 tâche complète)
- Privilégie les macro-tâches sur les micro-actions
- VÉRIFIE d'abord si une tâche similaire existe déjà avant de créer

**RÈGLES DE DESCRIPTION CONCISE:**
- description concise mais qui donne le contexte nécessaire pour la compréhension
- Utilise un verbe d'action clair (Contacter, Organiser, Vérifier, Finaliser, etc.)
- Format: "Action + Objet + Contexte "

**RÈGLES D'ASSIGNATION ÉTENDUES:**
- Tu peux assigner à N'IMPORTE QUEL utilisateur du système (liste complète ci-dessus)
- PRIVILÉGIE les participants à cette réunion : ${meetingUserNames}
- Variantes acceptées pour correspondance :
  • Leïla / leila / Leila
  • Émilie / emilie / Emilie  
  • David / david / David Tabibian / Tabibian
  • Parmice / parmice / Parmis
  • Sybil / sybil
- Si une personne dit "je vais faire X" → assigne à cette personne
- Si plusieurs personnes impliquées → assigne à la personne principale
- Si aucune assignation claire, laisse "assigned_to" à null

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
- Utilisateurs PRÉSENTS: ${userNames}

Transcript :
${cleanedTranscript}

IMPORTANT: Retourne UNIQUEMENT un JSON valide avec cette structure exacte :
{
  "tasks": [
    {
      "description": "Action concise et claire avec contexte ",
      "assigned_to": ["Nom exact de l'utilisateur tel qu'il apparaît dans la liste"] ou null,
      "due_date": "YYYY-MM-DD ou YYYY-MM-DDTHH:MM:SSZ si échéance mentionnée, sinon null",
      "hasRecommendation": true/false,
      "recommendation": "Recommandation détaillée ou 'Aucune recommandation nécessaire.'",
      "emailDraft": "Email COMPLET (optionnel)" ou null
    }
  ]
}

**RÈGLES POUR LES DATES D'ÉCHÉANCE:**
- Si une date ou délai est mentionné dans la discussion ("dans 2 semaines", "avant le 15", "d'ici vendredi", "urgent"), calcule la date d'échéance correspondante
- Utilise le format ISO standard : YYYY-MM-DDTHH:MM:SSZ pour les dates avec heure, ou YYYY-MM-DD pour les dates simples
- Date de référence : ${new Date().toISOString().split('T')[0]} (aujourd'hui)
- Si aucune échéance n'est mentionnée, laisse due_date à null
- Exemples de calculs :
  * "dans 2 semaines" → ajouter 14 jours à aujourd'hui
  * "avant vendredi" → calculer le prochain vendredi
  * "fin du mois" → dernier jour du mois actuel
  * "urgent" → dans 2-3 jours selon le contexte`;

    console.log(`🚀 [UNIFIED-TODO-SERVICE] Traitement UNIFIÉ avec GPT-5-Mini-2025-08-07`);
    
    const callStartTime = Date.now();
    const unifiedResponse = await callOpenAI(unifiedPrompt, openaiApiKey, null, 'gpt-5-mini-2025-08-07', 3, 16384);
    const callDuration = Date.now() - callStartTime;
    
    console.log(`⏱️ [UNIFIED-TODO-SERVICE] Appel unifié terminé (${callDuration}ms)`);
    
    // ============= LOGS COMPLETS OPENAI RESPONSE =============
    console.log(`📊 [UNIFIED-TODO-SERVICE] DIAGNOSTIC MEETING ${meetingData.id} - DÉBUT`);
    console.log(`📊 [UNIFIED-TODO-SERVICE] Timestamp: ${new Date().toISOString()}`);
    console.log(`📊 [UNIFIED-TODO-SERVICE] Meeting Title: ${meetingData.title || 'N/A'}`);
    console.log(`📊 [UNIFIED-TODO-SERVICE] Transcript Length: ${cleanedTranscript?.length || 0} chars`);
    console.log(`📊 [UNIFIED-TODO-SERVICE] Model Used: gpt-5-mini-2025-08-07`);
    console.log(`📊 [UNIFIED-TODO-SERVICE] Call Duration: ${callDuration}ms`);
    
    // LOG COMPLET DE LA RÉPONSE OPENAI (pas juste un aperçu)
    console.log(`🧠 [UNIFIED-TODO-SERVICE] RÉPONSE OPENAI COMPLÈTE - Length: ${unifiedResponse?.length || 0}`);
    console.log(`🧠 [UNIFIED-TODO-SERVICE] RÉPONSE OPENAI RAW START:`);
    console.log(unifiedResponse || 'RESPONSE IS NULL/UNDEFINED');
    console.log(`🧠 [UNIFIED-TODO-SERVICE] RÉPONSE OPENAI RAW END`);

    // Parser la réponse avec logs détaillés
    let tasksWithRecommendations = [];
    let cleanedResponse = '';
    let parsedData = null;
    
    try {
      console.log('🔄 [UNIFIED-TODO-SERVICE] ÉTAPE 1: Analyse de la réponse brute');
      console.log(`📄 [UNIFIED-TODO-SERVICE] Raw response type: ${typeof unifiedResponse}`);
      console.log(`📄 [UNIFIED-TODO-SERVICE] Raw response is null/undefined: ${!unifiedResponse}`);
      console.log(`📄 [UNIFIED-TODO-SERVICE] Raw response length: ${unifiedResponse?.length || 0}`);
      
      if (!unifiedResponse) {
        throw new Error('OpenAI response is null or undefined');
      }
      
      // Nettoyer la réponse avant de parser
      console.log('🧼 [UNIFIED-TODO-SERVICE] ÉTAPE 2: Nettoyage de la réponse');
      console.log('🧼 [UNIFIED-TODO-SERVICE] Réponse AVANT nettoyage (premiers 500 chars):');
      console.log(unifiedResponse.substring(0, 500));
      console.log('🧼 [UNIFIED-TODO-SERVICE] Réponse AVANT nettoyage (derniers 500 chars):');
      console.log(unifiedResponse.substring(Math.max(0, unifiedResponse.length - 500)));
      
      cleanedResponse = unifiedResponse.trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```\s*$/i, '');
      
      console.log('🧼 [UNIFIED-TODO-SERVICE] Réponse APRÈS nettoyage - Length:', cleanedResponse.length);
      console.log('🧼 [UNIFIED-TODO-SERVICE] Réponse APRÈS nettoyage (premiers 500 chars):');
      console.log(cleanedResponse.substring(0, 500));
      console.log('🧼 [UNIFIED-TODO-SERVICE] Réponse APRÈS nettoyage (derniers 500 chars):');
      console.log(cleanedResponse.substring(Math.max(0, cleanedResponse.length - 500)));
      
      // Tentative de parsing JSON
      console.log('📋 [UNIFIED-TODO-SERVICE] ÉTAPE 3: Tentative de parsing JSON');
      console.log('📋 [UNIFIED-TODO-SERVICE] String to parse (first char):', cleanedResponse.charAt(0));
      console.log('📋 [UNIFIED-TODO-SERVICE] String to parse (last char):', cleanedResponse.charAt(cleanedResponse.length - 1));
      
      parsedData = JSON.parse(cleanedResponse);
      console.log('✅ [UNIFIED-TODO-SERVICE] JSON parsing successful!');
      console.log('📋 [UNIFIED-TODO-SERVICE] Parsed data type:', typeof parsedData);
      console.log('📋 [UNIFIED-TODO-SERVICE] Parsed data keys:', Object.keys(parsedData || {}));
      
      // Validation de la structure
      console.log('🔍 [UNIFIED-TODO-SERVICE] ÉTAPE 4: Validation de la structure');
      console.log('🔍 [UNIFIED-TODO-SERVICE] Has "tasks" property:', 'tasks' in (parsedData || {}));
      console.log('🔍 [UNIFIED-TODO-SERVICE] Tasks property type:', typeof parsedData?.tasks);
      console.log('🔍 [UNIFIED-TODO-SERVICE] Tasks is array:', Array.isArray(parsedData?.tasks));
      
      tasksWithRecommendations = parsedData.tasks || [];
      console.log(`📋 [UNIFIED-TODO-SERVICE] Extracted ${tasksWithRecommendations.length} tasks`);
      
      // Log détaillé de chaque tâche
      console.log('🔍 [UNIFIED-TODO-SERVICE] ÉTAPE 5: Validation des tâches individuelles');
      tasksWithRecommendations.forEach((task, index) => {
        console.log(`📋 [UNIFIED-TODO-SERVICE] Task ${index + 1}:`);
        console.log(`   - Description: "${task.description || 'MISSING'}"`);
        console.log(`   - Assigned to: ${JSON.stringify(task.assigned_to)}`);
        console.log(`   - Due date: ${task.due_date || 'null'}`);
        console.log(`   - Has recommendation: ${task.hasRecommendation}`);
        console.log(`   - Recommendation length: ${task.recommendation?.length || 0}`);
        console.log(`   - Has email draft: ${!!task.emailDraft}`);
        
        // Validation de chaque tâche
        if (!task.description || task.description.trim() === '') {
          console.warn(`⚠️ [UNIFIED-TODO-SERVICE] Task ${index + 1} has empty/missing description!`);
        }
        if (task.assigned_to && !Array.isArray(task.assigned_to)) {
          console.warn(`⚠️ [UNIFIED-TODO-SERVICE] Task ${index + 1} assigned_to is not an array:`, typeof task.assigned_to);
        }
      });
      
      if (tasksWithRecommendations.length === 0) {
        console.warn('⚠️ [UNIFIED-TODO-SERVICE] ALERTE: 0 tâche extraite!');
        console.warn('⚠️ [UNIFIED-TODO-SERVICE] Parsed data full object:');
        console.warn(JSON.stringify(parsedData, null, 2));
      }
      
    } catch (parseError) {
      console.error('❌ [UNIFIED-TODO-SERVICE] ERREUR PARSING JSON - DIAGNOSTIC COMPLET');
      console.error('❌ [UNIFIED-TODO-SERVICE] Error type:', parseError.constructor.name);
      console.error('❌ [UNIFIED-TODO-SERVICE] Error message:', parseError.message);
      console.error('❌ [UNIFIED-TODO-SERVICE] Error at position:', parseError.message.match(/position (\d+)/)?.[1] || 'unknown');
      
      // Log de la zone problématique
      if (parseError.message.includes('position')) {
        const position = parseInt(parseError.message.match(/position (\d+)/)?.[1] || '0');
        const start = Math.max(0, position - 100);
        const end = Math.min(cleanedResponse.length, position + 100);
        console.error('❌ [UNIFIED-TODO-SERVICE] Problematic area (±100 chars around error):');
        console.error(cleanedResponse.substring(start, end));
        console.error('❌ [UNIFIED-TODO-SERVICE] Error position marker (^):');
        console.error(' '.repeat(position - start) + '^');
      }
      
      // Log complete de debug
      console.error('❌ [UNIFIED-TODO-SERVICE] Complete cleaned response for debug:');
      console.error(cleanedResponse);
      
      // Caractères spéciaux
      console.error('❌ [UNIFIED-TODO-SERVICE] First 10 chars codes:', 
        Array.from(cleanedResponse.substring(0, 10)).map(c => c.charCodeAt(0)));
      console.error('❌ [UNIFIED-TODO-SERVICE] Last 10 chars codes:', 
        Array.from(cleanedResponse.substring(cleanedResponse.length - 10)).map(c => c.charCodeAt(0)));
      
      throw new Error(`Failed to parse unified response: ${parseError.message}`);
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
        
        // 1. Créer la nouvelle tâche
        const savedTask = await saveTaskUnified(supabaseClient, taskData, meetingData.id, users, allUsers);
        
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
    
    // ============= LOG RÉCAPITULATIF FINAL PAR RÉUNION =============
    console.log(`📊 [UNIFIED-TODO-SERVICE] ===== RÉSUMÉ MEETING ${meetingData.id} =====`);
    console.log(`📊 [UNIFIED-TODO-SERVICE] Meeting: "${meetingData.title}"`);
    console.log(`📊 [UNIFIED-TODO-SERVICE] Timestamp fin: ${new Date().toISOString()}`);
    console.log(`📊 [UNIFIED-TODO-SERVICE] Durée totale: ${Date.now() - callStartTime}ms`);
    console.log(`📊 [UNIFIED-TODO-SERVICE] Participants: ${users?.map(p => p.name).join(', ') || 'N/A'}`);
    console.log(`📊 [UNIFIED-TODO-SERVICE] Transcript chars: ${cleanedTranscript?.length || 0}`);
    console.log(`📊 [UNIFIED-TODO-SERVICE] OpenAI Response chars: ${unifiedResponse?.length || 0}`);
    console.log(`📊 [UNIFIED-TODO-SERVICE] Parsing success: ${tasksWithRecommendations.length > 0 ? 'OUI' : 'NON'}`);
    console.log(`📊 [UNIFIED-TODO-SERVICE] Tasks extraites: ${tasksWithRecommendations.length}`);
    console.log(`📊 [UNIFIED-TODO-SERVICE] Tasks sauvegardées: ${totalSuccessful}`);
    console.log(`📊 [UNIFIED-TODO-SERVICE] Erreurs: ${totalFailed}`);
    console.log(`📊 [UNIFIED-TODO-SERVICE] Success rate: ${tasksWithRecommendations.length > 0 ? Math.round((totalSuccessful / tasksWithRecommendations.length) * 100) : 0}%`);
    console.log(`📊 [UNIFIED-TODO-SERVICE] Tasks sauvegardées IDs: ${savedTasks.map(t => t.id).join(', ') || 'AUCUNE'}`);
    console.log(`📊 [UNIFIED-TODO-SERVICE] ===== FIN RÉSUMÉ MEETING ${meetingData.id} =====`);
    
    return {
      processed: tasksWithRecommendations.length,
      successful: totalSuccessful,
      failed: totalFailed,
      fullyCompleted: true,
      savedTasks: savedTasks,
      unified: true,
      model: 'gpt-5-mini-2025-08-07'
    };
    
  } catch (error) {
    console.error('❌ [UNIFIED-TODO-SERVICE] Erreur générale:', error);
    console.error('🔍 [UNIFIED-TODO-SERVICE] Stack trace:', error.stack);
    console.error('🔍 [UNIFIED-TODO-SERVICE] Error type:', typeof error);
    console.error('🔍 [UNIFIED-TODO-SERVICE] Error name:', error.name);
    return { 
      processed: 0, 
      successful: 0, 
      failed: 0,
      fullyCompleted: false,
      error: error.message,
      unified: true,
      model: 'gpt-5-mini-2025-08-07'
    };
  }
}

// Fonction pour sauvegarder une nouvelle tâche uniquement
async function saveTaskUnified(supabaseClient: any, task: any, meetingId: string, meetingUsers: any[], allUsers: any[]) {
  console.log('💾 Creating new task:', task.description);
  console.log('👥 Participants de la réunion:', meetingUsers?.map(p => ({ id: p.id, name: p.name })));
  console.log('👥 Tous les utilisateurs système:', allUsers?.map(u => ({ id: u.id, name: u.name })));
  
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

      console.log(`🔍 [UNIFIED-TODO-SERVICE] Recherche "${searchName}" parmi TOUS les utilisateurs système`);

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
      console.log(`🔄 [UNIFIED-TODO-SERVICE] Variantes testées:`, variants);
      
      for (const variant of variants) {
        const normalizedVariant = normalizeUserName(variant);
        
        for (const user of allUsers) {
          const normalizedUserName = normalizeUserName(user.name);
          const normalizedEmail = normalizeUserName(user.email?.split('@')[0] || '');
          
          if (normalizedUserName === normalizedVariant || 
              normalizedEmail === normalizedVariant ||
              normalizedUserName.includes(normalizedVariant) ||
              normalizedVariant.includes(normalizedUserName)) {
            console.log(`✅ [UNIFIED-TODO-SERVICE] Correspondance trouvée: ${user.name}`);
            return user;
          }
        }
      }
      
      const firstName = normalizeUserName(searchName.split(' ')[0]);
      for (const user of allUsers) {
        const userFirstName = normalizeUserName(user.name.split(' ')[0]);
        if (userFirstName === firstName) {
          console.log(`✅ [UNIFIED-TODO-SERVICE] Correspondance par prénom: ${user.name}`);
          return user;
        }
      }
      
      console.log(`⚠️ [UNIFIED-TODO-SERVICE] Aucune correspondance trouvée pour "${searchName}"`);
      return null;
    };

    console.log('🆕 [UNIFIED-TODO-SERVICE] CREATE nouvelle tâche');
    
    const conciseDescription = makeDescriptionConcise(task.description);
    console.log('📝 Description concise:', conciseDescription);

    // Créer la nouvelle tâche sans meeting_id
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

    const savedTask = newTask;
    console.log('✅ Nouvelle tâche créée avec ID:', savedTask.id);

    // Créer le lien avec la réunion
    const { error: linkError } = await supabaseClient
      .from('todo_meetings')
      .insert([{
        todo_id: savedTask.id,
        meeting_id: meetingId
      }]);

    if (linkError) {
      console.error('❌ Error linking task to meeting:', linkError);
    }
    
    // Traiter les assignations avec TOUS les utilisateurs du système
    if (task.assigned_to && Array.isArray(task.assigned_to) && task.assigned_to.length > 0) {
      console.log('👥 [UNIFIED-TODO-SERVICE] Assignation demandée pour:', task.assigned_to);
      
      for (const userName of task.assigned_to) {
        if (!userName || typeof userName !== 'string') continue;
        
        // Chercher parmi TOUS les utilisateurs du système
        const user = findBestUserMatch(userName.toString(), allUsers || []);
        
        if (user) {
          // Vérifier si l'assignation existe déjà
          const { data: existingAssignment } = await supabaseClient
            .from('todo_users')
            .select('id')
            .eq('todo_id', savedTask.id)
            .eq('user_id', user.id)
            .single();

          if (!existingAssignment) {
            const { error: assignError } = await supabaseClient
              .from('todo_users')
              .insert([{
                todo_id: savedTask.id,
                user_id: user.id
              }]);
            
            if (assignError) {
              console.error('❌ [UNIFIED-TODO-SERVICE] Error assigning user:', assignError);
            } else {
              console.log('✅ [UNIFIED-TODO-SERVICE] User assigné:', user.name, 'to task:', savedTask.id);
            }
          } else {
            console.log('ℹ️ [UNIFIED-TODO-SERVICE] User déjà assigné:', user.name);
          }
        } else {
          console.warn(`⚠️ [UNIFIED-TODO-SERVICE] User "${userName}" non trouvé dans le système`);
        }
      }
    } else {
      console.log('ℹ️ [UNIFIED-TODO-SERVICE] Pas de users à assigner pour cette tâche');
    }

    return savedTask;
  } catch (error) {
    console.error('❌ [UNIFIED-TODO-SERVICE] Error in saveTaskUnified:', error);
    throw error;
  }
}