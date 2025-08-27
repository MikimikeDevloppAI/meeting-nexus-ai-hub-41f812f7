import { callOpenAI } from './openai-service.ts';
import { createSupabaseClient, saveSummary, saveTranscript } from './database-service.ts';

// Types pour la réponse unifiée GPT-5
interface UnifiedTaskResponse {
  description: string;
  assigned_to: string[];
  due_date?: string;
  hasRecommendation: boolean;
  recommendation?: string;
  emailDraft?: string;
  subtasks?: Array<{
    description: string;
    order: number;
  }>;
}

interface UnifiedGPT5Response {
  cleaned_transcript: string;
  summary: string;
  tasks: UnifiedTaskResponse[];
}

export async function processUnifiedGPT5(
  rawTranscript: string,
  meetingId: string,
  participants: string,
  meetingData: any,
  meetingUsers: any[],
  openAIKey: string,
  traceId?: string
): Promise<{ success: boolean; tasksCount: number; summaryGenerated: boolean; transcriptCleaned: boolean }> {
  
  const processTraceId = traceId || `gpt5_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const processStartTime = Date.now();
  
  console.log(`[TRACE:${processTraceId}] 🚀 Starting UNIFIED GPT-5 processing`);
  console.log(`[TRACE:${processTraceId}] 📏 Input validation:`, {
    transcriptLength: rawTranscript?.length || 0,
    participantsString: participants || 'MISSING',
    meetingId: meetingId || 'MISSING',
    meetingUsersCount: meetingUsers?.length || 0,
    meetingTitle: meetingData?.title || 'MISSING',
    hasOpenAIKey: !!openAIKey,
    timestamp: new Date().toISOString()
  });
  
  try {
    // Créer le prompt unifié
    console.log(`[TRACE:${processTraceId}] 📝 Creating unified prompt...`);
    const promptStartTime = Date.now();
    const unifiedPrompt = createUnifiedPrompt(rawTranscript, participants, meetingData, meetingUsers);
    console.log(`[TRACE:${processTraceId}] ✅ Unified prompt created in ${Date.now() - promptStartTime}ms (${unifiedPrompt.length} chars)`);
    
    console.log(`[TRACE:${processTraceId}] 🤖 Starting GPT-5 API call (unlimited tokens)...`);
    console.log(`[TRACE:${processTraceId}] 🔍 Web searches requested in prompt for recommendations`);
    
    const gpt5StartTime = Date.now();
    
    // Appel GPT-5 avec configuration spécialisée
    const gpt5Response = await callOpenAI(
      unifiedPrompt,
      openAIKey,
      undefined, // pas de température pour GPT-5
      'gpt-5-2025-08-07',
      3, // max retries
      undefined, // pas de max tokens pour permettre les longs transcripts
      processTraceId // Pass trace ID to OpenAI service
    );
    
    const gpt5Duration = Date.now() - gpt5StartTime;
    console.log(`[TRACE:${processTraceId}] ⏱️ GPT-5 API call completed in ${gpt5Duration}ms`);
    console.log(`[TRACE:${processTraceId}] 📊 GPT-5 response received:`, {
      responseLength: gpt5Response?.length || 0,
      hasResponse: !!gpt5Response,
      durationMs: gpt5Duration
    });
    
    // Parser la réponse JSON
    console.log('📋 [UNIFIED-GPT5] Parsing JSON response...');
    let parsedResponse: UnifiedGPT5Response;
    
    try {
      // Nettoyer la réponse si elle contient des backticks markdown
      const cleanedResponse = gpt5Response.replace(/```json\n?|\n?```/g, '').trim();
      parsedResponse = JSON.parse(cleanedResponse);
      console.log('✅ [UNIFIED-GPT5] JSON parsing successful');
    } catch (parseError) {
      console.error('❌ [UNIFIED-GPT5] JSON parsing failed:', parseError);
      console.log('📄 [UNIFIED-GPT5] Raw response:', gpt5Response.substring(0, 500) + '...');
      throw new Error(`Failed to parse GPT-5 response: ${parseError.message}`);
    }
    
    console.log(`📋 [UNIFIED-GPT5] Tasks created: ${parsedResponse.tasks?.length || 0}`);
    const totalSubtasks = parsedResponse.tasks?.reduce((sum, task) => sum + (task.subtasks?.length || 0), 0) || 0;
    console.log(`📝 [UNIFIED-GPT5] Total subtasks: ${totalSubtasks}`);
    
    const recommendationsCount = parsedResponse.tasks?.filter(task => task.hasRecommendation)?.length || 0;
    console.log(`💡 [UNIFIED-GPT5] Recommendations generated: ${recommendationsCount}`);
    
    const emailDraftsCount = parsedResponse.tasks?.filter(task => task.emailDraft)?.length || 0;
    console.log(`📧 [UNIFIED-GPT5] Email drafts created: ${emailDraftsCount}`);
    
    // Sauvegarder les résultats en parallèle
    const supabaseClient = createSupabaseClient();
    
    console.log('💾 [UNIFIED-GPT5] Saving cleaned transcript and summary...');
    
    await Promise.all([
      saveTranscript(supabaseClient, meetingId, parsedResponse.cleaned_transcript),
      saveSummary(supabaseClient, meetingId, parsedResponse.summary)
    ]);
    
    console.log('✅ [UNIFIED-GPT5] Transcript and summary saved');
    
    // Traiter les tâches et sous-tâches
    console.log('📋 [UNIFIED-GPT5] Processing tasks and subtasks...');
    
    let tasksCreated = 0;
    if (parsedResponse.tasks && parsedResponse.tasks.length > 0) {
      // Récupérer les todos existants pour éviter les doublons
      const { data: existingTodos } = await supabaseClient
        .from('todos')
        .select('description')
        .order('created_at', { ascending: false })
        .limit(50);
      
      const existingDescriptions = existingTodos?.map(todo => normalizeTaskDescription(todo.description)) || [];
      console.log(`🔍 [UNIFIED-GPT5] Checking against ${existingDescriptions.length} existing tasks for duplicates`);
      
      // Filtrer les doublons
      const filteredTasks = parsedResponse.tasks.filter(task => {
        const normalizedDesc = normalizeTaskDescription(task.description);
        const isDuplicate = existingDescriptions.some(existingDesc => 
          calculateSimilarity(normalizedDesc, existingDesc) > 0.8
        );
        
        if (isDuplicate) {
          console.log(`⚠️ [UNIFIED-GPT5] Skipping duplicate task: ${task.description.substring(0, 50)}...`);
          return false;
        }
        return true;
      });
      
      console.log(`📋 [UNIFIED-GPT5] Creating ${filteredTasks.length} unique tasks (${parsedResponse.tasks.length - filteredTasks.length} duplicates filtered)`);
      
      for (const task of filteredTasks) {
        await saveTaskUnified(supabaseClient, task, meetingId, meetingUsers);
        tasksCreated++;
      }
    }
    
    console.log('🎉 [UNIFIED-GPT5] Processing completed successfully');
    console.log(`📊 [UNIFIED-GPT5] Final stats: ${tasksCreated} tasks, ${totalSubtasks} subtasks, ${recommendationsCount} recommendations`);
    
    return {
      success: true,
      tasksCount: tasksCreated,
      summaryGenerated: !!parsedResponse.summary,
      transcriptCleaned: !!parsedResponse.cleaned_transcript
    };
    
  } catch (error) {
    console.error('❌ [UNIFIED-GPT5] Processing failed:', error);
    throw error;
  }
}

function createUnifiedPrompt(
  rawTranscript: string,
  participants: string,
  meetingData: any,
  meetingUsers: any[]
): string {
  const meetingDate = new Date(meetingData.created_at).toLocaleDateString('fr-FR');
  const meetingName = meetingData.title;
  
  return `Tu es un assistant IA spécialisé dans le traitement complet de transcripts de réunions médicales pour le cabinet Ophtacare à Genève.

INSTRUCTIONS PRINCIPALES:
Tu dois traiter ce transcript en UNE SEULE FOIS et retourner un JSON avec 3 sections: cleaned_transcript, summary, et tasks.

SECTION 1 - NETTOYAGE DU TRANSCRIPT:
- Corriger les erreurs de transcription évidentes
- Enlever les mots d'hésitation ("euh", "hm", "ben", etc.)
- Supprimer répétitions inutiles et faux départs  
- Remplacer "Speaker 1", "Speaker 2", etc. par les vrais noms: ${participants}
- Améliorer ponctuation et structurer en paragraphes
- Corriger orthographe: "Ophtacare", "Liris"
- RECONSTITUER phrases coupées entre speakers
- CONSERVER L'INTÉGRALITÉ DU CONTENU - ne supprime AUCUNE information

SECTION 2 - RÉSUMÉ STRUCTURÉ:
Créer un résumé markdown avec:
**📅 Date:** ${meetingDate}
**💼 Réunion:** ${meetingName}  
**👥 Participants:** ${participants}

Utiliser UNIQUEMENT ces catégories si pertinentes avec emojis:
- 👥 Suivi patient
- 🔬 Matériel médical
- 🖥️ Matériel bureau  
- 🏢 Organisation cabinet
- 🌐 Site internet
- 📚 Formation
- 🔧 Service cabinet
- ⚠️ Problèmes divers
- 📅 Agenda du personnel

Format: 
### [Emoji] [Catégorie]
- Point discuté
  → Décision prise (si applicable) - qui, quoi, quand

SECTION 3 - CRÉATION TÂCHES ET RECHERCHES WEB:
IMPORTANT: Pour chaque tâche, tu DOIS faire des recherches web pour enrichir tes recommandations.

Recherche sur internet:
- Coordonnées de prestataires/fournisseurs suisses  
- Prix et tarifs actuels en Suisse
- Contacts spécialisés ophtalmologie région Genève
- Informations techniques/réglementaires spécifiques
- Solutions et alternatives disponibles

Utilisateurs disponibles pour assignation: ${meetingUsers.map(u => u.name).join(', ')}

RÈGLES TÂCHES:
- Description COMPLÈTE avec contexte nécessaire
- Assignations multiples possibles: ["User1", "User2"]  
- Recommandations UNIQUEMENT dans le champ "recommendation" avec infos web
- Email pré-rédigé avec coordonnées trouvées via recherche web
- Sous-tâches automatiques si nécessaire avec étapes logiques
- Éviter doublons - regrouper sujets similaires
- Dates d'échéance réalistes

ACTIVE LA RECHERCHE WEB ET LE REASONING EFFORT MEDIUM.

RÉPONSE REQUISE - JSON EXACT:
{
  "cleaned_transcript": "Transcript complet nettoyé avec speakers nommés",
  "summary": "Résumé markdown structuré avec emojis",
  "tasks": [
    {
      "description": "Description enrichie avec contexte complet nécessaire",
      "assigned_to": ["Nom1", "Nom2"],
      "due_date": "YYYY-MM-DD", 
      "hasRecommendation": true,
      "recommendation": "Recommandation enrichie avec informations trouvées sur internet: coordonnées, prix, contacts spécialisés, solutions disponibles",
      "emailDraft": "Email pré-rédigé avec coordonnées exactes trouvées via recherche web",
      "subtasks": [
        {"description": "Étape 1: Action précise", "order": 1},
        {"description": "Étape 2: Suite logique", "order": 2}
      ]
    }
  ]
}

TRANSCRIPT À TRAITER:
${rawTranscript}

RÉPONDS UNIQUEMENT AVEC LE JSON, SANS COMMENTAIRES.`;
}

// Fonction pour sauvegarder une tâche unifiée avec ses recommandations et sous-tâches
async function saveTaskUnified(
  supabaseClient: any,
  task: UnifiedTaskResponse,
  meetingId: string,
  meetingUsers: any[]
): Promise<void> {
  console.log(`📝 [UNIFIED-GPT5] Saving task: ${task.description.substring(0, 50)}...`);
  
  try {
    // Récupérer tous les utilisateurs
    const { data: allUsers, error: usersError } = await supabaseClient
      .from('users')
      .select('id, name, email')
      .order('name');

    if (usersError) throw usersError;

    // Créer la tâche principale
    const { data: savedTask, error: taskError } = await supabaseClient
      .from('todos')
      .insert([{
        description: task.description,
        status: 'confirmed',
        due_date: task.due_date || null,
        ai_recommendation_generated: task.hasRecommendation
      }])
      .select()
      .single();

    if (taskError) throw taskError;

    console.log(`✅ [UNIFIED-GPT5] Task created with ID: ${savedTask.id}`);

    // Lier à la réunion
    await supabaseClient
      .from('todo_meetings')
      .insert([{
        todo_id: savedTask.id,
        meeting_id: meetingId
      }]);

    // Assigner les utilisateurs
    if (task.assigned_to && task.assigned_to.length > 0) {
      console.log(`👥 [UNIFIED-GPT5] Assigning ${task.assigned_to.length} users`);
      
      for (const userName of task.assigned_to) {
        const user = findBestUserMatch(userName, allUsers || []);
        if (user) {
          await supabaseClient
            .from('todo_users')
            .insert([{
              todo_id: savedTask.id,
              user_id: user.id
            }]);
          console.log(`✅ [UNIFIED-GPT5] Assigned ${user.name} to task`);
        } else {
          console.warn(`⚠️ [UNIFIED-GPT5] User not found: ${userName}`);
        }
      }
    }

    // Créer la recommandation IA si présente
    if (task.hasRecommendation && task.recommendation) {
      await supabaseClient
        .from('todo_ai_recommendations')
        .insert([{
          todo_id: savedTask.id,
          recommendation_text: task.recommendation,
          email_draft: task.emailDraft || null
        }]);
      console.log(`💡 [UNIFIED-GPT5] AI recommendation created for task`);
    }

    // Créer les sous-tâches si présentes
    if (task.subtasks && task.subtasks.length > 0) {
      console.log(`📝 [UNIFIED-GPT5] Creating ${task.subtasks.length} subtasks`);
      
      for (const subtask of task.subtasks) {
        await supabaseClient
          .from('todo_subtasks')
          .insert([{
            todo_id: savedTask.id,
            description: subtask.description,
            completed: false
          }]);
      }
      console.log(`✅ [UNIFIED-GPT5] All subtasks created`);
    }
    
  } catch (error) {
    console.error(`❌ [UNIFIED-GPT5] Error saving task:`, error);
    throw error;
  }
}

// Fonctions utilitaires
function normalizeTaskDescription(description: string): string {
  return description
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

function findBestUserMatch(searchName: string, allUsers: any[]): any | null {
  if (!searchName || !allUsers?.length) return null;

  const nameVariants = getNameVariants(searchName);
  
  for (const variant of nameVariants) {
    const normalizedVariant = normalizeUserName(variant);
    
    for (const user of allUsers) {
      const normalizedUserName = normalizeUserName(user.name);
      const normalizedEmail = normalizeUserName(user.email?.split('@')[0] || '');
      
      if (normalizedUserName === normalizedVariant || 
          normalizedEmail === normalizedVariant ||
          normalizedUserName.includes(normalizedVariant) ||
          normalizedVariant.includes(normalizedUserName)) {
        return user;
      }
    }
  }
  
  const firstName = normalizeUserName(searchName.split(' ')[0]);
  for (const user of allUsers) {
    const userFirstName = normalizeUserName(user.name.split(' ')[0]);
    if (userFirstName === firstName) {
      return user;
    }
  }
  
  return null;
}

function getNameVariants(searchName: string): string[] {
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
}

function normalizeUserName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}