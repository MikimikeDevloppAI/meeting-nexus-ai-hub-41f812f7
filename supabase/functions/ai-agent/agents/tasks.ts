export interface TaskContext {
  currentTasks: any[];
  taskCreated?: any;
  hasTaskContext: boolean;
  taskAction?: 'list' | 'create' | 'update' | 'complete';
  pendingTaskCreation?: {
    description: string;
    waitingForAssignment: boolean;
  };
}

export class TaskAgent {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  // Fonction pour normaliser les noms et améliorer la correspondance
  private normalizeParticipantName(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
      .trim();
  }

  // Fonction pour trouver le meilleur participant correspondant dans TOUS les participants
  private async findBestParticipantMatch(searchName: string): Promise<any | null> {
    if (!searchName) return null;

    console.log(`[TASKS] 🔍 Recherche correspondance pour: "${searchName}"`);
    
    // Récupérer TOUS les participants de la base de données
    const { data: allParticipants, error } = await this.supabase
      .from('participants')
      .select('id, name, email')
      .order('name');

    if (error || !allParticipants?.length) {
      console.error('[TASKS] ❌ Erreur récupération participants:', error);
      return null;
    }

    console.log(`[TASKS] 👥 Total participants disponibles: ${allParticipants.length}`);
    
    const normalizedSearch = this.normalizeParticipantName(searchName);
    
    // Variantes de noms connues
    const nameVariants: Record<string, string[]> = {
      'leila': ['leïla', 'leila'],
      'emilie': ['émilie', 'emilie'],
      'david': ['david', 'david tabibian'],
      'parmice': ['parmice', 'parmis'],
      'sybil': ['sybil'],
      'tabibian': ['tabibian', 'dr tabibian']
    };
    
    // 1. Correspondance exacte avec variantes
    for (const participant of allParticipants) {
      const normalizedParticipantName = this.normalizeParticipantName(participant.name);
      const normalizedEmail = this.normalizeParticipantName(participant.email?.split('@')[0] || '');
      
      // Test direct
      if (normalizedParticipantName === normalizedSearch || normalizedEmail === normalizedSearch) {
        console.log(`[TASKS] ✅ Correspondance exacte: ${participant.name}`);
        return participant;
      }
      
      // Test avec variantes
      for (const [key, variants] of Object.entries(nameVariants)) {
        if (variants.some(variant => this.normalizeParticipantName(variant) === normalizedSearch)) {
          if (variants.some(variant => this.normalizeParticipantName(variant) === normalizedParticipantName)) {
            console.log(`[TASKS] ✅ Correspondance variante: ${participant.name}`);
            return participant;
          }
        }
      }
    }
    
    // 2. Correspondance partielle
    for (const participant of allParticipants) {
      const normalizedParticipantName = this.normalizeParticipantName(participant.name);
      if (normalizedParticipantName.includes(normalizedSearch) || normalizedSearch.includes(normalizedParticipantName)) {
        console.log(`[TASKS] ✅ Correspondance partielle: ${participant.name}`);
        return participant;
      }
    }
    
    console.log(`[TASKS] ⚠️ Aucune correspondance trouvée pour: "${searchName}"`);
    return null;
  }

