export class EmbeddingsAgent {
  private openaiApiKey: string;
  private supabase: any;

  constructor(openaiApiKey: string, supabase: any) {
    this.openaiApiKey = openaiApiKey;
    this.supabase = supabase;
  }

  async searchEmbeddings(message: string, analysis: any, relevantIds: any, conversationHistory: any[] = []): Promise<any> {
    console.log('[EMBEDDINGS] 🔍 RECHERCHE VECTORIELLE OPTIMISÉE pour:', message.substring(0, 100));
    
    // Construire le contexte enrichi avec l'historique et termes spécialisés
    let enrichedQuery = this.buildEnrichedQuery(message, conversationHistory);

    let allChunks: any[] = [];
    let searchIterations = 0;
    const maxIterations = 4;

    // 🎯 Phase 1: Recherche principale avec query enrichie
    console.log('[EMBEDDINGS] 🎯 Phase 1: Recherche principale enrichie');
    const embedding = await this.getEmbedding(enrichedQuery);
    const phase1Results = await this.performSearch(enrichedQuery, embedding, 0.08); // Seuil optimisé
    allChunks = phase1Results;
    searchIterations++;
    console.log(`[EMBEDDINGS] ✅ Phase 1: ${phase1Results.length} chunks trouvés`);

    // 🔄 Phase 2: Recherche avec termes individuels et synonymes
    if (allChunks.length < 5) {
      console.log('[EMBEDDINGS] 🔄 Phase 2: Recherche avec termes étendus');
      const expandedTerms = this.extractExpandedSearchTerms(message);
      
      for (const term of expandedTerms) {
        const termEmbedding = await this.getEmbedding(term);
        const termResults = await this.performSearch(term, termEmbedding, 0.05);
        allChunks = this.mergeUniqueChunks(allChunks, termResults);
        searchIterations++;
        console.log(`[EMBEDDINGS] ✅ Phase 2: ${termResults.length} chunks pour "${term}"`);
        
        if (allChunks.length >= 10) break;
      }
    }

    // 🔄 Phase 3: Recherche contextuelle large
    if (allChunks.length < 3) {
      console.log('[EMBEDDINGS] 🔄 Phase 3: Recherche contextuelle large');
      const contextualQueries = this.generateContextualQueries(message);
      
      for (const contextQuery of contextualQueries) {
        const contextEmbedding = await this.getEmbedding(contextQuery);
        const contextResults = await this.performSearch(contextQuery, contextEmbedding, 0.03);
        allChunks = this.mergeUniqueChunks(allChunks, contextResults);
        searchIterations++;
        console.log(`[EMBEDDINGS] ✅ Phase 3: ${contextResults.length} chunks pour contexte`);
        
        if (allChunks.length >= 8) break;
      }
    }

    // 🔄 Phase 4: Recherche de fallback ultime
    if (allChunks.length < 2) {
      console.log('[EMBEDDINGS] 🔄 Phase 4: Recherche fallback ultime');
      const simpleEmbedding = await this.getEmbedding(message);
      const fallbackResults = await this.performSearch(message, simpleEmbedding, 0.01);
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

    // Enrichir les sources avec les informations nécessaires
    const enrichedSources = allChunks.map(chunk => ({
      id: chunk.id,
      type: 'embedding',
      content: chunk.chunk_text,
      chunk_text: chunk.chunk_text,
      similarity: chunk.similarity,
      document_id: chunk.document_id,
      meeting_id: chunk.meeting_id,
      chunk_index: chunk.chunk_index
    }));

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
    
    if (lowerMessage.includes('emilie') || lowerMessage.includes('tâche') || lowerMessage.includes('jeudi')) {
      return 'ophtalmologie cabinet médical planning tâches Emilie Dr Tabibian Genève consultation patient';
    }
    
    if (lowerMessage.includes('planning') || lowerMessage.includes('rendez-vous')) {
      return 'planning consultation patient ophtalmologie cabinet médical';
    }
    
    return null;
  }

  private generateContextualQueries(message: string): string[] {
    const queries = [];
    const lowerMessage = message.toLowerCase();
    
    // Générer des requêtes contextuelles basées sur le message
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
    
    if (lowerMessage.includes('tous les')) {
      queries.push('tâches récurrentes planning');
      queries.push('organisation hebdomadaire cabinet');
    }
    
    // Ajouter des requêtes générales si pas de contexte spécifique
    if (queries.length === 0) {
      queries.push('planning cabinet ophtalmologie');
      queries.push('organisation tâches équipe');
    }
    
    return queries.slice(0, 3); // Limiter à 3 requêtes max
  }

  private extractExpandedSearchTerms(message: string): string[] {
    const words = message.toLowerCase()
      .split(/\s+/)
      .filter(word => 
        word.length > 2 && 
        !['dans', 'avec', 'pour', 'sans', 'vers', 'chez', 'sous', 'sur', 'par', 'très', 'bien', 'tout', 'cette', 'peut', 'faire', 'que', 'est', 'elle', 'doit'].includes(word)
      );
    
    // Ajouter des synonymes et termes liés
    const expandedTerms = [...words];
    
    if (words.includes('emilie')) {
      expandedTerms.push('émilie', 'assistante', 'secrétaire', 'équipe');
    }
    
    if (words.includes('jeudi')) {
      expandedTerms.push('thursday', 'planning', 'hebdomadaire');
    }
    
    if (words.includes('tâches') || words.includes('faire')) {
      expandedTerms.push('responsabilités', 'travail', 'activités', 'mission');
    }
    
    // Retourner les termes les plus significatifs
    return [...new Set(expandedTerms)].slice(0, 5);
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
