
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

    // Récupérer toutes les tâches en cours
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
        
        const { data: newTask, error } = await this.supabase
          .from('todos')
          .insert([{
            description: taskDescription,
            status: 'confirmed',
            meeting_id: null // Tâche créée via assistant
          }])
          .select()
          .single();

        if (!error && newTask) {
          context.taskCreated = newTask;
          context.currentTasks.unshift(newTask); // Ajouter en premier
          console.log('[TASKS] ✅ Nouvelle tâche créée:', newTask.id);
        } else {
          console.log('[TASKS] ❌ Erreur création tâche:', error);
        }
      }
    }

    return context;
  }

  private detectTaskAction(message: string): 'list' | 'create' | 'update' | 'complete' | undefined {
    const lowerMessage = message.toLowerCase();
    
    // Détection création
    const createPatterns = [
      'créer une tâche', 'nouvelle tâche', 'ajouter une tâche', 'crée une tâche',
      'faire une tâche', 'task', 'todo', 'à faire', 'action à faire'
    ];
    
    if (createPatterns.some(pattern => lowerMessage.includes(pattern))) {
      return 'create';
    }

    // Détection listing/consultation
    const listPatterns = [
      'tâches en cours', 'mes tâches', 'voir les tâches', 'liste des tâches',
      'tâches à faire', 'que dois-je faire', 'quelles sont les tâches'
    ];
    
    if (listPatterns.some(pattern => lowerMessage.includes(pattern))) {
      return 'list';
    }

    return undefined;
  }

  private extractTaskDescription(message: string): string | null {
    const lowerMessage = message.toLowerCase();
    
    // Patterns pour extraire la description
    const patterns = [
      /créer une tâche[:\s]+(.+)/i,
      /nouvelle tâche[:\s]+(.+)/i,
      /ajouter une tâche[:\s]+(.+)/i,
      /crée une tâche[:\s]+(.+)/i,
      /faire une tâche[:\s]+(.+)/i,
      /task[:\s]+(.+)/i,
      /todo[:\s]+(.+)/i
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Si pas de pattern trouvé, chercher après mots-clés
    const keywords = ['créer', 'faire', 'ajouter', 'nouvelle', 'task', 'todo'];
    for (const keyword of keywords) {
      const index = lowerMessage.indexOf(keyword);
      if (index !== -1) {
        const afterKeyword = message.substring(index + keyword.length).trim();
        if (afterKeyword.length > 5) {
          return afterKeyword;
        }
      }
    }

    return null;
  }

  isTaskRelated(message: string): boolean {
    const taskKeywords = [
      'tâche', 'taches', 'task', 'todo', 'à faire', 'action',
      'créer', 'nouvelle', 'ajouter', 'faire', 'terminer',
      'compléter', 'finir', 'en cours', 'pending', 'confirmed'
    ];

    const lowerMessage = message.toLowerCase();
    return taskKeywords.some(keyword => lowerMessage.includes(keyword));
  }
}