  async handleTaskRequest(message: string, analysis: any, conversationHistory: any[] = []): Promise<TaskContext> {
    console.log('[TASKS] 📋 Gestion spécialisée des tâches');
    
    const context: TaskContext = {
      currentTasks: [],
      hasTaskContext: false,
      taskAction: this.detectTaskAction(message, conversationHistory)
    };

    // Détecter les requêtes sur les tâches récurrentes ou planifiées
    const isRecurrentQuery = this.isRecurrentTaskQuery(message);
    const isParticipantQuery = this.extractParticipantFromQuery(message);
    
    if (isRecurrentQuery || isParticipantQuery) {
      console.log('[TASKS] 🔄 Requête tâches récurrentes/participant détectée');
      
      // Recherche élargie incluant les tâches complétées et l'historique
      const { data: allTasks } = await this.supabase
        .from('todos')
        .select(`
          id, description, status, due_date, created_at, meeting_id,
          participants:todo_participants(
            participant:participants(id, name, email)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50); // Plus de résultats pour l'analyse

      if (allTasks && allTasks.length > 0) {
        // Filtrer par participant si spécifié
        let filteredTasks = allTasks;
        if (isParticipantQuery) {
          filteredTasks = this.filterTasksByParticipant(allTasks, isParticipantQuery);
          console.log(`[TASKS] 👤 Filtrage par participant "${isParticipantQuery}": ${filteredTasks.length} tâches trouvées`);
        }

        // Analyser les patterns récurrents
        if (isRecurrentQuery) {
          const recurringTasks = this.analyzeRecurringPatterns(filteredTasks, message);
          console.log(`[TASKS] 🔄 Analyse récurrence: ${recurringTasks.length} patterns trouvés`);
          context.currentTasks = recurringTasks;
        } else {
          context.currentTasks = filteredTasks;
        }
        
        context.hasTaskContext = true;
        context.taskAction = 'list';
        console.log(`[TASKS] ✅ ${context.currentTasks.length} tâches contextuelles trouvées`);
      }
    } else {
      // Logique existante pour les autres types de requêtes
      const { data: allTasks } = await this.supabase
        .from('todos')
        .select(`
          id, description, status, due_date, created_at, meeting_id,
          participants:todo_participants(
            participant:participants(id, name, email)
          )
        `)
        .in('status', ['pending', 'confirmed'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (allTasks && allTasks.length > 0) {
        context.currentTasks = allTasks;
        context.hasTaskContext = true;
        console.log(`[TASKS] ✅ ${allTasks.length} tâches en cours trouvées`);
      }
    }

    // Vérifier si c'est une réponse à une demande d'assignation précédente
    const isAssignmentResponse = this.checkForAssignmentResponse(message, conversationHistory);
    
    if (isAssignmentResponse) {
      const previousTaskRequest = this.findPreviousTaskRequest(conversationHistory);
      if (previousTaskRequest) {
        console.log('[TASKS] ➕ Création tâche avec assignation depuis réponse utilisateur');
        
        const taskDescription = this.extractTaskDescription(previousTaskRequest);
        const participant = await this.findBestParticipantMatch(message.trim());
        
        if (taskDescription) {
          const shortDescription = this.makeDescriptionConcise(taskDescription);
          
          const { data: newTask, error } = await this.supabase
            .from('todos')
            .insert([{
              description: shortDescription,
              status: 'confirmed',
              assigned_to: participant?.id || null,
              meeting_id: null
            }])
            .select()
            .single();

          if (!error && newTask) {
            // Créer la relation todo_participants si participant trouvé
            if (participant) {
              await this.supabase.from('todo_participants').insert({
                todo_id: newTask.id,
                participant_id: participant.id
              });
              console.log('[TASKS] ✅ Participant assigné:', participant.name);
            }
            
            context.taskCreated = newTask;
            context.currentTasks.unshift(newTask);
            context.taskAction = 'create';
            console.log('[TASKS] ✅ Tâche créée:', newTask.id);
          } else {
            console.log('[TASKS] ❌ Erreur création tâche:', error);
          }
        }
      }
    }
    // Si demande de création de tâche directe
    else if (context.taskAction === 'create') {
      const taskDescription = this.extractTaskDescription(message);
      if (taskDescription) {
        console.log('[TASKS] ➕ Création d\'une nouvelle tâche:', taskDescription);
        
        const shortDescription = this.makeDescriptionConcise(taskDescription);
        const participantName = this.extractAssignedToFromMessage(message);
        
        let participant = null;
        if (participantName) {
          participant = await this.findBestParticipantMatch(participantName);
        }
        
        if (participant) {
          // Création directe avec assignation
          const { data: newTask, error } = await this.supabase
            .from('todos')
            .insert([{
              description: shortDescription,
              status: 'confirmed',
              assigned_to: participant.id,
              meeting_id: null
            }])
            .select()
            .single();

          if (!error && newTask) {
            // Créer la relation todo_participants
            await this.supabase.from('todo_participants').insert({
              todo_id: newTask.id,
              participant_id: participant.id
            });
            
            context.taskCreated = newTask;
            context.currentTasks.unshift(newTask);
            console.log('[TASKS] ✅ Nouvelle tâche créée:', newTask.id, 'assignée à:', participant.name);
          } else {
            console.log('[TASKS] ❌ Erreur création tâche:', error);
          }
        } else {
          // Pas d'assignation trouvée - demander à qui assigner
          context.pendingTaskCreation = {
            description: shortDescription,
            waitingForAssignment: true
          };
          console.log('[TASKS] ⏳ Tâche en attente d\'assignation');
        }
      }
    }

    return context;
  }

  private isRecurrentTaskQuery(message: string): boolean {
    const recurringKeywords = [
      'tous les', 'chaque', 'toutes les', 'récurrent', 'régulier',
      'hebdomadaire', 'quotidien', 'mensuel', 'habituel', 'planifié'
    ];
    
    const lowerMessage = message.toLowerCase();
    return recurringKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  private extractParticipantFromQuery(message: string): string | null {
    const participantNames = ['emilie', 'david', 'leila', 'parmice', 'sybil', 'tabibian'];
    const lowerMessage = message.toLowerCase();
    
    for (const name of participantNames) {
      if (lowerMessage.includes(name)) {
        console.log(`[TASKS] 👤 Participant détecté: ${name}`);
        return name;
      }
    }
    return null;
  }

  private filterTasksByParticipant(tasks: any[], participantName: string): any[] {
    return tasks.filter(task => {
      if (!task.participants || !Array.isArray(task.participants)) return false;
      
      return task.participants.some((p: any) => {
        const participant = p.participant;
        if (!participant) return false;
        
        const name = participant.name?.toLowerCase() || '';
        const email = participant.email?.toLowerCase() || '';
        
        return name.includes(participantName.toLowerCase()) || 
               email.includes(participantName.toLowerCase());
      });
    });
  }

  private analyzeRecurringPatterns(tasks: any[], query: string): any[] {
    // Analyser les jours de la semaine mentionnés
    const dayKeywords = {
      'lundi': 'monday',
      'mardi': 'tuesday', 
      'mercredi': 'wednesday',
      'jeudi': 'thursday',
      'vendredi': 'friday',
      'samedi': 'saturday',
      'dimanche': 'sunday'
    };

    const lowerQuery = query.toLowerCase();
    let targetDay = null;
    
    for (const [frenchDay, englishDay] of Object.entries(dayKeywords)) {
      if (lowerQuery.includes(frenchDay)) {
        targetDay = englishDay;
        break;
      }
    }

    if (targetDay) {
      console.log(`[TASKS] 📅 Jour cible détecté: ${targetDay}`);
      
      // Filtrer les tâches par jour de la semaine (basé sur due_date ou created_at)
      return tasks.filter(task => {
        const date = new Date(task.due_date || task.created_at);
        const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        return dayOfWeek === targetDay;
      });
    }

    // Si pas de jour spécifique, retourner toutes les tâches avec pattern récurrent
    return tasks.filter(task => {
      const description = task.description?.toLowerCase() || '';
      return description.includes('chaque') || 
             description.includes('tous les') || 
             description.includes('hebdomadaire') ||
             description.includes('régulier');
    });
  }

  private checkForAssignmentResponse(message: string, conversationHistory: any[]): boolean {
    if (conversationHistory.length === 0) return false;
    
    // Chercher dans les 3 derniers messages de l'assistant
    const recentAssistantMessages = conversationHistory
      .filter(msg => !msg.isUser)
      .slice(-3);
    
    const assignmentQuestion = recentAssistantMessages.some(msg => 
      msg.content && (
        msg.content.includes('qui devrais-je assigner') ||
        msg.content.includes('À qui devrais-je assigner') ||
        msg.content.includes('assigner cette tâche') ||
        msg.content.includes('choisir parmi les participants')
      )
    );
    
    if (assignmentQuestion) {
      // Vérifier si le message actuel ressemble à un nom de personne
      const lowerMessage = message.toLowerCase().trim();
      const commonNames = ['emilie', 'david', 'leila', 'parmice', 'sybil', 'tabibian'];
      const isLikelyName = commonNames.some(name => lowerMessage.includes(name)) || 
                          (lowerMessage.length < 50 && /^[a-zàâäéèêëïîôùûüÿç\s-]+$/i.test(lowerMessage));
      
      console.log('[TASKS] 🔍 Vérification réponse assignation:', { assignmentQuestion, isLikelyName, message });
      return isLikelyName;
    }
    
    return false;
  }

  private findPreviousTaskRequest(conversationHistory: any[]): string | null {
    // Chercher le dernier message utilisateur qui demandait de créer une tâche
    const userMessages = conversationHistory.filter(msg => msg.isUser);
    
    for (let i = userMessages.length - 1; i >= 0; i--) {
      const msg = userMessages[i];
      if (this.detectTaskAction(msg.content, []) === 'create') {
        console.log('[TASKS] 🔍 Trouvé demande tâche précédente:', msg.content);
        return msg.content;
      }
    }
    
    return null;
  }

  private extractAssignedToFromMessage(message: string): string | null {
    // Chercher des patterns comme "pour David", "à Emilie", etc.
    const patterns = [
      /(?:pour|à|assigner?\s+à)\s+([a-zA-ZÀ-ÿ\s]+)/i,
      /([a-zA-ZÀ-ÿ]+)\s+(?:doit|va|peut)\s+/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return null;
  }

  private makeDescriptionConcise(description: string): string {
    let cleaned = description.replace(/CONTEXT_PARTICIPANTS:.*$/gi, '').trim();
    cleaned = cleaned.replace(/\n+/g, ' ').trim();
    
    if (cleaned.length > 150) {
      const firstSentence = cleaned.split('.')[0];
      if (firstSentence.length > 0 && firstSentence.length < 150) {
        return firstSentence.trim();
      }
      return cleaned.substring(0, 147).trim() + '...';
    }
    return cleaned;
  }

  private detectTaskAction(message: string, conversationHistory: any[] = []): 'list' | 'create' | 'update' | 'complete' | undefined {
    const lowerMessage = message.toLowerCase();
    
    // Détection création - patterns plus spécifiques
    const createPatterns = [
      'créé une tâche', 'créer une tâche', 'nouvelle tâche', 'ajouter une tâche', 
      'crée une tâche', 'faire une tâche', 'créé une action', 'créer une action',
      'nouvelle action', 'ajouter une action', 'crée une action', 'action pour',
      'tâche pour', 'fais une tâche', 'fais une action', 'assigne', 'assigné'
    ];
    
    if (createPatterns.some(pattern => lowerMessage.includes(pattern))) {
      console.log('[TASKS] 🎯 Détection CREATE détectée');
      return 'create';
    }

    // Détection listing/consultation
    const listPatterns = [
      'tâches en cours', 'mes tâches', 'voir les tâches', 'liste des tâches',
      'tâches à faire', 'que dois-je faire', 'quelles sont les tâches'
    ];
    
    if (listPatterns.some(pattern => lowerMessage.includes(pattern))) {
      console.log('[TASKS] 📋 Détection LIST détectée');
      return 'list';
    }

    return undefined;
  }

  private extractTaskDescription(message: string): string | null {
    const lowerMessage = message.toLowerCase();
    
    // Patterns pour extraire la description - plus flexibles
    const patterns = [
      /créé une tâche[:\s]*(.+?)(?:pour\s+[A-Za-zÀ-ÿ\s]+)?(?:\s*CONTEXT_PARTICIPANTS|$)/i,
      /créer une tâche[:\s]*(.+?)(?:pour\s+[A-Za-zÀ-ÿ\s]+)?(?:\s*CONTEXT_PARTICIPANTS|$)/i,
      /nouvelle tâche[:\s]*(.+?)(?:pour\s+[A-Za-zÀ-ÿ\s]+)?(?:\s*CONTEXT_PARTICIPANTS|$)/i,
      /crée une tâche[:\s]*(.+?)(?:pour\s+[A-Za-zÀ-ÿ\s]+)?(?:\s*CONTEXT_PARTICIPANTS|$)/i,
      /créé une action[:\s]*(.+?)(?:pour\s+[A-Za-zÀ-ÿ\s]+)?(?:\s*CONTEXT_PARTICIPANTS|$)/i,
      /créer une action[:\s]*(.+?)(?:pour\s+[A-Za-zÀ-ÿ\s]+)?(?:\s*CONTEXT_PARTICIPANTS|$)/i,
      /crée une action[:\s]*(.+?)(?:pour\s+[A-Za-zÀ-ÿ\s]+)?(?:\s*CONTEXT_PARTICIPANTS|$)/i
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1] && match[1].trim().length > 3) {
        console.log('[TASKS] 🎯 Description extraite:', match[1].trim());
        return match[1].trim();
      }
    }

    // Si pas de pattern trouvé, extraire après mots-clés
    const keywords = ['créé', 'créer', 'crée', 'faire', 'ajouter', 'nouvelle', 'action', 'tâche'];
    for (const keyword of keywords) {
      const index = lowerMessage.indexOf(keyword);
      if (index !== -1) {
        const afterKeyword = message.substring(index + keyword.length).trim();
        if (afterKeyword.length > 5) {
          const cleaned = afterKeyword.replace(/^[:\s]*/, '').split(/(?:pour\s+[A-Za-zÀ-ÿ\s]+|CONTEXT_PARTICIPANTS)/i)[0].trim();
          if (cleaned.length > 3) {
            console.log('[TASKS] 🎯 Description extraite (fallback):', cleaned);
            return cleaned;
          }
        }
      }
    }

    return null;
  }

  isTaskRelated(message: string): boolean {
    const taskKeywords = [
      'tâche', 'taches', 'task', 'todo', 'à faire', 'action',
      'créer', 'créé', 'crée', 'nouvelle', 'ajouter', 'faire', 'terminer',
      'compléter', 'finir', 'en cours', 'pending', 'confirmed', 'assigne', 'assigné'
    ];

    const lowerMessage = message.toLowerCase();
    return taskKeywords.some(keyword => lowerMessage.includes(keyword));
  }
}
