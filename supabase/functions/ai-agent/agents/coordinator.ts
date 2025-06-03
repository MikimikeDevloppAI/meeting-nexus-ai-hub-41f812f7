export interface QueryAnalysis {
  requiresDatabase: boolean;
  requiresEmbeddings: boolean;
  requiresInternet: boolean;
  queryType: 'meeting' | 'document' | 'task' | 'general' | 'mixed';
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
    console.log('[COORDINATOR] Analyzing query with semantic expansion:', message.substring(0, 100));

    const analysisPrompt = `Tu es un coordinateur intelligent pour OphtaCare, le cabinet d'ophtalmologie du Dr Tabibian à Genève.
L'utilisateur qui te parle s'occupe de la partie ADMINISTRATIVE du cabinet.

Analyse cette question administrative et détermine la stratégie optimale de recherche avec expansion sémantique :

QUESTION: "${message}"

HISTORIQUE RÉCENT: ${conversationHistory.slice(-3).map(h => `${h.isUser ? 'ADMIN' : 'ASSISTANT'}: ${h.content.substring(0, 200)}`).join('\n')}

CONTEXTE OPHTACARE GENÈVE :
- Cabinet d'ophtalmologie dirigé par Dr Tabibian
- Utilisateur = responsable administratif du cabinet
- Données disponibles : réunions, documents, tâches, transcripts, planning
- Focus sur gestion administrative et organisation du cabinet

DÉTECTION SPÉCIALE TÂCHES :
Si la question contient des mots comme "crée", "créer", "ajoute", "tâche", "task" → queryType = "task"
Si détection de tâche → requiresDatabase = true (pour accéder aux tâches existantes)
Si création de tâche → requiresEmbeddings = false (pas besoin de recherche sémantique)

Tu dois analyser finement la requête pour :
1. Identifier les entités précises (noms, concepts, équipements)
2. Générer des synonymes et termes apparentés pour l'ophtalmologie
3. Déterminer si une extraction ciblée est nécessaire
4. Planifier une recherche multi-étapes si besoin
5. Rester dans le contexte administratif d'OphtaCare
6. DÉTECTER les demandes d'actions sur les tâches

Réponds UNIQUEMENT avec un JSON valide suivant cette structure exacte :
{
  "requiresDatabase": boolean,
  "requiresEmbeddings": boolean, 
  "requiresInternet": boolean,
  "queryType": "meeting|document|task|general|mixed",
  "specificEntities": ["entité1", "entité2"],
  "timeContext": "dernière|récent|specific_date|null",
  "priority": "database|embeddings|internet",
  "searchTerms": ["terme1", "terme2"],
  "synonyms": ["synonyme1", "synonyme2"],
  "iterativeSearch": boolean,
  "targetedExtraction": {
    "entity": "nom_personne_ou_concept",
    "context": "contexte_recherche"
  }
}

RÈGLES D'ANALYSE SPÉCIALISÉES OPHTACARE :
- Pour "clim" → ajouter ["climatisation", "air conditionné", "température", "refroidissement", "HVAC"]
- Pour "Mr Fischer" → recherche ciblée avec extraction de sections spécifiques
- Pour "dernière réunion" → database d'abord avec ID spécifique, puis embeddings ciblés
- Pour équipements médicaux → synonymes techniques ophtalmologiques
- Pour patients → recherche administrative (pas médicale)
- Pour TÂCHES → queryType="task", requiresDatabase=true, requiresEmbeddings=false
- Toujours générer des synonymes pertinents pour l'ophtalmologie
- Activer iterativeSearch si la requête est complexe ou spécifique
- Utiliser targetedExtraction pour les entités nommées
- Prioriser les données internes OphtaCare avant internet`;

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
      
      // Extract JSON from response
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        console.log('[COORDINATOR] ✅ Enhanced analysis result:', analysis);
        return analysis;
      }
      
      // Fallback analysis with enhanced logic including task detection
      console.log('[COORDINATOR] ⚠️ Using enhanced fallback analysis');
      return this.getEnhancedFallbackAnalysis(message);
      
    } catch (error) {
      console.error('[COORDINATOR] ❌ Analysis error:', error);
      return this.getEnhancedFallbackAnalysis(message);
    }
  }

  private getEnhancedFallbackAnalysis(message: string): QueryAnalysis {
    const lowerMessage = message.toLowerCase();
    
    // Detect task-related queries
    const isTaskQuery = lowerMessage.includes('tâche') || lowerMessage.includes('task') ||
                       lowerMessage.includes('crée') || lowerMessage.includes('créer') ||
                       lowerMessage.includes('ajoute') || lowerMessage.includes('ajouter');
    
    // Detect entities and generate synonyms with OphtaCare context
    const entities = this.extractEntities(lowerMessage);
    const searchTerms = this.generateSearchTerms(lowerMessage);
    const synonyms = this.generateOphtalmologySynonyms(searchTerms);
    
    return {
      requiresDatabase: lowerMessage.includes('dernière') || lowerMessage.includes('récent') || isTaskQuery,
      requiresEmbeddings: !isTaskQuery && (lowerMessage.includes('réunion') || lowerMessage.includes('meeting') || lowerMessage.includes('document') || entities.length > 0),
      requiresInternet: lowerMessage.includes('nouveau') || lowerMessage.includes('actualité') || lowerMessage.includes('2024') || lowerMessage.includes('2025'),
      queryType: isTaskQuery ? 'task' : lowerMessage.includes('réunion') ? 'meeting' : lowerMessage.includes('document') ? 'document' : 'general',
      specificEntities: entities,
      timeContext: lowerMessage.includes('dernière') || lowerMessage.includes('récent') ? 'récent' : null,
      priority: isTaskQuery ? 'database' : lowerMessage.includes('dernière') ? 'database' : 'embeddings',
      searchTerms,
      synonyms,
      iterativeSearch: !isTaskQuery && (entities.length > 0 || searchTerms.length > 2),
      targetedExtraction: entities.length > 0 ? {
        entity: entities[0],
        context: lowerMessage
      } : undefined
    };
  }

  private extractEntities(message: string): string[] {
    const entities: string[] = [];
    
    // Detect names (Mr/Mme/Dr + name)
    const namePattern = /(mr|mme|dr|monsieur|madame|docteur)\s+([a-záàâäéèêëíìîïóòôöúùûüç]+)/gi;
    const nameMatches = message.match(namePattern);
    if (nameMatches) {
      entities.push(...nameMatches);
    }
    
    // Detect OphtaCare specific terms
    const ophtalmoTerms = ['clim', 'climatisation', 'patient', 'traitement', 'examen', 'consultation', 'rendez-vous', 'planning', 'équipement'];
    ophtalmoTerms.forEach(term => {
      if (message.includes(term)) {
        entities.push(term);
      }
    });
    
    return entities;
  }

  private generateSearchTerms(message: string): string[] {
    const words = message.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    return [...new Set(words)]; // Remove duplicates
  }

  private generateOphtalmologySynonyms(searchTerms: string[]): string[] {
    const ophtalmoSynonymMap: { [key: string]: string[] } = {
      'clim': ['climatisation', 'air conditionné', 'température', 'refroidissement', 'ventilation', 'HVAC', 'chauffage'],
      'réunion': ['meeting', 'rendez-vous', 'entretien', 'consultation', 'séance'],
      'patient': ['client', 'personne', 'individu', 'consultation'],
      'traitement': ['thérapie', 'soin', 'médication', 'intervention', 'procédure'],
      'examen': ['diagnostic', 'contrôle', 'vérification', 'test', 'consultation'],
      'planning': ['agenda', 'calendrier', 'horaire', 'programme', 'emploi du temps'],
      'équipement': ['matériel', 'appareil', 'instrument', 'machine', 'dispositif'],
      'cabinet': ['clinique', 'centre', 'ophtacare', 'bureau', 'établissement'],
      'docteur': ['médecin', 'dr', 'praticien', 'tabibian', 'ophtalmologue'],
      'administratif': ['gestion', 'organisation', 'administration', 'secrétariat', 'bureau'],
      'tâche': ['task', 'action', 'travail', 'mission', 'activité'],
      'matériel': ['équipement', 'fournitures', 'outils', 'articles', 'supplies']
    };
    
    const synonyms: string[] = [];
    searchTerms.forEach(term => {
      if (ophtalmoSynonymMap[term]) {
        synonyms.push(...ophtalmoSynonymMap[term]);
      }
    });
    
    return [...new Set(synonyms)];
  }

  async provideFeedback(searchResults: any, originalQuery: string): Promise<SearchFeedback> {
    console.log('[COORDINATOR] Evaluating search results quality for OphtaCare context');
    
    const hasRelevantContent = searchResults && (
      (searchResults.meetings && searchResults.meetings.length > 0) ||
      (searchResults.chunks && searchResults.chunks.length > 0) ||
      (searchResults.content && searchResults.content.length > 0)
    );
    
    if (!hasRelevantContent) {
      return {
        success: false,
        foundRelevant: false,
        needsExpansion: true,
        suggestedTerms: this.generateOphtalmologySynonyms([originalQuery]),
        missingContext: 'Aucun résultat pertinent trouvé dans les données OphtaCare'
      };
    }
    
    return {
      success: true,
      foundRelevant: true,
      needsExpansion: false
    };
  }
}
