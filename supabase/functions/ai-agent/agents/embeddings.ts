
export interface EmbeddingContext {
  chunks: any[];
  sources: any[];
  hasRelevantContext: boolean;
  searchIterations: number;
  finalSearchTerms: string[];
}

export class EmbeddingsAgent {
  private openaiApiKey: string;
  private supabase: any;

  constructor(openaiApiKey: string, supabase: any) {
    this.openaiApiKey = openaiApiKey;
    this.supabase = supabase;
  }

  async searchEmbeddings(
    message: string, 
    analysis: any,
    relevantIds?: { meetingIds: string[], documentIds: string[] }
  ): Promise<EmbeddingContext> {
    console.log('[EMBEDDINGS] Starting ENHANCED AGGRESSIVE semantic search');
    
    let searchIterations = 0;
    let allChunks: any[] = [];
    let allSources: any[] = [];
    
    // 1. RECHERCHE PRINCIPALE avec message original (seuil bas pour capturer plus)
    console.log('[EMBEDDINGS] 🎯 Phase 1: Recherche principale avec message original');
    let searchResults = await this.performSearch(message, relevantIds, 0.3); // Seuil très bas
    searchIterations++;
    
    if (searchResults.chunks.length > 0) {
      allChunks.push(...searchResults.chunks);
      allSources.push(...searchResults.sources);
      console.log(`[EMBEDDINGS] ✅ Phase 1: ${searchResults.chunks.length} chunks trouvés`);
    } else {
      console.log('[EMBEDDINGS] ⚠️ Phase 1: Aucun chunk trouvé avec le message original');
    }
    
    // 2. RECHERCHE AVEC TOUS LES TERMES DE RECHERCHE (expansion maximale)
    console.log('[EMBEDDINGS] 🔄 Phase 2: Recherche élargie avec termes spécifiques');
    for (const term of analysis.searchTerms) {
      if (searchIterations >= 6) break; // Limite plus haute
      
      const termResults = await this.performSearch(term, relevantIds, 0.2); // Seuil encore plus bas
      searchIterations++;
      
      if (termResults.chunks.length > 0) {
        allChunks.push(...termResults.chunks);
        allSources.push(...termResults.sources);
        console.log(`[EMBEDDINGS] ✅ Phase 2: ${termResults.chunks.length} chunks trouvés pour "${term}"`);
      }
    }
    
    // 3. RECHERCHE AVEC SYNONYMES (si pas assez de résultats)
    if (allChunks.length < 8) {
      console.log('[EMBEDDINGS] 🔄 Phase 3: Recherche avec synonymes');
      for (const synonym of analysis.synonyms.slice(0, 5)) { // Plus de synonymes
        if (searchIterations >= 10) break;
        
        const synonymResults = await this.performSearch(synonym, relevantIds, 0.25);
        searchIterations++;
        
        if (synonymResults.chunks.length > 0) {
          allChunks.push(...synonymResults.chunks);
          allSources.push(...synonymResults.sources);
          console.log(`[EMBEDDINGS] ✅ Phase 3: ${synonymResults.chunks.length} chunks trouvés pour synonyme "${synonym}"`);
        }
      }
    }
    
    // 4. RECHERCHE GÉNÉRALE (si toujours pas assez)
    if (allChunks.length < 5) {
      console.log('[EMBEDDINGS] 🔄 Phase 4: Recherche générale sans filtres');
      const generalResults = await this.performSearch(message, undefined, 0.1); // Très large
      searchIterations++;
      
      if (generalResults.chunks.length > 0) {
        allChunks.push(...generalResults.chunks);
        allSources.push(...generalResults.sources);
        console.log(`[EMBEDDINGS] ✅ Phase 4: ${generalResults.chunks.length} chunks trouvés en recherche générale`);
      }
    }
    
    // 5. Nettoyage et tri
    const uniqueChunks = this.removeDuplicateChunks(allChunks);
    const sortedChunks = uniqueChunks.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
    const finalChunks = sortedChunks.slice(0, 12); // Plus de chunks
    
    // Update sources
    const finalSources = this.generateSources(finalChunks);
    
    console.log(`[EMBEDDINGS] ✅ Recherche terminée: ${searchIterations} itérations, ${finalChunks.length} chunks uniques trouvés`);
    
    // Log des résultats pour debugging
    if (finalChunks.length > 0) {
      console.log('[EMBEDDINGS] 📊 Aperçu des résultats:');
      finalChunks.slice(0, 3).forEach((chunk, i) => {
        console.log(`  ${i+1}. Similarité: ${chunk.similarity?.toFixed(3)}, Texte: "${chunk.chunk_text?.substring(0, 100)}..."`);
      });
    } else {
      console.log('[EMBEDDINGS] ❌ AUCUN RÉSULTAT TROUVÉ - cela ne devrait pas arriver');
    }
    
    return {
      chunks: finalChunks,
      sources: finalSources,
      hasRelevantContext: finalChunks.length > 0,
      searchIterations,
      finalSearchTerms: analysis.searchTerms
    };
  }

