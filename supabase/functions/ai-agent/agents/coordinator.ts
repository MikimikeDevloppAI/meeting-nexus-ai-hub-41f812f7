export interface QueryAnalysis {
  requiresDatabase: boolean;
  requiresEmbeddings: boolean;
  requiresInternet: boolean;
  requiresTasks: boolean; // Nouveau
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
    console.log('[COORDINATOR] ANALYSE INTELLIGENTE avec détection de contexte:', message.substring(0, 100));

    // Détection rapide si c'est lié aux tâches
    const isTaskRelated = this.quickTaskDetection(message);
    
    if (isTaskRelated) {
      console.log('[COORDINATOR] 📋 Contexte TÂCHES détecté - analyse spécialisée');
      return this.analyzeTaskQuery(message, conversationHistory);
    }

    // Analyse complète pour les autres types de requêtes
    const analysisPrompt = `Tu es le coordinateur intelligent OphtaCare du Dr Tabibian à Genève.

QUESTION: "${message}"

HISTORIQUE: ${conversationHistory.slice(-3).map(h => `${h.isUser ? 'ADMIN' : 'ASSISTANT'}: ${h.content.substring(0, 150)}`).join('\n')}

RÈGLES DE PRIORISATION INTELLIGENTE :
1. SI la question concerne des TÂCHES (créer, lister, voir, gérer) → requiresTasks = true, priority = "tasks"
2. SI recherche d'informations spécifiques → requiresEmbeddings = true, priority = "embeddings"
3. SI recherche de produits/achats → requiresInternet = true pour Galaxus
4. SINON → analyse contextuelle complète

DÉTECTION CONTEXTE SPÉCIALISÉ :
- Mots-clés TÂCHES : "tâche", "task", "todo", "créer", "faire", "action", "en cours"
- Mots-clés RECHERCHE : "trouve", "cherche", "information", "données"
- Mots-clés ACHAT : "acheter", "produit", "matériel", "équipement", "liens"

FOCUS EFFICACITÉ :
- Ne pas sur-analyser les requêtes simples
- Prioriser UNE source principale par requête
- requiresEmbeddings = false pour les actions pures (création tâche)
- iterativeSearch = false pour les requêtes directes

Réponds UNIQUEMENT avec un JSON valide :
{
  "requiresDatabase": boolean,
  "requiresEmbeddings": boolean,
  "requiresInternet": boolean,
  "requiresTasks": boolean,
  "queryType": "meeting|document|task|general|mixed|assistance",
  "specificEntities": ["entité1"],
  "timeContext": "récent|null",
  "priority": "tasks|embeddings|internet|database",
  "searchTerms": ["terme1", "terme2"],
  "synonyms": ["synonyme1"],
  "iterativeSearch": boolean,
  "targetedExtraction": {"entity": "nom", "context": "contexte"},
  "fuzzyMatching": boolean,
  "actionDetected": {"type": "create|list|help", "target": "description"},
  "medicalContext": true,
  "requiresClarification": false,
  "taskAction": "list|create|update|complete"
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
      
      console.log('[COORDINATOR] Raw analysis:', analysisText);
      
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        console.log('[COORDINATOR] ✅ Analyse intelligente complète:', analysis);
        return analysis;
      }
      
      console.log('[COORDINATOR] ⚠️ Using intelligent fallback analysis');
      return this.getIntelligentFallbackAnalysis(message);
      
    } catch (error) {
      console.error('[COORDINATOR] ❌ Analysis error:', error);
      return this.getIntelligentFallbackAnalysis(message);
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
    
    // Détection action spécifique
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
      requiresDatabase: false, // L'agent tâches gère directement
      requiresEmbeddings: false, // Pas besoin pour les tâches
      requiresInternet: false,
      requiresTasks: true, // NOUVEAU : priorité tâches
      queryType: 'task',
      specificEntities: [],
      timeContext: null,
      priority: 'tasks', // NOUVEAU : priorité tâches
      searchTerms: [message],
      synonyms: [],
      iterativeSearch: false, // Action directe
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

  private getIntelligentFallbackAnalysis(message: string): QueryAnalysis {
    const lowerMessage = message.toLowerCase();
    
    // Détection intelligente du type de requête
    const isTaskQuery = this.quickTaskDetection(message);
    const isProductQuery = ['acheter', 'produit', 'matériel', 'équipement', 'liens'].some(term => lowerMessage.includes(term));
    const isInfoQuery = ['trouve', 'cherche', 'information', 'données', 'dit', 'parlé'].some(term => lowerMessage.includes(term));

    if (isTaskQuery) {
      return this.analyzeTaskQuery(message, []);
    }

    return {
      requiresDatabase: !isProductQuery, // Pas de DB pour produits
      requiresEmbeddings: isInfoQuery, // Embeddings pour info
      requiresInternet: isProductQuery, // Internet pour produits
      requiresTasks: false,
      queryType: isProductQuery ? 'general' : isInfoQuery ? 'general' : 'assistance',
      specificEntities: [],
      timeContext: null,
      priority: isProductQuery ? 'internet' : isInfoQuery ? 'embeddings' : 'database',
      searchTerms: [message],
      synonyms: [],
      iterativeSearch: isInfoQuery, // Itératif pour recherche info
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
    console.log('[COORDINATOR] Évaluation qualité résultats pour OphtaCare avec contexte enrichi');
    
    const hasRelevantContent = searchResults && (
      (searchResults.meetings && searchResults.meetings.length > 0) ||
      (searchResults.chunks && searchResults.chunks.length > 0) ||
      (searchResults.todos && searchResults.todos.length > 0) ||
      (searchResults.content && searchResults.content.length > 0)
    );
    
    if (!hasRelevantContent) {
      const expandedTerms = this.generateMaximalSynonyms([originalQuery], originalQuery);
      
      return {
        success: false,
        foundRelevant: false,
        needsExpansion: true,
        suggestedTerms: expandedTerms,
        missingContext: 'Recherche plus approfondie nécessaire dans les données OphtaCare - expansion des termes en cours'
      };
    }
    
    return {
      success: true,
      foundRelevant: true,
      needsExpansion: false
    };
  }

  private generateMaximalSynonyms(searchTerms: string[], fullMessage: string): string[] {
    const synonymMap: { [key: string]: string[] } = {
      'dupixent': ['dupilumab', 'dermatologie', 'atopique', 'dermatite', 'eczéma', 'immunosuppresseur', 'biologique', 'injection', 'traitement', 'thérapie', 'bonus', 'indemnisation', 'remboursement', 'assurance', 'critères', 'règles', 'conditions', 'protocole'],
      'fischer': ['fisher', 'monsieur fischer', 'mr fischer', 'docteur fischer', 'm. fischer', 'dr fischer'],
      'bonus': ['indemnisation', 'remboursement', 'prime', 'compensation', 'rétribution', 'règles', 'critères', 'conditions', 'assurance', 'prise en charge'],
      'règles': ['règlement', 'protocole', 'procédure', 'critères', 'conditions', 'modalités', 'directives', 'instructions', 'guide'],
      'clim': ['climatisation', 'air conditionné', 'température', 'refroidissement', 'ventilation', 'HVAC', 'chauffage', 'climate'],
      'réunion': ['meeting', 'rendez-vous', 'entretien', 'consultation', 'séance', 'assemblée'],
      'patient': ['client', 'personne', 'individu', 'consultation', 'cas'],
      'traitement': ['thérapie', 'soin', 'médication', 'intervention', 'procédure', 'prescription', 'protocol'],
      'cabinet': ['clinique', 'centre', 'ophtacare', 'bureau', 'établissement', 'practice'],
      'docteur': ['médecin', 'dr', 'praticien', 'tabibian', 'ophtalmologue', 'doctor'],
      'tâche': ['task', 'action', 'travail', 'mission', 'activité', 'todo', 'faire', 'job'],
      'équipement': ['matériel', 'appareil', 'instrument', 'machine', 'dispositif', 'outil']
    };
    
    const synonyms: string[] = [];
    searchTerms.forEach(term => {
      const lowerTerm = term.toLowerCase();
      Object.entries(synonymMap).forEach(([key, syns]) => {
        if (lowerTerm.includes(key) || key.includes(lowerTerm)) {
          synonyms.push(...syns);
        }
      });
    });
    
    // Synonymes contextuels selon le message complet
    if (fullMessage.includes('dupixent') || fullMessage.includes('bonus')) {
      synonyms.push('dermatologie', 'atopique', 'traitement', 'prescription', 'remboursement', 'assurance', 'critères', 'conditions', 'modalités', 'indemnisation', 'bonus', 'règles');
    }
    
    return [...new Set(synonyms)];
  }
}
