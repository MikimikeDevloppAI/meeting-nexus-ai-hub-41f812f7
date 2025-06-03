
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
    console.log('[COORDINATOR] Analyzing query with enhanced semantic expansion:', message.substring(0, 100));

    const analysisPrompt = `Tu es un coordinateur intelligent pour OphtaCare, le cabinet d'ophtalmologie du Dr Tabibian à Genève.
L'utilisateur qui te parle s'occupe de la partie ADMINISTRATIVE du cabinet.

PRIORITÉ ABSOLUE : TOUJOURS PRIVILÉGIER LA RECHERCHE VECTORIELLE INTERNE
- requiresEmbeddings = true pour TOUTES les questions (sauf actions de tâches pures)
- priority = "embeddings" par défaut
- Recherche vectorielle AVANT tout autre type de recherche

Analyse cette question administrative et détermine la stratégie optimale de recherche avec expansion sémantique maximale :

QUESTION: "${message}"

HISTORIQUE RÉCENT: ${conversationHistory.slice(-3).map(h => `${h.isUser ? 'ADMIN' : 'ASSISTANT'}: ${h.content.substring(0, 200)}`).join('\n')}

CONTEXTE OPHTACARE GENÈVE :
- Cabinet d'ophtalmologie dirigé par Dr Tabibian
- Utilisateur = responsable administratif du cabinet
- Données disponibles : réunions, documents, tâches, transcripts, planning
- Focus sur gestion administrative et organisation du cabinet
- Base de données avec embeddings très riche

RÈGLES D'ANALYSE RENFORCÉES :
1. TOUJOURS requiresEmbeddings = true (sauf création pure de tâche)
2. TOUJOURS priority = "embeddings" (recherche vectorielle d'abord)
3. Générer BEAUCOUP de termes de recherche et synonymes
4. iterativeSearch = true pour maximiser les résultats
5. Expansion sémantique maximale

DÉTECTION SPÉCIALE TÂCHES :
Si la question contient des mots comme "crée", "créer", "ajoute", "tâche", "task" → queryType = "task"
Si détection de tâche → requiresDatabase = true (pour accéder aux tâches existantes)
Si création de tâche → requiresEmbeddings = false (pas besoin de recherche sémantique)

Tu dois analyser finement la requête pour :
1. Identifier les entités précises (noms, concepts, équipements, médicaments)
2. Générer des synonymes et termes apparentés pour l'ophtalmologie ET la médecine générale
3. Déterminer si une extraction ciblée est nécessaire
4. Planifier une recherche multi-étapes si besoin
5. Rester dans le contexte administratif d'OphtaCare
6. MAXIMISER la recherche vectorielle pour tout contenu médical/administratif

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

RÈGLES D'ANALYSE SPÉCIALISÉES OPHTACARE RENFORCÉES :
- Pour "dupixent", "bonus", "règles" → ajouter ["dupilumab", "dermatologie", "traitement", "indemnisation", "remboursement", "assurance", "protocole", "prescription", "critères"]
- Pour "clim" → ajouter ["climatisation", "air conditionné", "température", "refroidissement", "HVAC"]
- Pour "Mr Fischer" → recherche ciblée avec extraction de sections spécifiques
- Pour "dernière réunion" → database d'abord avec ID spécifique, puis embeddings ciblés
- Pour équipements médicaux → synonymes techniques ophtalmologiques
- Pour patients → recherche administrative (pas médicale)
- Pour TÂCHES → queryType="task", requiresDatabase=true, requiresEmbeddings=false
- Pour TOUT LE RESTE → requiresEmbeddings=true, priority="embeddings"
- Toujours générer des synonymes pertinents pour l'ophtalmologie ET médecine générale
- Activer iterativeSearch=true par défaut
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
          max_tokens: 1000,
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
    const synonyms = this.generateOphtalmologySynonyms(searchTerms, lowerMessage);
    
    return {
      requiresDatabase: lowerMessage.includes('dernière') || lowerMessage.includes('récent') || isTaskQuery,
      requiresEmbeddings: !isTaskQuery, // TOUJOURS true sauf pour les tâches
      requiresInternet: false, // Prioriser interne d'abord
      queryType: isTaskQuery ? 'task' : lowerMessage.includes('réunion') ? 'meeting' : lowerMessage.includes('document') ? 'document' : 'general',
      specificEntities: entities,
      timeContext: lowerMessage.includes('dernière') || lowerMessage.includes('récent') ? 'récent' : null,
      priority: isTaskQuery ? 'database' : 'embeddings', // TOUJOURS embeddings sauf tâches
      searchTerms,
      synonyms,
      iterativeSearch: true, // TOUJOURS true pour maximiser les résultats
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
    
    // Detect OphtaCare specific terms with medical focus
    const ophtalmoTerms = ['dupixent', 'dupilumab', 'clim', 'climatisation', 'patient', 'traitement', 'examen', 'consultation', 'rendez-vous', 'planning', 'équipement', 'bonus', 'règles', 'remboursement', 'assurance'];
    ophtalmoTerms.forEach(term => {
      if (message.includes(term)) {
        entities.push(term);
      }
    });
    
    return entities;
  }

  private generateSearchTerms(message: string): string[] {
    const words = message.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const expandedTerms = [];
    
    // Add original words
    expandedTerms.push(...words);
    
    // Add specific medical/administrative terms based on context
    if (message.includes('dupixent') || message.includes('bonus')) {
      expandedTerms.push('dupilumab', 'dermatologie', 'traitement', 'indemnisation', 'remboursement', 'assurance', 'protocole', 'prescription', 'critères');
    }
    
    return [...new Set(expandedTerms)]; // Remove duplicates
  }

  private generateOphtalmologySynonyms(searchTerms: string[], fullMessage: string): string[] {
    const ophtalmoSynonymMap: { [key: string]: string[] } = {
      'dupixent': ['dupilumab', 'dermatologie', 'atopique', 'dermatite', 'eczéma', 'immunosuppresseur', 'biologique', 'injection', 'traitement', 'thérapie'],
      'bonus': ['indemnisation', 'remboursement', 'prime', 'compensation', 'rétribution', 'règles', 'critères', 'conditions'],
      'règles': ['règlement', 'protocole', 'procédure', 'critères', 'conditions', 'modalités', 'directives', 'instructions'],
      'remboursement': ['indemnisation', 'prise en charge', 'couverture', 'assurance', 'sécurité sociale', 'mutuelle'],
      'clim': ['climatisation', 'air conditionné', 'température', 'refroidissement', 'ventilation', 'HVAC', 'chauffage'],
      'réunion': ['meeting', 'rendez-vous', 'entretien', 'consultation', 'séance'],
      'patient': ['client', 'personne', 'individu', 'consultation'],
      'traitement': ['thérapie', 'soin', 'médication', 'intervention', 'procédure', 'prescription'],
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
    
    // Add context-specific synonyms based on full message
    if (fullMessage.includes('dupixent') || fullMessage.includes('bonus')) {
      synonyms.push('dermatologie', 'atopique', 'traitement', 'prescription', 'remboursement', 'assurance', 'critères', 'conditions', 'modalités');
    }
    
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
      // Generate more expansive search terms for retry
      const expandedTerms = this.generateOphtalmologySynonyms([originalQuery], originalQuery);
      
      return {
        success: false,
        foundRelevant: false,
        needsExpansion: true,
        suggestedTerms: expandedTerms,
        missingContext: 'Aucun résultat pertinent trouvé dans les données OphtaCare - tentative de recherche élargie'
      };
    }
    
    return {
      success: true,
      foundRelevant: true,
      needsExpansion: false
    };
  }
}
