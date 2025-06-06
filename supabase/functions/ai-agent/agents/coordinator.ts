
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
  confidenceLevel: number;
  needsIterativeRefinement: boolean;
}

export interface SearchFeedback {
  success: boolean;
  foundRelevant: boolean;
  needsExpansion: boolean;
  suggestedTerms?: string[];
  missingContext?: string;
  shouldTryInternet: boolean;
  confidenceScore: number;
}

export class CoordinatorAgent {
  private openaiApiKey: string;

  constructor(openaiApiKey: string) {
    this.openaiApiKey = openaiApiKey;
  }

  async analyzeQuery(message: string, conversationHistory: any[]): Promise<QueryAnalysis> {
    console.log('[COORDINATOR] 🧠 ANALYSE INTELLIGENTE APPROFONDIE:', message.substring(0, 100));

    // Détection prioritaire des tâches
    const isTaskRelated = this.quickTaskDetection(message);
    
    if (isTaskRelated) {
      console.log('[COORDINATOR] 📋 Contexte TÂCHES détecté - traitement prioritaire');
      return this.analyzeTaskQuery(message, conversationHistory);
    }

    // Analyse intelligente renforcée pour tous les autres types
    const analysisPrompt = `Tu es le coordinateur expert OphtaCare pour un cabinet d'ophtalmologie à Genève. Analyse INTELLIGEMMENT cette requête.

QUESTION: "${message}"

CONTEXTE MÉDICAL SPÉCIALISÉ :
- Cabinet Dr Tabibian, ophtalmologie Genève
- Données: réunions, transcripts, documents, tâches
- Base vectorielle disponible pour recherche approfondie
- Internet pour conseils généraux

RÈGLES D'ANALYSE INTELLIGENTE :
1. PRIORITÉ AUX DONNÉES INTERNES : Toujours chercher d'abord dans les meetings/transcripts
2. Si demande "dernier meeting", "compte rendu", "résumé" → database + embeddings OBLIGATOIRE
3. Si question spécifique patient/procédure → embeddings + database
4. Si conseil général médical → internet après recherche interne
5. Détection entités: noms patients, traitements, dates

DÉTECTION FINE :
- "dernier meeting" = requiresDatabase=true, requiresEmbeddings=true, priority="database"
- "compte rendu" = requiresDatabase=true, requiresEmbeddings=true, priority="database"  
- Questions patients = requiresDatabase=true, requiresEmbeddings=true, priority="embeddings"
- Conseils généraux = recherche interne PUIS internet si nécessaire

JSON OBLIGATOIRE - RÉPONSE COMPLÈTE :
{
  "requiresDatabase": boolean,
  "requiresEmbeddings": boolean, 
  "requiresInternet": boolean,
  "requiresTasks": boolean,
  "queryType": "meeting|document|general|assistance",
  "priority": "database|embeddings|internet",
  "searchTerms": ["termes", "clés", "extraits"],
  "synonyms": ["variantes", "synonymes"],
  "specificEntities": ["entités", "spécifiques"],
  "timeContext": "récent|ancien|null",
  "iterativeSearch": boolean,
  "fuzzyMatching": boolean,
  "medicalContext": true,
  "requiresClarification": false,
  "confidenceLevel": 0.0-1.0,
  "needsIterativeRefinement": boolean,
  "targetedExtraction": {
    "entity": "entité recherchée",
    "context": "contexte extraction"
  }
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
          max_tokens: 600,
        }),
      });

      const data = await response.json();
      const analysisText = data.choices[0]?.message?.content || '';
      
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        
        // Validation et enrichissement automatique
        analysis.searchTerms = analysis.searchTerms || [message];
        analysis.synonyms = analysis.synonyms || [];
        analysis.specificEntities = analysis.specificEntities || [];
        analysis.confidenceLevel = analysis.confidenceLevel || 0.8;
        analysis.needsIterativeRefinement = analysis.needsIterativeRefinement || false;
        
        console.log('[COORDINATOR] ✅ Analyse intelligente complète:', {
          queryType: analysis.queryType,
          priority: analysis.priority,
          confidence: analysis.confidenceLevel,
          searchTerms: analysis.searchTerms?.length || 0
        });
        
        return analysis;
      }
      
      return this.getIntelligentFallbackAnalysis(message);
      
    } catch (error) {
      console.error('[COORDINATOR] ❌ Erreur analyse:', error);
      return this.getIntelligentFallbackAnalysis(message);
    }
  }

  private quickTaskDetection(message: string): boolean {
    const taskKeywords = [
      'tâche', 'taches', 'task', 'todo', 'à faire',
      'créer une', 'nouvelle tâche', 'ajouter une tâche',
      'mes tâches', 'tâches en cours', 'que dois-je faire',
      'action à faire', 'terminer tâche', 'compléter tâche'
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
      taskAction,
      confidenceLevel: 0.9,
      needsIterativeRefinement: false
    };
  }

  private getIntelligentFallbackAnalysis(message: string): QueryAnalysis {
    const lowerMessage = message.toLowerCase();
    
    // Détection intelligente pour meetings/comptes rendus
    const isMeetingQuery = ['meeting', 'réunion', 'compte rendu', 'résumé', 'dernier', 'dernière'].some(term => lowerMessage.includes(term));
    const isInfoQuery = ['trouve', 'cherche', 'information', 'données', 'dit', 'parlé', 'patient'].some(term => lowerMessage.includes(term));
    const needsInternet = ['conseil', 'recommandation', 'aide', 'comment', 'que faire', 'traitement général'].some(term => lowerMessage.includes(term));

    let priority: 'database' | 'embeddings' | 'internet' = 'database';
    let requiresDatabase = true;
    let requiresEmbeddings = true;
    let requiresInternet = false;

    if (isMeetingQuery) {
      priority = 'database';
      requiresDatabase = true;
      requiresEmbeddings = true;
    } else if (isInfoQuery) {
      priority = 'embeddings';
      requiresDatabase = true;
      requiresEmbeddings = true;
    } else if (needsInternet) {
      priority = 'internet';
      requiresInternet = true;
    }

    return {
      requiresDatabase,
      requiresEmbeddings,
      requiresInternet,
      requiresTasks: false,
      queryType: isMeetingQuery ? 'meeting' : isInfoQuery ? 'general' : 'assistance',
      specificEntities: [],
      timeContext: isMeetingQuery ? 'récent' : null,
      priority,
      searchTerms: [message],
      synonyms: [],
      iterativeSearch: true,
      fuzzyMatching: true,
      actionDetected: {
        type: 'help',
        target: message
      },
      medicalContext: true,
      requiresClarification: false,
      confidenceLevel: 0.7,
      needsIterativeRefinement: true
    };
  }

  async provideFeedback(searchResults: any, originalQuery: string, analysis: QueryAnalysis): Promise<SearchFeedback> {
    const hasRelevantContent = searchResults && (
      (searchResults.meetings && searchResults.meetings.length > 0) ||
      (searchResults.chunks && searchResults.chunks.length > 0) ||
      (searchResults.todos && searchResults.todos.length > 0) ||
      (searchResults.documents && searchResults.documents.length > 0) ||
      (searchResults.content && searchResults.content.length > 0)
    );
    
    let confidenceScore = 0;
    if (searchResults.meetings?.length > 0) confidenceScore += 0.4;
    if (searchResults.chunks?.length > 0) confidenceScore += 0.3;
    if (searchResults.documents?.length > 0) confidenceScore += 0.2;
    if (searchResults.todos?.length > 0) confidenceScore += 0.1;
    
    const shouldTryInternet = !hasRelevantContent && analysis.queryType === 'assistance';
    
    if (!hasRelevantContent) {
      return {
        success: false,
        foundRelevant: false,
        needsExpansion: true,
        suggestedTerms: this.generateExpansionTerms(originalQuery),
        missingContext: 'Recherche plus approfondie nécessaire',
        shouldTryInternet,
        confidenceScore: 0.1
      };
    }
    
    return {
      success: true,
      foundRelevant: true,
      needsExpansion: false,
      shouldTryInternet: false,
      confidenceScore
    };
  }

  private generateExpansionTerms(query: string): string[] {
    const expansionTerms = [];
    const words = query.toLowerCase().split(/\s+/);
    
    // Ajout de variantes médicales
    words.forEach(word => {
      if (word.includes('meet')) expansionTerms.push('réunion', 'rendez-vous');
      if (word.includes('patient')) expansionTerms.push('consultation', 'dossier');
      if (word.includes('traitement')) expansionTerms.push('thérapie', 'soin');
    });
    
    return expansionTerms;
  }

  async refineAnalysisWithResults(originalAnalysis: QueryAnalysis, searchResults: any, originalQuery: string): Promise<QueryAnalysis> {
    console.log('[COORDINATOR] 🔄 Affinement de l\'analyse avec résultats');
    
    if (!searchResults || (!searchResults.meetings?.length && !searchResults.chunks?.length)) {
      // Pas de résultats, essayer recherche internet
      const refinedAnalysis = { ...originalAnalysis };
      refinedAnalysis.requiresInternet = true;
      refinedAnalysis.priority = 'internet';
      refinedAnalysis.needsIterativeRefinement = false;
      
      console.log('[COORDINATOR] 🌐 Basculement vers recherche internet');
      return refinedAnalysis;
    }
    
    return originalAnalysis;
  }
}
