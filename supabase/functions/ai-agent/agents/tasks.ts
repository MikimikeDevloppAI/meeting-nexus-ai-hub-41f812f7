
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

    // Récupérer toutes les tâches en cours avec descriptions courtes
    console.log('[TASKS] 📋 Récupération de toutes les tâches en cours');
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
              status: 'confirmed',
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
              status: 'confirmed',
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
    // Extraire les participants du contexte
    const participantMatch = message.match(/CONTEXT_PARTICIPANTS:\s*([^}]+)/);
    const participantsStr = participantMatch ? participantMatch[1] : '';
    
    console.log('[TASKS] 🔍 Participants context:', participantsStr);
    
    // Si c'est juste un nom simple, chercher dans les participants
    const cleanMessage = message.replace(/CONTEXT_PARTICIPANTS:.*$/gi, '').trim().toLowerCase();
    
    if (participantsStr) {
      // Patterns pour extraire ID depuis le contexte participants
      const participantIdMatch = participantsStr.match(new RegExp(`([^,()]+)\\s*\\([^,()]*ID:\\s*([^,()]+)\\)`, 'gi'));
      if (participantIdMatch) {
        for (const participant of participantIdMatch) {
          const idMatch = participant.match(/ID:\s*([^,()]+)\)/);
          const nameMatch = participant.match(/^([^(]+)/);
          
          if (idMatch && nameMatch) {
            const participantName = nameMatch[1].trim().toLowerCase();
            const participantId = idMatch[1].trim();
            
            console.log('[TASKS] 🔄 Comparaison:', participantName, 'avec', cleanMessage);
            
            if (participantName.includes(cleanMessage) || cleanMessage.includes(participantName)) {
              console.log('[TASKS] ✅ Participant trouvé:', participantId);
              return participantId;
            }
          }
        }
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
