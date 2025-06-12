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
        const assignedTo = this.extractAssignedTo(message);
        
        if (taskDescription) {
          const shortDescription = this.makeDescriptionConcise(taskDescription);
          
          const { data: newTask, error } = await this.supabase
            .from('todos')
            .insert([{
              description: shortDescription,
              status: 'confirmed', // Changé de 'pending' à 'confirmed'
              assigned_to: assignedTo,
              meeting_id: null
            }])
            .select()
            .single();

          if (!error && newTask) {
            context.taskCreated = newTask;
            context.currentTasks.unshift(newTask);
            context.taskAction = 'create';
            console.log('[TASKS] ✅ Tâche créée avec assignation:', newTask.id, 'assignée à:', assignedTo);
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
        const assignedTo = this.extractAssignedTo(message);
        
        if (assignedTo) {
          // Création directe avec assignation
          const { data: newTask, error } = await this.supabase
            .from('todos')
            .insert([{
              description: shortDescription,
              status: 'confirmed', // Changé de 'pending' à 'confirmed'
              assigned_to: assignedTo,
              meeting_id: null
            }])
            .select()
            .single();

          if (!error && newTask) {
            context.taskCreated = newTask;
            context.currentTasks.unshift(newTask);
            console.log('[TASKS] ✅ Nouvelle tâche créée:', newTask.id, 'assignée à:', assignedTo);
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

  private extractAssignedTo(message: string): string | null {
    // Extraire les participants du contexte avec logique améliorée
    const participantMatch = message.match(/CONTEXT_PARTICIPANTS:\s*([^}]+)/);
    const participantsStr = participantMatch ? participantMatch[1] : '';
    
    console.log('[TASKS] 🔍 Participants context:', participantsStr);
    
    // Si c'est juste un nom simple, chercher dans les participants
    const cleanMessage = message.replace(/CONTEXT_PARTICIPANTS:.*$/gi, '').trim().toLowerCase();
    
    if (participantsStr) {
      // Patterns améliorés pour extraire ID depuis le contexte participants
      // Supporter différents formats de participants
      const participantLines = participantsStr.split('\n').filter(line => line.trim());
      
      for (const line of participantLines) {
        // Format: "Nom (Email: email@domain.com, ID: uuid)"
        const idMatch = line.match(/ID:\s*([a-f0-9\-]{36})/i);
        const nameMatch = line.match(/^([^(]+)/);
        const emailMatch = line.match(/Email:\s*([^,)]+)/i);
        
        if (idMatch && (nameMatch || emailMatch)) {
          const participantName = nameMatch ? nameMatch[1].trim().toLowerCase() : '';
          const participantEmail = emailMatch ? emailMatch[1].trim().toLowerCase() : '';
          const participantId = idMatch[1].trim();
          
          console.log('[TASKS] 🔄 Comparaison participant:', { participantName, participantEmail, cleanMessage });
          
          // Recherche par nom
          if (participantName && (
            participantName.includes(cleanMessage) || 
            cleanMessage.includes(participantName) ||
            participantName.split(' ')[0] === cleanMessage || // Premier prénom
            cleanMessage === participantName.split(' ')[0]
          )) {
            console.log('[TASKS] ✅ Participant trouvé par nom:', participantId);
            return participantId;
          }
          
          // Recherche par email
          if (participantEmail && (
            participantEmail.includes(cleanMessage) || 
            cleanMessage.includes(participantEmail)
          )) {
            console.log('[TASKS] ✅ Participant trouvé par email:', participantId);
            return participantId;
          }
        }
      }
    }
    
    console.log('[TASKS] ⚠️ Aucun participant trouvé pour:', cleanMessage);
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