  private async performSearch(
    query: string, 
    relevantIds?: { meetingIds: string[], documentIds: string[] },
    threshold: number = 0.3
  ): Promise<{ chunks: any[], sources: any[] }> {
    try {
      console.log(`[EMBEDDINGS] 🔍 Recherche pour: "${query}" (seuil: ${threshold})`);
      
      // Generate embedding for the search
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: query,
        }),
      });

      if (!embeddingResponse.ok) {
        throw new Error(`Embedding API error: ${embeddingResponse.status}`);
      }

      const embeddingData = await embeddingResponse.json();
      const queryEmbedding = embeddingData.data[0].embedding;

      let searchResults;
      
      if (relevantIds && (relevantIds.meetingIds.length > 0 || relevantIds.documentIds.length > 0)) {
        console.log('[EMBEDDINGS] 🎯 Recherche focalisée sur IDs spécifiques');
        
        const { data: focusedResults, error } = await this.supabase.rpc('search_document_embeddings', {
          query_embedding: queryEmbedding,
          match_threshold: threshold,
          match_count: 15 // Plus de résultats
        });

        if (!error && focusedResults) {
          // Filter for relevant IDs
          searchResults = focusedResults.filter((result: any) => 
            relevantIds.meetingIds.includes(result.meeting_id) ||
            relevantIds.documentIds.includes(result.document_id)
          );
        }
      } else {
        // General search with higher count
        const { data: generalResults, error } = await this.supabase.rpc('search_document_embeddings', {
          query_embedding: queryEmbedding,
          match_threshold: threshold,
          match_count: 15 // Plus de résultats
        });

        if (!error) {
          searchResults = generalResults;
        }
      }

      if (searchResults && searchResults.length > 0) {
        console.log(`[EMBEDDINGS] ✅ ${searchResults.length} résultats trouvés pour "${query}"`);
        const sources = this.generateSources(searchResults);
        return { chunks: searchResults, sources };
      } else {
        console.log(`[EMBEDDINGS] ❌ Aucun résultat pour "${query}" (seuil: ${threshold})`);
      }

      return { chunks: [], sources: [] };

    } catch (error) {
      console.error('[EMBEDDINGS] ❌ Erreur de recherche:', error);
      return { chunks: [], sources: [] };
    }
  }

  private removeDuplicateChunks(chunks: any[]): any[] {
    const seen = new Set();
    return chunks.filter(chunk => {
      const key = `${chunk.document_id || chunk.meeting_id}-${chunk.chunk_index}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private generateSources(chunks: any[]): any[] {
    return chunks.map((result: any) => ({
      type: 'document_embedding',
      title: result.metadata?.title || result.document_type,
      similarity: result.similarity,
      chunk_index: result.chunk_index,
      source_id: result.document_id || result.meeting_id
    }));
  }

  async searchWithFallback(
    originalQuery: string,
    expandedTerms: string[],
    relevantIds?: { meetingIds: string[], documentIds: string[] }
  ): Promise<EmbeddingContext> {
    console.log('[EMBEDDINGS] 🔄 Recherche de fallback avec termes étendus');
    
    let allChunks: any[] = [];
    let searchIterations = 0;
    
    // Try expanded terms one by one with very low threshold
    for (const term of expandedTerms) {
      const result = await this.performSearch(term, relevantIds, 0.15); // Seuil très bas
      searchIterations++;
      
      if (result.chunks.length > 0) {
        allChunks.push(...result.chunks);
      }
    }
    
    const uniqueChunks = this.removeDuplicateChunks(allChunks);
    const sources = this.generateSources(uniqueChunks);
    
    return {
      chunks: uniqueChunks,
      sources: sources,
      hasRelevantContext: uniqueChunks.length > 0,
      searchIterations: searchIterations,
      finalSearchTerms: expandedTerms
    };
  }
}
