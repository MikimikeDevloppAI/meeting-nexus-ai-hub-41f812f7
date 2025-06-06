
export interface TaskContext {
  currentTasks: any[];
  taskCreated?: any;
  hasTaskContext: boolean;
  taskAction?: 'list' | 'create' | 'update' | 'complete';
}

export class TaskAgent {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  async handleTaskRequest(message: string, analysis: any): Promise<TaskContext> {
    console.log('[TASKS] 📋 Gestion spécialisée des tâches');
    
    const context: TaskContext = {
      currentTasks: [],
      hasTaskContext: false,
      taskAction: this.detectTaskAction(message)
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

    // Si demande de création de tâche
    if (context.taskAction === 'create') {
      const taskDescription = this.extractTaskDescription(message);
      if (taskDescription) {
        console.log('[TASKS] ➕ Création d\'une nouvelle tâche:', taskDescription);
        
        // Rendre la description plus concise
        const shortDescription = this.makeDescriptionConcise(taskDescription);
        
        // Extraire l'assignation depuis le message avec CONTEXT_PARTICIPANTS
        const assignedTo = this.extractAssignedTo(message);
        
        const { data: newTask, error } = await this.supabase
          .from('todos')
          .insert([{
            description: shortDescription,
            status: 'confirmed',
            assigned_to: assignedTo,
            meeting_id: null // Tâche créée via assistant
          }])
          .select()
          .single();

        if (!error && newTask) {
          context.taskCreated = newTask;
          context.currentTasks.unshift(newTask); // Ajouter en premier
          console.log('[TASKS] ✅ Nouvelle tâche créée:', newTask.id, 'assignée à:', assignedTo);
        } else {
          console.log('[TASKS] ❌ Erreur création tâche:', error);
        }
      }
    }

    return context;
  }

  private extractAssignedTo(message: string): string | null {
    // Extraire les participants du contexte
    const participantMatch = message.match(/CONTEXT_PARTICIPANTS:\s*([^}]+)/);
    if (!participantMatch) return null;
    
    const participantsStr = participantMatch[1];
    console.log('[TASKS] 🔍 Participants context:', participantsStr);
    
    // Patterns pour détecter l'assignation
    const assignmentPatterns = [
      /pour\s+([A-Za-zÀ-ÿ\s]+?)(?:\s|,|$)/i,
      /à\s+([A-Za-zÀ-ÿ\s]+?)(?:\s|,|$)/i,
      /crée.*pour\s+([A-Za-zÀ-ÿ\s]+?)(?:\s|,|$)/i,
      /([A-Za-zÀ-ÿ\s]+?)\s+(?:doit|devrait|va)/i,
      /assigne.*à\s+([A-Za-zÀ-ÿ\s]+?)(?:\s|,|$)/i
    ];

    for (const pattern of assignmentPatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const nameToFind = match[1].trim().toLowerCase();
        console.log('[TASKS] 🎯 Nom recherché:', nameToFind);
        
        // Chercher le participant correspondant dans le contexte
        const participantIdMatch = participantsStr.match(new RegExp(`([^,()]+)\\s*\\([^,()]*ID:\\s*([^,()]+)\\)`, 'gi'));
        if (participantIdMatch) {
          for (const participant of participantIdMatch) {
            const idMatch = participant.match(/ID:\s*([^,()]+)\)/);
            const nameMatch = participant.match(/^([^(]+)/);
            
            if (idMatch && nameMatch) {
              const participantName = nameMatch[1].trim().toLowerCase();
              const participantId = idMatch[1].trim();
              
              console.log('[TASKS] 🔄 Comparaison:', participantName, 'avec', nameToFind);
              
              if (participantName.includes(nameToFind) || nameToFind.includes(participantName)) {
                console.log('[TASKS] ✅ Participant trouvé:', participantId);
                return participantId;
              }
            }
          }
        }
      }
    }
    
    return null;
  }

  private makeDescriptionConcise(description: string): string {
    // Raccourcir les descriptions trop longues et nettoyer
    let cleaned = description.replace(/CONTEXT_PARTICIPANTS:.*$/gi, '').trim();
    cleaned = cleaned.replace(/\n+/g, ' ').trim();
    
    if (cleaned.length > 150) {
      // Garder seulement la première phrase ou les 150 premiers caractères
      const firstSentence = cleaned.split('.')[0];
      if (firstSentence.length > 0 && firstSentence.length < 150) {
        return firstSentence.trim();
      }
      return cleaned.substring(0, 147).trim() + '...';
    }
    return cleaned;
  }

  private detectTaskAction(message: string): 'list' | 'create' | 'update' | 'complete' | undefined {
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
      /crée une action[:\s]*(.+?)(?:pour\s+[A-Za-zÀ-ÿ\s]+)?(?:\s*CONTEXT_PARTICIPANTS|$)/i,
      /(?:dis|dit).*?([A-Za-zÀ-ÿ\s]+)\s+(?:de|d')\s*(.+?)(?:\s*CONTEXT_PARTICIPANTS|$)/i
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        // Pour le dernier pattern, on prend le groupe 2, sinon le groupe 1
        const description = pattern.toString().includes('dis.*?') ? match[2] : match[1];
        if (description && description.trim().length > 3) {
          console.log('[TASKS] 🎯 Description extraite:', description.trim());
          return description.trim();
        }
      }
    }

    // Si pas de pattern trouvé, extraire après mots-clés
    const keywords = ['créé', 'créer', 'crée', 'faire', 'ajouter', 'nouvelle', 'action', 'tâche'];
    for (const keyword of keywords) {
      const index = lowerMessage.indexOf(keyword);
      if (index !== -1) {
        const afterKeyword = message.substring(index + keyword.length).trim();
        if (afterKeyword.length > 5) {
          // Nettoyer et extraire jusqu'à "pour" ou "CONTEXT_PARTICIPANTS"
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
