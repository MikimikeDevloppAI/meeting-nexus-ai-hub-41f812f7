export class EmbeddingsAgent {
  private openaiApiKey: string;
  private supabase: any;

  constructor(openaiApiKey: string, supabase: any) {
    this.openaiApiKey = openaiApiKey;
    this.supabase = supabase;
  }

  async searchEmbeddings(message: string, analysis: any, relevantIds: any, conversationHistory: any[] = []): Promise<any> {
    console.log('[EMBEDDINGS] 🔍 RECHERCHE VECTORIELLE AMÉLIORÉE pour:', message.substring(0, 100));
    
    // Construire le contexte enrichi avec l'historique et termes spécialisés
    let enrichedQuery = this.buildEnrichedQuery(message, conversationHistory);

    let allChunks: any[] = [];
    let searchIterations = 0;
    const maxIterations = 4;

    // 🎯 Phase 1: Recherche principale avec query enrichie - SEUIL RÉDUIT
    console.log('[EMBEDDINGS] 🎯 Phase 1: Recherche principale enrichie (seuil 0.4)');
    const embedding = await this.getEmbedding(enrichedQuery);
    const phase1Results = await this.performSearch(enrichedQuery, embedding, 0.4); // SEUIL RÉDUIT de 0.05 à 0.4
    allChunks = phase1Results;
    searchIterations++;
    console.log(`[EMBEDDINGS] ✅ Phase 1: ${phase1Results.length} chunks trouvés`);

    // 🔄 Phase 2: Recherche avec termes individuels et synonymes médicaux
    if (allChunks.length < 8) { // Augmenté de 5 à 8
      console.log('[EMBEDDINGS] 🔄 Phase 2: Recherche avec synonymes médicaux');
      const expandedTerms = this.extractMedicalSynonyms(message);
      
      for (const term of expandedTerms) {
        const termEmbedding = await this.getEmbedding(term);
        const termResults = await this.performSearch(term, termEmbedding, 0.3); // Seuil réduit de 0.03 à 0.3
        allChunks = this.mergeUniqueChunks(allChunks, termResults);
        searchIterations++;
        console.log(`[EMBEDDINGS] ✅ Phase 2: ${termResults.length} chunks pour "${term}"`);
        
        if (allChunks.length >= 15) break; // Augmenté de 10 à 15
      }
    }

    // 🔄 Phase 3: Recherche contextuelle large avec termes médicaux
    if (allChunks.length < 5) { // Augmenté de 3 à 5
      console.log('[EMBEDDINGS] 🔄 Phase 3: Recherche contextuelle médicale');
      const contextualQueries = this.generateMedicalContextualQueries(message);
      
      for (const contextQuery of contextualQueries) {
        const contextEmbedding = await this.getEmbedding(contextQuery);
        const contextResults = await this.performSearch(contextQuery, contextEmbedding, 0.25); // Seuil réduit de 0.01 à 0.25
        allChunks = this.mergeUniqueChunks(allChunks, contextResults);
        searchIterations++;
        console.log(`[EMBEDDINGS] ✅ Phase 3: ${contextResults.length} chunks pour contexte médical`);
        
        if (allChunks.length >= 12) break; // Augmenté de 8 à 12
      }
    }

    // 🔄 Phase 4: Recherche de fallback avec seuil très permissif
    if (allChunks.length < 3) {
      console.log('[EMBEDDINGS] 🔄 Phase 4: Recherche fallback permissive');
      const simpleEmbedding = await this.getEmbedding(message);
      const fallbackResults = await this.performSearch(message, simpleEmbedding, 0.2); // Seuil réduit de 0.005 à 0.2
      allChunks = this.mergeUniqueChunks(allChunks, fallbackResults);
      searchIterations++;
      console.log(`[EMBEDDINGS] ✅ Phase 4: ${fallbackResults.length} chunks en fallback`);
    }

    console.log(`[EMBEDDINGS] ✅ RECHERCHE TERMINÉE: ${searchIterations} itérations, ${allChunks.length} chunks trouvés`);

    // Tri final par score de similarité
    allChunks.sort((a, b) => b.similarity - a.similarity);
    
    // Log détaillé des meilleurs résultats
    if (allChunks.length > 0) {
      console.log('[EMBEDDINGS] 📊 TOP 5 RÉSULTATS:');
      allChunks.slice(0, 5).forEach((chunk, index) => {
        console.log(`  ${index + 1}. Similarité: ${chunk.similarity.toFixed(3)}, Doc: ${chunk.document_id}, Texte: "${chunk.chunk_text.substring(0, 100)}..."`);
      });
    } else {
      console.log('[EMBEDDINGS] ⚠️ AUCUN RÉSULTAT - Recherche dans documents vides ou problème embeddings');
    }

    // Enrichir les sources avec les informations nécessaires depuis la table documents
    const enrichedSources = await this.enrichSourcesWithDocumentNames(allChunks);

    return {
      chunks: allChunks,
      sources: enrichedSources,
      hasRelevantContext: allChunks.length > 0,
      searchIterations,
      finalSearchTerms: [enrichedQuery],
      fuzzyResults: [],
      conversationHistoryUsed: conversationHistory.length,
      expansionLevel: searchIterations
    };
  }

  private async enrichSourcesWithDocumentNames(chunks: any[]): Promise<any[]> {
    const enrichedSources = [];
    
    for (const chunk of chunks) {
      let documentName = 'Document inconnu';
      
      if (chunk.document_id) {
        try {
          console.log(`[EMBEDDINGS] 📄 Récupération nom document ID: ${chunk.document_id}`);
          
          // Récupérer le nom du document depuis la table documents
          const { data, error } = await this.supabase
            .from('documents')
            .select('title')
            .eq('id', chunk.document_id)
            .single();

          if (error) {
            console.error('[EMBEDDINGS] ❌ Erreur récupération document:', error);
          } else if (data && data.title) {
            documentName = data.title;
            console.log(`[EMBEDDINGS] ✅ Nom document trouvé: ${documentName}`);
          }
        } catch (error) {
          console.error('[EMBEDDINGS] ❌ Erreur récupération nom document:', error);
        }
      }

      enrichedSources.push({
        id: chunk.id,
        type: 'embedding',
        content: chunk.chunk_text,
        chunk_text: chunk.chunk_text,
        similarity: chunk.similarity,
        document_id: chunk.document_id,
        document_name: documentName,
        meeting_id: chunk.meeting_id,
        chunk_index: chunk.chunk_index
      });
    }

    return enrichedSources;
  }

  private buildEnrichedQuery(message: string, conversationHistory: any[] = []): string {
    let enrichedQuery = message;
    
    // Ajouter l'historique récent pour le contexte
    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-2).map((msg: any) => {
        const role = msg.isUser ? 'Utilisateur' : 'Assistant';
        return `${role}: ${msg.content.substring(0, 100)}`;
      }).join('\n');
      
      enrichedQuery = `${message}\n\nCONTEXTE CONVERSATION:\n${recentHistory}`;
    }

    // Ajouter des termes médicaux/ophtalmologie si pertinent
    const medicalTerms = this.addMedicalContext(message);
    if (medicalTerms) {
      enrichedQuery += `\n\nCONTEXTE MÉDICAL: ${medicalTerms}`;
    }

    return enrichedQuery;
  }

  private addMedicalContext(message: string): string | null {
    const lowerMessage = message.toLowerCase();
    
    // Ajout de contexte médical pour différents domaines
    if (lowerMessage.includes('yeux') || lowerMessage.includes('œil') || lowerMessage.includes('oeil') || lowerMessage.includes('paupière') || lowerMessage.includes('lavage')) {
      return 'ophtalmologie paupières yeux œil hygiène lavage nettoyage soins oculaires vision';
    }
    
    if (lowerMessage.includes('chirurgie') || lowerMessage.includes('laser') || lowerMessage.includes('opération') || lowerMessage.includes('intervention')) {
      return 'chirurgie laser opération intervention LASIK réfractive cataracte implant';
    }
    
    if (lowerMessage.includes('lentille') || lowerMessage.includes('contact')) {
      return 'lentilles contact hygiène entretien port utilisation';
    }
    
    if (lowerMessage.includes('emilie') || lowerMessage.includes('tâche') || lowerMessage.includes('jeudi')) {
      return 'ophtalmologie cabinet médical planning tâches Emilie Dr Tabibian Genève consultation patient';
    }
    
    if (lowerMessage.includes('planning') || lowerMessage.includes('rendez-vous')) {
      return 'planning consultation patient ophtalmologie cabinet médical';
    }
    
    return null;
  }

  // NOUVELLE FONCTION: Extraction de synonymes médicaux automatiques
  private extractMedicalSynonyms(message: string): string[] {
    const lowerMessage = message.toLowerCase();
    const synonyms = new Set<string>();
    
    // Dictionnaire de synonymes médicaux ophtalmologiques
    const medicalSynonyms = {
      'yeux': ['œil', 'oeil', 'oculaire', 'vision', 'paupières', 'globe oculaire'],
      'œil': ['yeux', 'œil', 'oculaire', 'vision', 'paupières', 'globe oculaire'],
      'oeil': ['yeux', 'œil', 'oculaire', 'vision', 'paupières', 'globe oculaire'],
      'paupières': ['yeux', 'œil', 'oeil', 'paupière', 'hygiène oculaire'],
      'lavage': ['nettoyage', 'hygiène', 'soins', 'entretien', 'toilette'],
      'chirurgie': ['opération', 'intervention', 'acte chirurgical', 'procédure'],
      'laser': ['LASIK', 'réfractive', 'correction', 'chirurgie au laser'],
      'lentilles': ['lentille', 'contact', 'contactologie', 'port de lentilles'],
      'cataracte': ['cristallin', 'opacification', 'chirurgie du cristallin'],
      'glaucome': ['pression oculaire', 'tension oculaire', 'nerf optique'],
      'vision': ['vue', 'acuité visuelle', 'correction visuelle'],
      'correction': ['réfractive', 'défaut visuel', 'myopie', 'presbytie', 'astigmatisme']
    };
    
    // Ajouter le message original
    synonyms.add(message);
    
    // Chercher des correspondances et ajouter les synonymes
    for (const [terme, syns] of Object.entries(medicalSynonyms)) {
      if (lowerMessage.includes(terme)) {
        syns.forEach(syn => synonyms.add(syn));
        synonyms.add(terme);
      }
    }
    
    // Extraire les mots significatifs du message original
    const words = lowerMessage
      .split(/\s+/)
      .filter(word => 
        word.length > 2 && 
        !['dans', 'avec', 'pour', 'sans', 'vers', 'chez', 'sous', 'sur', 'par', 'très', 'bien', 'tout', 'cette', 'peut', 'faire', 'que', 'est', 'elle', 'doit'].includes(word)
      );
    
    words.forEach(word => synonyms.add(word));
    
    console.log('[EMBEDDINGS] 🔤 Synonymes médicaux générés:', Array.from(synonyms));
    
    return Array.from(synonyms).slice(0, 8); // Limiter à 8 termes max
  }

  // NOUVELLE FONCTION: Génération de requêtes contextuelles médicales
  private generateMedicalContextualQueries(message: string): string[] {
    const lowerMessage = message.toLowerCase();
    const queries = [];
    
    // Requêtes contextuelles spécialisées en ophtalmologie
    if (lowerMessage.includes('yeux') || lowerMessage.includes('œil') || lowerMessage.includes('oeil') || lowerMessage.includes('lavage')) {
      queries.push('hygiène paupières nettoyage yeux');
      queries.push('soins oculaires lavage paupières');
      queries.push('entretien hygiène des yeux');
    }
    
    if (lowerMessage.includes('chirurgie') || lowerMessage.includes('laser')) {
      queries.push('chirurgie réfractive laser LASIK');
      queries.push('intervention ophtalmologique laser');
      queries.push('correction visuelle chirurgie');
    }
    
    if (lowerMessage.includes('lentille') || lowerMessage.includes('contact')) {
      queries.push('lentilles contact hygiène utilisation');
      queries.push('entretien lentilles contactologie');
      queries.push('port lentilles soins');
    }
    
    if (lowerMessage.includes('emilie')) {
      queries.push('Emilie tâches planning');
      queries.push('responsabilités Emilie cabinet');
      queries.push('planning Emilie ophtalmologie');
    }
    
    if (lowerMessage.includes('jeudi')) {
      queries.push('planning jeudi cabinet');
      queries.push('tâches hebdomadaires jeudi');
      queries.push('organisation jeudi consultation');
    }
    
    // Ajouter des requêtes générales si pas de contexte spécifique
    if (queries.length === 0) {
      queries.push('ophtalmologie cabinet soins');
      queries.push('consultation traitement vision');
      queries.push('procédures médicales yeux');
    }
    
    console.log('[EMBEDDINGS] 🎯 Requêtes contextuelles médicales:', queries);
    
    return queries.slice(0, 4); // Limiter à 4 requêtes max
  }

  private async getEmbedding(text: string): Promise<number[]> {
    console.log(`[EMBEDDINGS] 🔢 Génération embedding pour: "${text.substring(0, 50)}..."`);
    
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.trim(),
      }),
    });

    if (!response.ok) {
      console.error('[EMBEDDINGS] ❌ Erreur API embedding:', response.status);
      throw new Error(`Embedding API error: ${response.status}`);
    }

    const data = await response.json();
    const embedding = data.data[0].embedding;
    console.log(`[EMBEDDINGS] ✅ Embedding généré: ${embedding.length} dimensions`);
    return embedding;
  }

  private async performSearch(query: string, embedding: number[], threshold: number): Promise<any[]> {
    console.log(`[EMBEDDINGS] 🔍 Recherche: "${query.substring(0, 50)}" (seuil: ${threshold})`);
    
    try {
      const { data, error } = await this.supabase
        .rpc('search_document_embeddings', {
          query_embedding: embedding,
          match_threshold: threshold,
          match_count: 20
        });

      if (error) {
        console.error('[EMBEDDINGS] ❌ Erreur RPC:', error);
        return [];
      }

      const results = data || [];
      console.log(`[EMBEDDINGS] ✅ ${results.length} résultats pour "${query.substring(0, 30)}"`);
      
      // Log détaillé des résultats
      if (results.length > 0) {
        console.log('[EMBEDDINGS] 📋 Détails des résultats:');
        results.slice(0, 3).forEach((result: any, i: number) => {
          console.log(`  ${i+1}. ID: ${result.id}, Similarité: ${result.similarity?.toFixed(3)}, Doc: ${result.document_id}`);
        });
      }
      
      return results;
    } catch (error) {
      console.error('[EMBEDDINGS] ❌ Erreur search:', error);
      return [];
    }
  }

  private mergeUniqueChunks(existing: any[], newChunks: any[]): any[] {
    const existingIds = new Set(existing.map(chunk => chunk.id));
    const uniqueNew = newChunks.filter(chunk => !existingIds.has(chunk.id));
    return [...existing, ...uniqueNew];
  }
}
