
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
    console.log('[EMBEDDINGS] Starting enhanced semantic search with iterative capabilities');
    
    let searchIterations = 0;
    let allChunks: any[] = [];
    let allSources: any[] = [];
    
    // Initial search with original message
    let searchResults = await this.performSearch(message, relevantIds);
    searchIterations++;
    
    if (searchResults.chunks.length > 0) {
      allChunks.push(...searchResults.chunks);
      allSources.push(...searchResults.sources);
    }
    
    // If iterative search is enabled and we need more results
    if (analysis.iterativeSearch && searchResults.chunks.length < 3) {
      console.log('[EMBEDDINGS] 🔄 Performing iterative search with expanded terms');
      
      // Search with all search terms
      for (const term of analysis.searchTerms) {
        if (searchIterations >= 3) break; // Limit iterations
        
        const termResults = await this.performSearch(term, relevantIds, 0.4); // Lower threshold
        searchIterations++;
        
        if (termResults.chunks.length > 0) {
          allChunks.push(...termResults.chunks);
          allSources.push(...termResults.sources);
        }
      }
      
      // Search with synonyms if still not enough results
      if (allChunks.length < 5 && analysis.synonyms.length > 0) {
        for (const synonym of analysis.synonyms.slice(0, 3)) {
          if (searchIterations >= 5) break;
          
          const synonymResults = await this.performSearch(synonym, relevantIds, 0.3);
          searchIterations++;
          
          if (synonymResults.chunks.length > 0) {
            allChunks.push(...synonymResults.chunks);
            allSources.push(...synonymResults.sources);
          }
        }
      }
    }
    
    // Remove duplicates and sort by similarity
    const uniqueChunks = this.removeDuplicateChunks(allChunks);
    const sortedChunks = uniqueChunks.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
    const finalChunks = sortedChunks.slice(0, 8); // Top 8 results
    
    // Update sources
    const finalSources = this.generateSources(finalChunks);
    
    console.log(`[EMBEDDINGS] ✅ Completed search with ${searchIterations} iterations, found ${finalChunks.length} unique chunks`);
    
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
    threshold: number = 0.5
  ): Promise<{ chunks: any[], sources: any[] }> {
    try {
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
      
      if (relevantIds && relevantIds.meetingIds.length > 0) {
        console.log('[EMBEDDINGS] 🎯 Focused search on specific meetings/documents');
        
        const { data: focusedResults, error } = await this.supabase.rpc('search_document_embeddings', {
          query_embedding: queryEmbedding,
          match_threshold: threshold,
          match_count: 10
        });

        if (!error && focusedResults) {
          // Filter for relevant IDs
          searchResults = focusedResults.filter((result: any) => 
            relevantIds.meetingIds.includes(result.meeting_id) ||
            relevantIds.documentIds.includes(result.document_id)
          );
        }
      } else {
        // General search
        const { data: generalResults, error } = await this.supabase.rpc('search_document_embeddings', {
          query_embedding: queryEmbedding,
          match_threshold: threshold,
          match_count: 8
        });

        if (!error) {
          searchResults = generalResults;
        }
      }

      if (searchResults && searchResults.length > 0) {
        const sources = this.generateSources(searchResults);
        return { chunks: searchResults, sources };
      }

      return { chunks: [], sources: [] };

    } catch (error) {
      console.error('[EMBEDDINGS] ❌ Search error:', error);
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
    console.log('[EMBEDDINGS] 🔄 Fallback search with expanded terms');
    
    // Try expanded terms one by one
    for (const term of expandedTerms) {
      const result = await this.performSearch(term, relevantIds, 0.4);
      if (result.chunks.length > 0) {
        return {
          chunks: result.chunks,
          sources: result.sources,
          hasRelevantContext: true,
          searchIterations: 1,
          finalSearchTerms: [term]
        };
      }
    }
    
    return {
      chunks: [],
      sources: [],
      hasRelevantContext: false,
      searchIterations: expandedTerms.length,
      finalSearchTerms: expandedTerms
    };
  }
}
