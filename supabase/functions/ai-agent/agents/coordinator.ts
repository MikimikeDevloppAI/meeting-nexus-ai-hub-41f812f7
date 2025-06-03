
export interface QueryAnalysis {
  requiresDatabase: boolean;
  requiresEmbeddings: boolean;
  requiresInternet: boolean;
  queryType: 'meeting' | 'document' | 'task' | 'general' | 'mixed' | 'assistance';
  specificEntities: string[];
  timeContext?: string;
  priority: 'database' | 'embeddings' | 'internet';
  searchTerms: string[];
  synonyms: string[];
  iterativeSearch: boolean;
  targetedExtraction?: {
    entity: string;
    context: string;
  };
  fuzzyMatching: boolean;
  actionDetected?: {
    type: 'create' | 'update' | 'delete' | 'help';
    target: string;
  };
  medicalContext: boolean;
  requiresClarification: boolean;
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
    console.log('[COORDINATOR] ANALYSE APPROFONDIE avec gestion fuzzy et contexte médical:', message.substring(0, 100));

    const analysisPrompt = `Tu es le coordinateur intelligent OphtaCare du Dr Tabibian à Genève - spécialiste en gestion administrative médicale.

MISSION CRITIQUE : ENRICHISSEMENT MAXIMUM DES RÉPONSES
- TOUJOURS privilégier les données internes OphtaCare (embeddings + base de données)
- requiresEmbeddings = true pour TOUTES les questions (sauf actions pures)
- priority = "embeddings" OBLIGATOIRE
- Recherche vectorielle SYSTÉMATIQUE avant tout autre type
- Expansion sémantique MAXIMALE pour capturer toute information pertinente

QUESTION ADMINISTRATIVE: "${message}"

HISTORIQUE CONVERSATION: ${conversationHistory.slice(-3).map(h => `${h.isUser ? 'ADMIN' : 'ASSISTANT'}: ${h.content.substring(0, 150)}`).join('\n')}

CONTEXTE OPHTACARE GENÈVE RENFORCÉ :
- Cabinet d'ophtalmologie dirigé par Dr Tabibian
- Utilisateur = responsable administratif du cabinet
- Données disponibles : réunions, documents, tâches, transcripts, planning, participants
- Focus sur gestion administrative et organisation du cabinet
- Base de données avec embeddings TRÈS RICHE - ne jamais sous-estimer

RÈGLES D'ANALYSE ULTRA-RENFORCÉES :
1. TOUJOURS requiresEmbeddings = true (sauf création pure de tâche)
2. TOUJOURS priority = "embeddings" - recherche vectorielle PRIORITAIRE
3. TOUJOURS iterativeSearch = true pour maximiser les résultats
4. TOUJOURS medicalContext = true (contexte cabinet médical)
5. Générer ÉNORMÉMENT de termes de recherche et synonymes
6. Gestion fuzzy matching pour noms/termes approximatifs
7. Détection PRÉCISE des actions (créer, modifier, aider, etc.)

GESTION FUZZY MATCHING INTELLIGENTE :
- "m fisher" → "mr fischer", "monsieur fischer", "fischer"
- "dupixent" → "dupilumab", "dupixent", variations orthographiques
- "clim" → "climatisation", "air conditionné", "climate"
- Variantes de noms, abréviations, fautes de frappe communes

DÉTECTION D'ACTIONS RENFORCÉE :
- Mots-clés action : "crée", "créer", "ajoute", "modifie", "aide", "explique", "montre"
- Actions sur tâches : "nouvelle tâche", "task", "todo", "faire", "action"
- Demandes d'aide : "comment", "aide-moi", "explique", "montre-moi"
- Si action détectée → actionDetected avec type et target

CONTEXTE MÉDICAL PERMANENT :
- Toujours garder le contexte cabinet ophtalmologie OphtaCare
- Terminologie médicale et administrative spécialisée
- Participants = équipe médicale et administrative
- Tâches = activités de gestion du cabinet

EXPANSION SÉMANTIQUE MAXIMALE :
Pour chaque terme, générer :
- Synonymes médicaux et administratifs
- Variantes orthographiques
- Abréviations courantes
- Termes connexes dans le domaine médical
- Contexte OphtaCare spécifique

EXEMPLES SPÉCIALISÉS OPHTACARE :
- "dupixent" → ["dupilumab", "dermatologie", "bonus", "règles", "traitement", "indemnisation", "remboursement", "assurance", "protocole", "prescription", "critères", "conditions"]
- "mr fischer" → ["fischer", "monsieur fischer", "dr fischer", "docteur fischer", "m. fischer", variations fuzzy]
- "clim" → ["climatisation", "air conditionné", "température", "refroidissement", "HVAC", "ventilation"]
- "tâche" → ["task", "action", "travail", "mission", "activité", "todo", "faire"]

VALIDATION CONTEXTUELLE :
- Si réponse incomplète → requiresClarification = true
- Toujours vérifier cohérence avec contexte médical
- Demander précisions si ambiguïté

Réponds UNIQUEMENT avec un JSON valide suivant cette structure exacte :
{
  "requiresDatabase": boolean,
  "requiresEmbeddings": boolean,
  "requiresInternet": boolean,
  "queryType": "meeting|document|task|general|mixed|assistance",
  "specificEntities": ["entité1", "entité2"],
  "timeContext": "dernière|récent|specific_date|null",
  "priority": "embeddings",
  "searchTerms": ["terme1", "terme2", "terme3"],
  "synonyms": ["synonyme1", "synonyme2", "synonyme3"],
  "iterativeSearch": true,
  "targetedExtraction": {
    "entity": "nom_personne_ou_concept",
    "context": "contexte_recherche"
  },
  "fuzzyMatching": boolean,
  "actionDetected": {
    "type": "create|update|delete|help",
    "target": "description_action"
  },
  "medicalContext": true,
  "requiresClarification": boolean
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
          max_tokens: 1200,
        }),
      });

      const data = await response.json();
      const analysisText = data.choices[0]?.message?.content || '';
      
      console.log('[COORDINATOR] Raw analysis:', analysisText);
      
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        console.log('[COORDINATOR] ✅ Analyse enrichie complète:', analysis);
        return analysis;
      }
      
      console.log('[COORDINATOR] ⚠️ Using enhanced fallback analysis');
      return this.getEnhancedFallbackAnalysis(message);
      
    } catch (error) {
      console.error('[COORDINATOR] ❌ Analysis error:', error);
      return this.getEnhancedFallbackAnalysis(message);
    }
  }

  private getEnhancedFallbackAnalysis(message: string): QueryAnalysis {
    const lowerMessage = message.toLowerCase();
    
    // Détection d'actions renforcée
    const actionPatterns = {
      create: ['crée', 'créer', 'ajoute', 'ajouter', 'nouvelle', 'nouveau', 'faire'],
      update: ['modifie', 'modifier', 'change', 'changer', 'update', 'mettre à jour'],
      delete: ['supprime', 'supprimer', 'efface', 'effacer', 'delete'],
      help: ['aide', 'explique', 'comment', 'montre', 'help', 'assistance']
    };
    
    let actionDetected = null;
    for (const [type, patterns] of Object.entries(actionPatterns)) {
      if (patterns.some(pattern => lowerMessage.includes(pattern))) {
        actionDetected = {
          type: type as 'create' | 'update' | 'delete' | 'help',
          target: message
        };
        break;
      }
    }
    
    // Extraction d'entités avec fuzzy matching
    const entities = this.extractEntitiesWithFuzzy(lowerMessage);
    const searchTerms = this.generateEnhancedSearchTerms(lowerMessage);
    const synonyms = this.generateMaximalSynonyms(searchTerms, lowerMessage);
    
    const isTaskQuery = actionDetected?.type === 'create' && 
                       ['tâche', 'task', 'todo', 'faire', 'action'].some(t => lowerMessage.includes(t));
    
    return {
      requiresDatabase: true, // Toujours pour accès aux tâches et participants
      requiresEmbeddings: !isTaskQuery, // TOUJOURS sauf création pure de tâche
      requiresInternet: false, // Prioriser interne
      queryType: isTaskQuery ? 'task' : actionDetected?.type === 'help' ? 'assistance' : 
                lowerMessage.includes('réunion') ? 'meeting' : 
                lowerMessage.includes('document') ? 'document' : 'general',
      specificEntities: entities,
      timeContext: lowerMessage.includes('dernière') || lowerMessage.includes('récent') ? 'récent' : null,
      priority: 'embeddings', // TOUJOURS embeddings d'abord
      searchTerms,
      synonyms,
      iterativeSearch: true, // TOUJOURS pour maximiser
      targetedExtraction: entities.length > 0 ? {
        entity: entities[0],
        context: lowerMessage
      } : undefined,
      fuzzyMatching: true, // TOUJOURS actif
      actionDetected,
      medicalContext: true, // TOUJOURS dans contexte médical
      requiresClarification: false
    };
  }

  private extractEntitiesWithFuzzy(message: string): string[] {
    const entities: string[] = [];
    
    // Détection noms avec fuzzy matching
    const namePatterns = [
      /(mr|mme|dr|monsieur|madame|docteur|m\.)\s*([a-záàâäéèêëíìîïóòôöúùûüç]+)/gi,
      /([a-záàâäéèêëíìîïóòôöúùûüç]{2,})\s+(fischer|fisher|tabibian|[a-záàâäéèêëíìîïóòôöúùûüç]+)/gi
    ];
    
    namePatterns.forEach(pattern => {
      const matches = message.match(pattern);
      if (matches) {
        entities.push(...matches);
      }
    });
    
    // Termes OphtaCare avec variantes
    const ophtalmoTermsWithVariants = {
      'dupixent': ['dupixent', 'dupilumab'],
      'fischer': ['fischer', 'fisher', 'mr fischer', 'monsieur fischer'],
      'clim': ['clim', 'climatisation', 'air conditionné'],
      'bonus': ['bonus', 'indemnisation', 'remboursement'],
      'règles': ['règles', 'règlement', 'protocole', 'procédure']
    };
    
    Object.entries(ophtalmoTermsWithVariants).forEach(([key, variants]) => {
      if (variants.some(variant => message.includes(variant))) {
        entities.push(key, ...variants);
      }
    });
    
    return [...new Set(entities)];
  }

  private generateEnhancedSearchTerms(message: string): string[] {
    const words = message.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const expandedTerms = [...words];
    
    // Ajout contexte spécialisé selon contenu
    if (message.includes('dupixent') || message.includes('bonus')) {
      expandedTerms.push('dupilumab', 'dermatologie', 'traitement', 'indemnisation', 'remboursement', 'assurance', 'protocole', 'prescription', 'critères', 'règles', 'conditions');
    }
    
    if (message.includes('fischer') || message.includes('fisher')) {
      expandedTerms.push('fischer', 'fisher', 'monsieur fischer', 'mr fischer', 'docteur fischer');
    }
    
    if (message.includes('clim')) {
      expandedTerms.push('climatisation', 'air conditionné', 'température', 'refroidissement', 'HVAC', 'ventilation');
    }
    
    return [...new Set(expandedTerms)];
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
}
