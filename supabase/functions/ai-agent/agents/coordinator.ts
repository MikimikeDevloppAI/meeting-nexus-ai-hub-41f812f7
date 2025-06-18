export interface QueryAnalysis {
  requiresDatabase: boolean;
  requiresEmbeddings: boolean;
  requiresInternet: boolean;
  requiresTasks: boolean;
  queryType: 'meeting' | 'document' | 'task' | 'general' | 'mixed' | 'assistance' | 'administrative' | 'transcript' | 'summary';
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
  temporalReference?: {
    type: 'recent' | 'specific_month' | 'last' | 'specific_date';
    value?: string;
    needs_database_lookup: boolean;
  };
  administrativeContext: boolean;
  isSimpleRequest: boolean;
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

  async analyzeQuery(message: string, conversationHistory: any[] = []): Promise<any> {
    console.log('[COORDINATOR] 🧠 ANALYSE CONSERVATIVE CABINET OPHTALMOLOGIE:', message);
    
    const lowerMessage = message.toLowerCase();
    
    // 🎯 DÉTECTION CONSERVATIVE: Ne plus forcer les actions automatiques
    const isRecurringTaskQuery = this.isRecurringPersonTaskQuery(message);
    if (isRecurringTaskQuery) {
      console.log('[COORDINATOR] 🔍 Analyse requête récurrente:', { hasRecurring: true, hasPerson: true, hasTask: true });
      return {
        queryType: 'recurring_tasks',
        priority: 'embeddings_and_tasks',
        confidence: 0.9,
        temporalRef: this.extractTemporalReference(message),
        embeddings: true,
        database: true,
        tasks: true,
        internet: false,
        person: this.extractPersonFromQuery(message),
        timeframe: this.extractTimeframe(message)
      };
    }

    // Analyse existante pour les autres types de requêtes - SANS FORCER LES ACTIONS
    if (this.isSimpleQuery(message)) {
      return {
        queryType: 'simple',
        priority: 'direct',
        confidence: 0.9,
        embeddings: false,
        database: false,
        tasks: false,
        internet: false
      };
    }

    // Pour les autres demandes, analyser intelligemment SANS ACTION AUTOMATIQUE
    return this.performConservativeAnalysis(message, conversationHistory);
  }

  private isRecurringPersonTaskQuery(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    
    // Patterns spécifiques pour tâches récurrentes avec personne - PLUS STRICTS
    const recurringPatterns = [
      'tous les', 'chaque', 'toutes les', 'régulièrement',
      'hebdomadaire', 'quotidien', 'mensuel', 'habituellement'
    ];
    
    const personPatterns = [
      'emilie', 'émilie', 'david', 'leila', 'parmice', 'sybil', 'tabibian'
    ];
    
    const taskPatterns = [
      'doit faire', 'fait', 'tâches', 'responsabilités', 'travail',
      'planning', 'programme', 'activités', 'mission'
    ];
    
    const hasRecurring = recurringPatterns.some(pattern => lowerMessage.includes(pattern));
    const hasPerson = personPatterns.some(pattern => lowerMessage.includes(pattern));
    const hasTask = taskPatterns.some(pattern => lowerMessage.includes(pattern));
    
    console.log('[COORDINATOR] 🔍 Analyse requête récurrente:', { hasRecurring, hasPerson, hasTask });
    
    return hasRecurring && hasPerson && hasTask;
  }

  private extractPersonFromQuery(message: string): string | null {
    const lowerMessage = message.toLowerCase();
    const persons = ['emilie', 'émilie', 'david', 'leila', 'parmice', 'sybil', 'tabibian'];
    
    for (const person of persons) {
      if (lowerMessage.includes(person)) {
        return person;
      }
    }
    return null;
  }

  private extractTimeframe(message: string): string | null {
    const lowerMessage = message.toLowerCase();
    const timeframes = {
      'lundi': 'monday',
      'mardi': 'tuesday',
      'mercredi': 'wednesday',
      'jeudi': 'thursday',
      'vendredi': 'friday',
      'samedi': 'saturday',
      'dimanche': 'sunday'
    };
    
    for (const [french, english] of Object.entries(timeframes)) {
      if (lowerMessage.includes(french)) {
        return english;
      }
    }
    return null;
  }

  // NOUVELLE FONCTION CONSERVATIVE - Ne force plus les actions
  private async performConservativeAnalysis(message: string, conversationHistory: any[]): QueryAnalysis {
    console.log('[COORDINATOR] 🔍 Analyse CONSERVATIVE - pas de création d\'action automatique');

    const analysisPrompt = `Tu es le coordinateur expert OphtaCare pour le cabinet d'ophtalmologie du Dr Tabibian à Genève. 

CONTEXTE MÉDICAL ADMINISTRATIF :
- Cabinet spécialisé en ophtalmologie
- Gestion administrative et médicale
- Données internes : réunions, transcripts, documents, tâches
- Base vectorielle pour recherche sémantique approfondie
- Accès internet pour informations complémentaires

QUESTION UTILISATEUR: "${message}"

RÈGLES D'ANALYSE CONSERVATIVE :
1. **NE PAS FORCER LES ACTIONS** : Ne pas détecter d'actions automatiques sauf demande TRÈS explicite
2. **PRIORITÉ RECHERCHE VECTORIELLE** : Pour les questions complexes nécessitant recherche sémantique
3. **RECHERCHE DATABASE** : Seulement si les données structurées sont nécessaires en complément
4. **ÉVITER LES RECHERCHES INUTILES** : Si une seule source suffit, ne pas chercher ailleurs
5. **DÉTECTION TEMPORELLE INTELLIGENTE** :
   - "dernière réunion" = requiresDatabase=true avec temporalReference
   - "réunion de juin" = requiresDatabase=true + temporalReference
   - Questions générales = requiresEmbeddings=true en priorité

PRIORITÉS INTELLIGENTES :
- Questions sémantiques complexes → priority="embeddings", requiresEmbeddings=true
- Recherche de contenu spécifique → priority="embeddings", requiresEmbeddings=true  
- Données structurées récentes → priority="database", requiresDatabase=true
- Informations générales → priority="internet", requiresInternet=true

JSON OBLIGATOIRE - ANALYSE CONSERVATIVE :
{
  "requiresDatabase": boolean,
  "requiresEmbeddings": boolean, 
  "requiresInternet": boolean,
  "requiresTasks": false,
  "queryType": "meeting|document|general|assistance|administrative",
  "priority": "embeddings|database|internet",
  "searchTerms": ["termes", "clés", "extraits"],
  "synonyms": ["variantes", "synonymes"],
  "specificEntities": ["entités", "spécifiques"],
  "timeContext": "récent|ancien|spécifique|null",
  "temporalReference": {
    "type": "recent|specific_month|last|specific_date",
    "value": "valeur si applicable",
    "needs_database_lookup": boolean
  },
  "iterativeSearch": false,
  "fuzzyMatching": boolean,
  "medicalContext": true,
  "administrativeContext": boolean,
  "requiresClarification": false,
  "confidenceLevel": 0.0-1.0,
  "needsIterativeRefinement": false,
  "isSimpleRequest": false
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
          max_tokens: 800,
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
        analysis.needsIterativeRefinement = false;
        analysis.administrativeContext = analysis.administrativeContext || true;
        analysis.isSimpleRequest = false;
        
        console.log('[COORDINATOR] ✅ Analyse conservative complète:', {
          queryType: analysis.queryType,
          priority: analysis.priority,
          confidence: analysis.confidenceLevel,
          temporalRef: analysis.temporalReference?.type || 'none',
          embeddings: analysis.requiresEmbeddings,
          database: analysis.requiresDatabase
        });
        
        return analysis;
      }
      
      return this.getConservativeFallbackAnalysis(message);
      
    } catch (error) {
      console.error('[COORDINATOR] ❌ Erreur analyse:', error);
      return this.getConservativeFallbackAnalysis(message);
    }
  }

  private getConservativeFallbackAnalysis(message: string): QueryAnalysis {
    const lowerMessage = message.toLowerCase();
    
    // Détection intelligente prioritaire vectorielle SANS ACTIONS AUTOMATIQUES
    const isSemanticQuery = ['trouve', 'cherche', 'information', 'dit', 'parlé', 'contenu', 'sujet'].some(term => lowerMessage.includes(term));
    const isMeetingQuery = ['meeting', 'réunion', 'compte rendu', 'résumé'].some(term => lowerMessage.includes(term));
    const needsInternet = ['conseil', 'recommandation', 'aide', 'comment', 'que faire', 'traitement général'].some(term => lowerMessage.includes(term));
    
    // Détection temporelle
    let temporalReference = null;
    if (lowerMessage.includes('dernier') || lowerMessage.includes('dernière')) {
      temporalReference = { type: 'last', needs_database_lookup: true };
    } else if (lowerMessage.includes('juin')) {
      temporalReference = { type: 'specific_month', value: 'juin', needs_database_lookup: true };
    } else if (lowerMessage.includes('mars')) {
      temporalReference = { type: 'specific_month', value: 'mars', needs_database_lookup: true };
    }

    let priority: 'database' | 'embeddings' | 'internet' = 'embeddings';
    let requiresDatabase = false;
    let requiresEmbeddings = true;
    let requiresInternet = false;

    if (isSemanticQuery) {
      priority = 'embeddings';
      requiresEmbeddings = true;
      requiresDatabase = temporalReference ? true : false;
    } else if (isMeetingQuery && temporalReference) {
      priority = 'database';
      requiresDatabase = true;
      requiresEmbeddings = false;
    } else if (needsInternet) {
      priority = 'internet';
      requiresInternet = true;
      requiresEmbeddings = false;
      requiresDatabase = false;
    }

    return {
      requiresDatabase,
      requiresEmbeddings,
      requiresInternet,
      requiresTasks: false,
      queryType: isMeetingQuery ? 'meeting' : isSemanticQuery ? 'administrative' : 'assistance',
      specificEntities: [],
      timeContext: temporalReference ? (temporalReference.type === 'last' ? 'récent' : 'spécifique') : null,
      temporalReference,
      priority,
      searchTerms: [message],
      synonyms: [],
      iterativeSearch: false,
      fuzzyMatching: true,
      actionDetected: {
        type: 'help',
        target: message
      },
      medicalContext: true,
      administrativeContext: true,
      requiresClarification: false,
      confidenceLevel: 0.7,
      needsIterativeRefinement: false,
      isSimpleRequest: false
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
    if (searchResults.chunks?.length > 0) confidenceScore += 0.5;
    if (searchResults.meetings?.length > 0) confidenceScore += 0.3;
    if (searchResults.documents?.length > 0) confidenceScore += 0.15;
    if (searchResults.todos?.length > 0) confidenceScore += 0.05;
    
    const shouldTryInternet = !hasRelevantContent && analysis.requiresInternet;
    
    if (!hasRelevantContent && !analysis.isSimpleRequest) {
      return {
        success: false,
        foundRelevant: false,
        needsExpansion: false,
        missingContext: 'Recherche plus ciblée nécessaire',
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

  async refineAnalysisWithResults(originalAnalysis: QueryAnalysis, searchResults: any, originalQuery: string): Promise<QueryAnalysis> {
    console.log('[COORDINATOR] 🔄 Affinement minimal avec résultats');
    
    if (!searchResults || (!searchResults.meetings?.length && !searchResults.chunks?.length)) {
      if (!originalAnalysis.requiresInternet) {
        const refinedAnalysis = { ...originalAnalysis };
        refinedAnalysis.requiresInternet = true;
        refinedAnalysis.priority = 'internet';
        
        console.log('[COORDINATOR] 🌐 Basculement minimal vers internet');
        return refinedAnalysis;
      }
    }
    
    return originalAnalysis;
  }

  private isSimpleQuery(message: string): boolean {
    const simplePatterns = [
      /^(bonjour|salut|hello|hi)$/i,
      /^(merci|thanks)$/i,
      /^(au revoir|bye)$/i
    ];
    
    return simplePatterns.some(pattern => pattern.test(message.trim()));
  }

  private detectQueryType(message: string): string {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('tâche') || lowerMessage.includes('todo')) {
      return 'task';
    }
    if (lowerMessage.includes('réunion') || lowerMessage.includes('meeting')) {
      return 'meeting';
    }
    if (lowerMessage.includes('document') || lowerMessage.includes('fichier')) {
      return 'document';
    }
    
    return 'administrative';
  }

  private determinePriority(message: string, queryType: string): string {
    if (queryType === 'task') return 'tasks';
    if (queryType === 'document') return 'embeddings';
    return 'database';
  }

  private calculateConfidence(message: string, queryType: string): number {
    return 0.8;
  }

  private extractTemporalReference(message: string): string | null {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('dernier') || lowerMessage.includes('dernière')) {
      return 'last';
    }
    if (lowerMessage.includes('prochain') || lowerMessage.includes('prochaine')) {
      return 'next';
    }
    if (lowerMessage.includes('aujourd\'hui')) {
      return 'today';
    }
    
    return null;
  }

  private shouldUseEmbeddings(message: string, queryType: string): boolean {
    return queryType === 'document' || 
           message.toLowerCase().includes('document') ||
           message.toLowerCase().includes('recherche');
  }

  private shouldUseDatabase(message: string, queryType: string): boolean {
    return queryType !== 'simple';
  }

  private shouldUseTasks(message: string, queryType: string): boolean {
    return queryType === 'task' || 
           message.toLowerCase().includes('tâche') ||
           message.toLowerCase().includes('todo');
  }

  private shouldUseInternet(message: string, queryType: string): boolean {
    return message.toLowerCase().includes('actualité') ||
           message.toLowerCase().includes('news') ||
           message.toLowerCase().includes('internet');
  }
}
