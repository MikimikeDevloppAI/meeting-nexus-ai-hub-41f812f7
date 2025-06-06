
export interface QueryAnalysis {
  requiresDatabase: boolean;
  requiresEmbeddings: boolean;
  requiresInternet: boolean;
  requiresTasks: boolean;
  queryType: 'meeting' | 'document' | 'task' | 'general' | 'mixed' | 'assistance';
  specificEntities: string[];
  timeContext?: string;
  priority: 'database' | 'embeddings' | 'internet' | 'tasks';
  searchTerms: string[];
  synonyms: string[];
  iterativeSearch: boolean;
  targetedExtraction?: {
    entity: string;
    context: string;
  };
  fuzzyMatching: boolean;
  actionDetected?: {
    type: 'create' | 'update' | 'delete' | 'help' | 'list';
    target: string;
  };
  medicalContext: boolean;
  requiresClarification: boolean;
  taskAction?: 'list' | 'create' | 'update' | 'complete';
}

export interface SearchFeedback {
  success: boolean;
  foundRelevant: boolean;
  needsExpansion: boolean;
  suggestedTerms?: string[];
  missingContext?: string;
}

export class CoordinatorAgent {
  private openaiApiKey: string;

  constructor(openaiApiKey: string) {
    this.openaiApiKey = openaiApiKey;
  }

  async analyzeQuery(message: string, conversationHistory: any[]): Promise<QueryAnalysis> {
    console.log('[COORDINATOR] ANALYSE RAPIDE:', message.substring(0, 100));

    // Détection rapide si c'est lié aux tâches (priorité absolue)
    const isTaskRelated = this.quickTaskDetection(message);
    
    if (isTaskRelated) {
      console.log('[COORDINATOR] 📋 Contexte TÂCHES détecté - traitement prioritaire');
      return this.analyzeTaskQuery(message, conversationHistory);
    }

    // Analyse rapide pour les autres types de requêtes
    const analysisPrompt = `Tu es le coordinateur intelligent OphtaCare. Analyse RAPIDEMENT cette requête.

QUESTION: "${message}"

RÈGLES RAPIDES :
1. Si TÂCHES (créer, lister, voir) → requiresTasks = true, priority = "tasks"
2. Si RECHERCHE info spécifique → requiresEmbeddings = true, priority = "embeddings"  
3. Si BESOIN internet/conseils → requiresInternet = true, priority = "internet"
4. Sinon → requiresDatabase = true, priority = "database"

FOCUS VITESSE :
- 1 agent principal par requête
- Pas de sur-analyse
- Réponse directe

JSON uniquement :
{
  "requiresDatabase": boolean,
  "requiresEmbeddings": boolean,
  "requiresInternet": boolean,
  "requiresTasks": boolean,
  "queryType": "meeting|document|task|general|assistance",
  "priority": "tasks|embeddings|internet|database",
  "searchTerms": ["terme principal"],
  "iterativeSearch": boolean,
  "medicalContext": true,
  "requiresClarification": false,
  "taskAction": null
}`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: analysisPrompt }],
          temperature: 0.1,
          max_tokens: 400,
        }),
      });

      const data = await response.json();
      const analysisText = data.choices[0]?.message?.content || '';
      
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        console.log('[COORDINATOR] ✅ Analyse rapide:', analysis);
        return analysis;
      }
      
      return this.getFastFallbackAnalysis(message);
      
    } catch (error) {
      console.error('[COORDINATOR] ❌ Analysis error:', error);
      return this.getFastFallbackAnalysis(message);
    }
  }

  private quickTaskDetection(message: string): boolean {
    const taskKeywords = [
      'tâche', 'taches', 'task', 'todo', 'à faire',
      'créer une', 'nouvelle', 'ajouter', 'faire une',
      'mes tâches', 'tâches en cours', 'que dois-je',
      'action à faire', 'terminer', 'compléter'
    ];

    const lowerMessage = message.toLowerCase();
    return taskKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  private analyzeTaskQuery(message: string, conversationHistory: any[]): QueryAnalysis {
    const lowerMessage = message.toLowerCase();
    
    let taskAction: 'list' | 'create' | 'update' | 'complete' = 'list';
    let actionType: 'create' | 'list' | 'help' = 'list';
    
    if (lowerMessage.includes('créer') || lowerMessage.includes('nouvelle') || lowerMessage.includes('ajouter')) {
      taskAction = 'create';
      actionType = 'create';
    } else if (lowerMessage.includes('terminer') || lowerMessage.includes('compléter')) {
      taskAction = 'complete';
    } else if (lowerMessage.includes('modifier') || lowerMessage.includes('changer')) {
      taskAction = 'update';
    }

    return {
      requiresDatabase: false,
      requiresEmbeddings: false,
      requiresInternet: false,
      requiresTasks: true,
      queryType: 'task',
      specificEntities: [],
      timeContext: null,
      priority: 'tasks',
      searchTerms: [message],
      synonyms: [],
      iterativeSearch: false,
      fuzzyMatching: false,
      actionDetected: {
        type: actionType,
        target: message
      },
      medicalContext: true,
      requiresClarification: false,
      taskAction
    };
  }

  private getFastFallbackAnalysis(message: string): QueryAnalysis {
    const lowerMessage = message.toLowerCase();
    
    const isInfoQuery = ['trouve', 'cherche', 'information', 'données', 'dit', 'parlé'].some(term => lowerMessage.includes(term));
    const needsInternet = ['conseil', 'recommandation', 'aide', 'comment', 'que faire'].some(term => lowerMessage.includes(term));

    return {
      requiresDatabase: !needsInternet && !isInfoQuery,
      requiresEmbeddings: isInfoQuery,
      requiresInternet: needsInternet,
      requiresTasks: false,
      queryType: isInfoQuery ? 'general' : needsInternet ? 'assistance' : 'general',
      specificEntities: [],
      timeContext: null,
      priority: needsInternet ? 'internet' : isInfoQuery ? 'embeddings' : 'database',
      searchTerms: [message],
      synonyms: [],
      iterativeSearch: false,
      fuzzyMatching: isInfoQuery,
      actionDetected: {
        type: 'help',
        target: message
      },
      medicalContext: true,
      requiresClarification: false
    };
  }

  async provideFeedback(searchResults: any, originalQuery: string): Promise<SearchFeedback> {
    const hasRelevantContent = searchResults && (
      (searchResults.meetings && searchResults.meetings.length > 0) ||
      (searchResults.chunks && searchResults.chunks.length > 0) ||
      (searchResults.todos && searchResults.todos.length > 0) ||
      (searchResults.content && searchResults.content.length > 0)
    );
    
    if (!hasRelevantContent) {
      return {
        success: false,
        foundRelevant: false,
        needsExpansion: true,
        suggestedTerms: [originalQuery],
        missingContext: 'Recherche plus approfondie nécessaire'
      };
    }
    
    return {
      success: true,
      foundRelevant: true,
      needsExpansion: false
    };
  }
}
