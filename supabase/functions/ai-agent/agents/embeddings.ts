
export class EmbeddingsAgent {
  private openaiApiKey: string;
  private supabase: any;

  constructor(openaiApiKey: string, supabase: any) {
    this.openaiApiKey = openaiApiKey;
    this.supabase = supabase;
  }

  async searchEmbeddings(message: string, analysis: any, relevantIds: any, conversationHistory: any[] = []): Promise<any> {
    console.log('[EMBEDDINGS] 🔍 RECHERCHE VECTORIELLE AMÉLIORÉE pour:', message.substring(0, 100));
    
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

    let allChunks: any[] = [];
    let searchIterations = 0;
    const maxIterations = 3;

    // 🎯 Phase 1: Recherche principale avec seuil plus permissif
    console.log('[EMBEDDINGS] 🎯 Phase 1: Recherche principale');
    const embedding = await this.getEmbedding(enrichedQuery);
    const phase1Results = await this.performSearch(enrichedQuery, embedding, 0.05); // Seuil très bas
    allChunks = phase1Results;
    searchIterations++;
    console.log(`[EMBEDDINGS] ✅ Phase 1: ${phase1Results.length} chunks trouvés (seuil 0.05)`);

    // 🔄 Phase 2: Recherche avec termes individuels si peu de résultats
    if (allChunks.length < 3) {
      console.log('[EMBEDDINGS] 🔄 Phase 2: Recherche avec termes individuels');
      const searchTerms = this.extractSearchTerms(message);
      
      for (const term of searchTerms) {
        const termEmbedding = await this.getEmbedding(term);
        const termResults = await this.performSearch(term, termEmbedding, 0.03); // Seuil encore plus bas
        allChunks = this.mergeUniqueChunks(allChunks, termResults);
        searchIterations++;
        console.log(`[EMBEDDINGS] ✅ Phase 2: ${termResults.length} chunks pour "${term}"`);
        
        if (allChunks.length >= 8) break;
      }
    }

    // 🔄 Phase 3: Recherche de fallback avec query simple
    if (allChunks.length < 2) {
      console.log('[EMBEDDINGS] 🔄 Phase 3: Recherche de fallback');
      const simpleEmbedding = await this.getEmbedding(message);
      const fallbackResults = await this.performSearch(message, simpleEmbedding, 0.01); // Seuil minimal
      allChunks = this.mergeUniqueChunks(allChunks, fallbackResults);
      searchIterations++;
      console.log(`[EMBEDDINGS] ✅ Phase 3: ${fallbackResults.length} chunks en fallback`);
    }

    console.log(`[EMBEDDINGS] ✅ RECHERCHE TERMINÉE: ${searchIterations} itérations, ${allChunks.length} chunks trouvés`);

    // Tri final par score de similarité
    allChunks.sort((a, b) => b.similarity - a.similarity);
    
    // Log des meilleurs résultats
    if (allChunks.length > 0) {
      console.log('[EMBEDDINGS] 📊 TOP 3 RÉSULTATS:');
      allChunks.slice(0, 3).forEach((chunk, index) => {
        console.log(`  ${index + 1}. Similarité: ${chunk.similarity.toFixed(3)}, Texte: "${chunk.chunk_text.substring(0, 100)}..."`);
      });
    } else {
      console.log('[EMBEDDINGS] ⚠️ AUCUN RÉSULTAT TROUVÉ - Problème possible avec les embeddings');
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
      finalSearchTerms: [message],
      fuzzyResults: [],
      conversationHistoryUsed: conversationHistory.length
    };
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

  private extractSearchTerms(message: string): string[] {
    const words = message.toLowerCase()
      .split(/\s+/)
      .filter(word => 
        word.length > 3 && 
        !['dans', 'avec', 'pour', 'sans', 'vers', 'chez', 'sous', 'sur', 'par', 'très', 'bien', 'tout', 'cette', 'peut', 'faire'].includes(word)
      );
    
    // Retourner les 3 mots les plus significatifs
    return words.slice(0, 3);
  }
}
