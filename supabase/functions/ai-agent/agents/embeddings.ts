export class EmbeddingsAgent {
  private openaiApiKey: string;
  private supabase: any;

  constructor(openaiApiKey: string, supabase: any) {
    this.openaiApiKey = openaiApiKey;
    this.supabase = supabase;
  }

  async searchEmbeddings(message: string, analysis: any, relevantIds: any, conversationHistory: any[] = []): Promise<any> {
    console.log('[EMBEDDINGS] RECHERCHE VECTORIELLE ULTRA-AGRESSIVE pour enrichissement maximum');
    
    // Construire le contexte enrichi avec l'historique
    let enrichedQuery = message;
    
    // Ajouter l'historique récent pour le contexte
    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-3).map((msg: any) => {
        const role = msg.isUser ? 'Utilisateur' : 'Assistant';
        return `${role}: ${msg.content.substring(0, 150)}`;
      }).join('\n');
      
      enrichedQuery = `${message}\n\nCONTEXTE CONVERSATION RÉCENTE:\n${recentHistory}`;
      console.log('[EMBEDDINGS] ✅ Historique intégré:', conversationHistory.length, 'messages');
    }

    // Contexte des participants
    console.log('[EMBEDDINGS] Enrichissement avec contexte des participants');
    
    // Ajouter le contexte des participants disponibles pour améliorer la recherche
    const participantNames = ['David Tabibian', 'emilie', 'leila', 'parmice', 'sybil'];
    const participantContext = `\n\nCONTEXT_PARTICIPANTS: David Tabibian (david.tabibian@gmail.com, ID: c04c6400-1025-4906-9823-30478123bd71), emilie (test, ID: 9b8b37f6-ee0c-4354-be18-6a0ca0930b12), leila (test, ID: 42445b1f-d701-4f30-b57c-48814b64a1df), parmice (test, ID: a0c5df24-45ba-49c8-bb5e-1a6e9fc7f49d), sybil (michael.enry4@gmail.com, ID: 2fdb2b35-91ef-4966-93ec-9261172c31c1)`;
    
    const finalQuery = enrichedQuery + participantContext;

    let allChunks: any[] = [];
    let searchIterations = 0;
    const maxIterations = 5;
    let expansionLevel = 0;

    // 🎯 Phase 1: Recherche principale ultra-agressive
    console.log('[EMBEDDINGS] 🎯 Phase 1: Recherche principale ultra-agressive');
    const embedding = await this.getEmbedding(finalQuery);
    const phase1Results = await this.performUltraAggressiveSearch(finalQuery, embedding, 0.12);
    allChunks = phase1Results;
    searchIterations++;
    console.log(`[EMBEDDINGS] ✅ Phase 1: ${phase1Results.length} chunks trouvés (seuil 0.12)`);

    // 🔄 Phase 2: Expansion maximale avec tous les termes
    if (allChunks.length < 8) {
      console.log('[EMBEDDINGS] 🔄 Phase 2: Expansion maximale avec tous les termes');
      const searchTerms = this.extractSearchTerms(message);
      
      for (const term of searchTerms) {
        const termEmbedding = await this.getEmbedding(term);
        const termResults = await this.performUltraAggressiveSearch(term, termEmbedding, 0.08);
        allChunks = this.mergeUniqueChunks(allChunks, termResults);
        searchIterations++;
        console.log(`[EMBEDDINGS] ✅ Phase 2: ${termResults.length} chunks pour "${term}" (seuil 0.08)`);
        
        if (allChunks.length >= 15) break;
      }
    }

    // 🔄 Phase 3: Recherche systématique avec synonymes
    if (allChunks.length < 12) {
      console.log('[EMBEDDINGS] 🔄 Phase 3: Recherche systématique avec synonymes');
      const synonyms = this.generateSynonyms(message);
      
      for (const synonym of synonyms) {
        const synEmbedding = await this.getEmbedding(synonym);
        const synResults = await this.performUltraAggressiveSearch(synonym, synEmbedding, 0.1);
        allChunks = this.mergeUniqueChunks(allChunks, synResults);
        searchIterations++;
        console.log(`[EMBEDDINGS] ✅ Phase 3: ${synResults.length} chunks pour synonyme "${synonym}"`);
        
        if (allChunks.length >= 20) break;
      }
    }

    console.log(`[EMBEDDINGS] ✅ RECHERCHE ULTRA-AGRESSIVE TERMINÉE: ${searchIterations} itérations, ${allChunks.length} chunks uniques, niveau expansion: ${expansionLevel}`);

    // Tri final par score de similarité
    allChunks.sort((a, b) => b.similarity - a.similarity);
    
    // Log des meilleurs résultats
    if (allChunks.length > 0) {
      console.log('[EMBEDDINGS] 📊 TOP 5 RÉSULTATS:');
      allChunks.slice(0, 5).forEach((chunk, index) => {
        console.log(`  ${index + 1}. Similarité: ${chunk.similarity.toFixed(3)}, Score: ${chunk.similarity}, Texte: "${chunk.chunk_text.substring(0, 100)}..."`);
      });
    }

    // Enrichir les sources avec les informations nécessaires pour le frontend
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
      hasRelevantContext: allChunks.length > 0 && allChunks[0]?.similarity > 0.15,
      searchIterations,
      finalSearchTerms: [message],
      fuzzyResults: [],
      expansionLevel,
      conversationHistoryUsed: conversationHistory.length
    };
  }

  private async getEmbedding(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
    });

    const data = await response.json();
    return data.data[0].embedding;
  }

  private async performUltraAggressiveSearch(query: string, embedding: number[], threshold: number): Promise<any[]> {
    console.log(`[EMBEDDINGS] 🔍 Recherche ultra-agressive: "${query}" (seuil: ${threshold})`);
    
    const { data, error } = await this.supabase
      .rpc('search_document_embeddings', {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: 50
      });

    if (error) {
      console.error('[EMBEDDINGS] ❌ Erreur recherche:', error);
      return [];
    }

    const results = data || [];
    console.log(`[EMBEDDINGS] ✅ ${results.length} résultats ultra-agressifs pour "${query}"`);
    
    return results;
  }

  private mergeUniqueChunks(existing: any[], newChunks: any[]): any[] {
    const existingIds = new Set(existing.map(chunk => chunk.id));
    const uniqueNew = newChunks.filter(chunk => !existingIds.has(chunk.id));
    return [...existing, ...uniqueNew];
  }

  private extractSearchTerms(message: string): string[] {
    const words = message.toLowerCase().split(/\s+/);
    const importantWords = words.filter(word => 
      word.length > 3 && 
      !['dans', 'avec', 'pour', 'sans', 'vers', 'chez', 'sous', 'sur', 'par'].includes(word)
    );
    return importantWords.slice(0, 3);
  }

  private generateSynonyms(message: string): string[] {
    const lowerMessage = message.toLowerCase();
    const synonyms: string[] = [];

    // Synonymes pour des termes courants
    if (lowerMessage.includes('acheter')) {
      synonyms.push('se procurer du café', 'acheter du café');
    }
    if (lowerMessage.includes('café')) {
      synonyms.push('café', 'acheter du café', 'se procurer du café');
    }
    if (lowerMessage.includes('tâche')) {
      synonyms.push('task', 'todo', 'travail');
    }
    if (lowerMessage.includes('réunion')) {
      synonyms.push('meeting', 'rendez-vous', 'entretien');
    }

    return synonyms.slice(0, 2);
  }
}
