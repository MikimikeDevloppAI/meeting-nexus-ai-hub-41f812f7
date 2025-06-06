export interface QueryAnalysis {
  requiresDatabase: boolean;
  requiresEmbeddings: boolean;
  requiresInternet: boolean;
  requiresTasks: boolean;
  queryType: 'meeting' | 'document' | 'task' | 'general' | 'mixed' | 'assistance' | 'administrative';
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

    // Détection prioritaire des tâches
    const isTaskRelated = this.quickTaskDetection(message);
    
    if (isTaskRelated) {
      console.log('[COORDINATOR] 📋 Contexte TÂCHES détecté - traitement prioritaire');
      return this.analyzeTaskQuery(message, conversationHistory);
    }

    // Analyse intelligente renforcée pour cabinet médical
    const analysisPrompt = `Tu es le coordinateur expert OphtaCare pour le cabinet d'ophtalmologie du Dr Tabibian à Genève. 

CONTEXTE MÉDICAL ADMINISTRATIF :
- Cabinet spécialisé en ophtalmologie
- Gestion administrative et médicale
- Données internes : réunions, transcripts, documents, tâches
- Base vectorielle pour recherche sémantique approfondie
- Accès internet pour informations complémentaires

QUESTION UTILISATEUR: "${message}"

RÈGLES D'ANALYSE CABINET MÉDICAL :
1. **PRIORITÉ RECHERCHE SÉMANTIQUE** : TOUJOURS chercher d'abord dans les données internes
2. **DÉTECTION TEMPORELLE INTELLIGENTE** :
   - "dernière réunion" = recherche meeting le plus récent par date
   - "réunion de juin" = recherche meetings créés en juin
   - "réunion du 31 mars" = recherche par date spécifique
3. **RÉFÉRENCES CONTEXTUELLES** :
   - Transcript demandé = requiresDatabase=true + requiresEmbeddings=true
   - Questions administratives = requiresDatabase=true en priorité
4. **ENRICHISSEMENT INTERNET** : Seulement après recherche interne si nécessaire

DÉTECTION FINE TEMPORELLE :
- "dernier/dernière" → temporalReference: type="last", needs_database_lookup=true
- "juin/mars/avril" → temporalReference: type="specific_month", value="mois"
- Dates spécifiques → temporalReference: type="specific_date", value="date"

JSON OBLIGATOIRE - ANALYSE COMPLÈTE :
{
  "requiresDatabase": boolean,
  "requiresEmbeddings": boolean, 
  "requiresInternet": boolean,
  "requiresTasks": boolean,
  "queryType": "meeting|document|general|assistance|administrative",
  "priority": "database|embeddings|internet",
  "searchTerms": ["termes", "clés", "extraits"],
  "synonyms": ["variantes", "synonymes"],
  "specificEntities": ["entités", "spécifiques"],
  "timeContext": "récent|ancien|spécifique|null",
  "temporalReference": {
    "type": "recent|specific_month|last|specific_date",
    "value": "valeur si applicable",
    "needs_database_lookup": boolean
  },
  "iterativeSearch": boolean,
  "fuzzyMatching": boolean,
  "medicalContext": true,
  "administrativeContext": boolean,
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
        analysis.needsIterativeRefinement = analysis.needsIterativeRefinement || false;
        analysis.administrativeContext = analysis.administrativeContext || true;
        
        // Forcer l'accès internet si pas de données internes pertinentes attendues
        if (analysis.queryType === 'general' || analysis.queryType === 'assistance') {
          analysis.requiresInternet = true;
        }
        
        console.log('[COORDINATOR] ✅ Analyse cabinet médical complète:', {
          queryType: analysis.queryType,
          priority: analysis.priority,
          confidence: analysis.confidenceLevel,
          temporalRef: analysis.temporalReference?.type || 'none',
          adminContext: analysis.administrativeContext
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
      administrativeContext: true,
      requiresClarification: false,
      taskAction,
      confidenceLevel: 0.9,
      needsIterativeRefinement: false
    };
  }

  private getIntelligentFallbackAnalysis(message: string): QueryAnalysis {
    const lowerMessage = message.toLowerCase();
    
    // Détection intelligente pour meetings/comptes rendus avec références temporelles
    const isMeetingQuery = ['meeting', 'réunion', 'compte rendu', 'résumé', 'dernier', 'dernière', 'transcript'].some(term => lowerMessage.includes(term));
    const isInfoQuery = ['trouve', 'cherche', 'information', 'données', 'dit', 'parlé', 'patient'].some(term => lowerMessage.includes(term));
    const needsInternet = ['conseil', 'recommandation', 'aide', 'comment', 'que faire', 'traitement général', 'fournisseur'].some(term => lowerMessage.includes(term));
    
    // Détection temporelle
    let temporalReference = null;
    if (lowerMessage.includes('dernier') || lowerMessage.includes('dernière')) {
      temporalReference = { type: 'last', needs_database_lookup: true };
    } else if (lowerMessage.includes('juin')) {
      temporalReference = { type: 'specific_month', value: 'juin', needs_database_lookup: true };
    } else if (lowerMessage.includes('mars')) {
      temporalReference = { type: 'specific_month', value: 'mars', needs_database_lookup: true };
    }

    let priority: 'database' | 'embeddings' | 'internet' = 'database';
    let requiresDatabase = true;
    let requiresEmbeddings = true;
    let requiresInternet = needsInternet; // Toujours activer internet si nécessaire

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
      queryType: isMeetingQuery ? 'meeting' : isInfoQuery ? 'administrative' : 'assistance',
      specificEntities: [],
      timeContext: temporalReference ? (temporalReference.type === 'last' ? 'récent' : 'spécifique') : null,
      temporalReference,
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
      administrativeContext: true,
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
    
    // Toujours essayer internet si pas de contenu interne ET si autorisé
    const shouldTryInternet = !hasRelevantContent || analysis.requiresInternet;
    
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
      shouldTryInternet: analysis.requiresInternet, // Respecter l'analyse initiale
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
