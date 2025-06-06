
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

  async analyzeQuery(message: string, conversationHistory: any[]): Promise<QueryAnalysis> {
    console.log('[COORDINATOR] 🧠 ANALYSE INTELLIGENTE CABINET OPHTALMOLOGIE:', message.substring(0, 100));

    // Détection prioritaire et intelligente des actions simples
    const taskDetection = this.quickTaskDetection(message);
    if (taskDetection.isTask) {
      console.log('[COORDINATOR] 📋 Contexte TÂCHES détecté - traitement prioritaire SANS autres recherches');
      return this.createTaskOnlyAnalysis(message, conversationHistory, taskDetection.action);
    }

    const transcriptDetection = this.quickTranscriptDetection(message);
    if (transcriptDetection.isTranscript) {
      console.log('[COORDINATOR] 📄 Demande TRANSCRIPT détectée - recherche database directe UNIQUEMENT');
      return this.createTranscriptOnlyAnalysis(message, transcriptDetection);
    }

    const summaryDetection = this.quickSummaryDetection(message);
    if (summaryDetection.isSummary) {
      console.log('[COORDINATOR] 📋 Demande RÉSUMÉ détectée - recherche database directe UNIQUEMENT');
      return this.createSummaryOnlyAnalysis(message, summaryDetection);
    }

    // Pour les autres demandes, analyser intelligemment
    return this.performIntelligentAnalysis(message, conversationHistory);
  }

  private quickTaskDetection(message: string): { isTask: boolean; action: 'list' | 'create' | 'update' | 'complete' } {
    const lowerMessage = message.toLowerCase();
    
    // Mots-clés de création de tâches
    const createKeywords = [
      'créer une tâche', 'nouvelle tâche', 'ajouter une tâche', 'créé une tache',
      'créer tâche', 'faire une tâche', 'tâche pour'
    ];
    
    // Mots-clés de listing de tâches
    const listKeywords = [
      'mes tâches', 'tâches en cours', 'liste des tâches', 'voir les tâches',
      'tâches actuelles', 'que dois-je faire'
    ];
    
    // Mots-clés de modification/complétion
    const updateKeywords = [
      'terminer tâche', 'compléter tâche', 'marquer terminé', 'tâche terminée',
      'modifier tâche', 'changer tâche'
    ];

    if (createKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return { isTask: true, action: 'create' };
    }
    
    if (listKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return { isTask: true, action: 'list' };
    }
    
    if (updateKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return { isTask: true, action: 'complete' };
    }

    return { isTask: false, action: 'list' };
  }

  private quickTranscriptDetection(message: string): { isTranscript: boolean; specificMeeting?: string; temporal?: string } {
    const lowerMessage = message.toLowerCase();
    
    const transcriptKeywords = [
      'transcript', 'transcription', 'transcript de', 'transcription de',
      'contenu de la réunion', 'ce qui a été dit', 'enregistrement de'
    ];
    
    const isTranscript = transcriptKeywords.some(keyword => lowerMessage.includes(keyword));
    
    if (isTranscript) {
      // Détecter des références spécifiques
      let specificMeeting = null;
      let temporal = null;
      
      if (lowerMessage.includes('dernière') || lowerMessage.includes('dernier')) {
        temporal = 'last';
      } else if (lowerMessage.includes('juin')) {
        temporal = 'juin';
      } else if (lowerMessage.includes('mars')) {
        temporal = 'mars';
      }
      
      return { isTranscript: true, specificMeeting, temporal };
    }
    
    return { isTranscript: false };
  }

  private quickSummaryDetection(message: string): { isSummary: boolean; specificMeeting?: string; temporal?: string } {
    const lowerMessage = message.toLowerCase();
    
    const summaryKeywords = [
      'résumé', 'summary', 'résumé de', 'synthèse de',
      'points clés', 'principales décisions', 'que s\'est-il passé'
    ];
    
    const isSummary = summaryKeywords.some(keyword => lowerMessage.includes(keyword));
    
    if (isSummary) {
      let temporal = null;
      
      if (lowerMessage.includes('dernière') || lowerMessage.includes('dernier')) {
        temporal = 'last';
      } else if (lowerMessage.includes('juin')) {
        temporal = 'juin';
      } else if (lowerMessage.includes('mars')) {
        temporal = 'mars';
      }
      
      return { isSummary: true, temporal };
    }
    
    return { isSummary: false };
  }

  private createTaskOnlyAnalysis(message: string, conversationHistory: any[], action: 'list' | 'create' | 'update' | 'complete'): QueryAnalysis {
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
        type: action === 'create' ? 'create' : action === 'complete' ? 'update' : 'list',
        target: message
      },
      medicalContext: true,
      administrativeContext: true,
      requiresClarification: false,
      taskAction: action,
      confidenceLevel: 0.95,
      needsIterativeRefinement: false,
      isSimpleRequest: true
    };
  }

  private createTranscriptOnlyAnalysis(message: string, detection: any): QueryAnalysis {
    const temporalReference = detection.temporal ? {
      type: detection.temporal === 'last' ? 'last' : 'specific_month',
      value: detection.temporal !== 'last' ? detection.temporal : undefined,
      needs_database_lookup: true
    } : undefined;

    return {
      requiresDatabase: true,
      requiresEmbeddings: false,
      requiresInternet: false,
      requiresTasks: false,
      queryType: 'transcript',
      specificEntities: [],
      timeContext: detection.temporal || 'récent',
      temporalReference,
      priority: 'database',
      searchTerms: [message],
      synonyms: [],
      iterativeSearch: false,
      fuzzyMatching: false,
      medicalContext: true,
      administrativeContext: true,
      requiresClarification: false,
      confidenceLevel: 0.9,
      needsIterativeRefinement: false,
      isSimpleRequest: true
    };
  }

  private createSummaryOnlyAnalysis(message: string, detection: any): QueryAnalysis {
    const temporalReference = detection.temporal ? {
      type: detection.temporal === 'last' ? 'last' : 'specific_month',
      value: detection.temporal !== 'last' ? detection.temporal : undefined,
      needs_database_lookup: true
    } : undefined;

    return {
      requiresDatabase: true,
      requiresEmbeddings: false,
      requiresInternet: false,
      requiresTasks: false,
      queryType: 'summary',
      specificEntities: [],
      timeContext: detection.temporal || 'récent',
      temporalReference,
      priority: 'database',
      searchTerms: [message],
      synonyms: [],
      iterativeSearch: false,
      fuzzyMatching: false,
      medicalContext: true,
      administrativeContext: true,
      requiresClarification: false,
      confidenceLevel: 0.9,
      needsIterativeRefinement: false,
      isSimpleRequest: true
    };
  }

  private async performIntelligentAnalysis(message: string, conversationHistory: any[]): QueryAnalysis {
    console.log('[COORDINATOR] 🔍 Analyse approfondie nécessaire - recherche complexe');

    const analysisPrompt = `Tu es le coordinateur expert OphtaCare pour le cabinet d'ophtalmologie du Dr Tabibian à Genève. 

CONTEXTE MÉDICAL ADMINISTRATIF :
- Cabinet spécialisé en ophtalmologie
- Gestion administrative et médicale
- Données internes : réunions, transcripts, documents, tâches
- Base vectorielle pour recherche sémantique approfondie
- Accès internet pour informations complémentaires

QUESTION UTILISATEUR: "${message}"

RÈGLES D'ANALYSE OPTIMISÉES :
1. **PRIORITÉ RECHERCHE VECTORIELLE** : Pour les questions complexes nécessitant recherche sémantique
2. **RECHERCHE DATABASE** : Seulement si les données structurées sont nécessaires en complément
3. **ÉVITER LES RECHERCHES INUTILES** : Si une seule source suffit, ne pas chercher ailleurs
4. **DÉTECTION TEMPORELLE INTELLIGENTE** :
   - "dernière réunion" = requiresDatabase=true avec temporalReference
   - "réunion de juin" = requiresDatabase=true + temporalReference
   - Questions générales = requiresEmbeddings=true en priorité

PRIORITÉS INTELLIGENTES :
- Questions sémantiques complexes → priority="embeddings", requiresEmbeddings=true
- Recherche de contenu spécifique → priority="embeddings", requiresEmbeddings=true  
- Données structurées récentes → priority="database", requiresDatabase=true
- Informations générales → priority="internet", requiresInternet=true

JSON OBLIGATOIRE - ANALYSE OPTIMISÉE :
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
        analysis.needsIterativeRefinement = false; // Réduire les raffinements
        analysis.administrativeContext = analysis.administrativeContext || true;
        analysis.isSimpleRequest = false;
        
        console.log('[COORDINATOR] ✅ Analyse complexe complète:', {
          queryType: analysis.queryType,
          priority: analysis.priority,
          confidence: analysis.confidenceLevel,
          temporalRef: analysis.temporalReference?.type || 'none',
          embeddings: analysis.requiresEmbeddings,
          database: analysis.requiresDatabase
        });
        
        return analysis;
      }
      
      return this.getOptimizedFallbackAnalysis(message);
      
    } catch (error) {
      console.error('[COORDINATOR] ❌ Erreur analyse:', error);
      return this.getOptimizedFallbackAnalysis(message);
    }
  }

  private getOptimizedFallbackAnalysis(message: string): QueryAnalysis {
    const lowerMessage = message.toLowerCase();
    
    // Détection intelligente priorité vectorielle
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
      // Priorité vectorielle pour recherche sémantique
      priority = 'embeddings';
      requiresEmbeddings = true;
      requiresDatabase = temporalReference ? true : false; // Database seulement si référence temporelle
    } else if (isMeetingQuery && temporalReference) {
      // Meeting avec référence temporelle = database en priorité
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
      iterativeSearch: false, // Réduire l'itératif
      fuzzyMatching: true,
      actionDetected: {
        type: 'help',
        target: message
      },
      medicalContext: true,
      administrativeContext: true,
      requiresClarification: false,
      confidenceLevel: 0.7,
      needsIterativeRefinement: false, // Pas de raffinement pour fallback
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
    if (searchResults.chunks?.length > 0) confidenceScore += 0.5; // Priorité vectorielle
    if (searchResults.meetings?.length > 0) confidenceScore += 0.3;
    if (searchResults.documents?.length > 0) confidenceScore += 0.15;
    if (searchResults.todos?.length > 0) confidenceScore += 0.05;
    
    // Logique optimisée pour éviter les recherches inutiles
    const shouldTryInternet = !hasRelevantContent && analysis.requiresInternet;
    
    if (!hasRelevantContent && !analysis.isSimpleRequest) {
      return {
        success: false,
        foundRelevant: false,
        needsExpansion: false, // Réduire l'expansion
        missingContext: 'Recherche plus ciblée nécessaire',
        shouldTryInternet,
        confidenceScore: 0.1
      };
    }
    
    return {
      success: true,
      foundRelevant: true,
      needsExpansion: false,
      shouldTryInternet: false, // Éviter internet si on a déjà du contenu
      confidenceScore
    };
  }

  async refineAnalysisWithResults(originalAnalysis: QueryAnalysis, searchResults: any, originalQuery: string): Promise<QueryAnalysis> {
    console.log('[COORDINATOR] 🔄 Affinement minimal avec résultats');
    
    // Logique de raffinement réduite pour éviter les boucles
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
}
