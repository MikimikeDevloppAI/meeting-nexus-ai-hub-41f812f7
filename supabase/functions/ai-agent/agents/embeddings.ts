
export interface EmbeddingContext {
  chunks: any[];
  sources: any[];
  hasRelevantContext: boolean;
}

export class EmbeddingsAgent {
  private openaiApiKey: string;
  private supabase: any;

  constructor(openaiApiKey: string, supabase: any) {
    this.openaiApiKey = openaiApiKey;
    this.supabase = supabase;
  }

  async searchEmbeddings(message: string, relevantIds?: { meetingIds: string[], documentIds: string[] }): Promise<EmbeddingContext> {
    console.log('[EMBEDDINGS] Starting semantic search');
    
    try {
      // Générer l'embedding pour la recherche
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: message,
        }),
      });

      if (!embeddingResponse.ok) {
        throw new Error(`Embedding API error: ${embeddingResponse.status}`);
      }

      const embeddingData = await embeddingResponse.json();
      const queryEmbedding = embeddingData.data[0].embedding;
      console.log(`[EMBEDDINGS] ✅ Embedding generated (${queryEmbedding.length} dimensions)`);

      // Recherche dans les embeddings avec filtrage si des IDs spécifiques sont fournis
      let searchResults;
      
      if (relevantIds && relevantIds.meetingIds.length > 0) {
        console.log('[EMBEDDINGS] 🎯 Focused search on specific meetings');
        // Recherche focalisée sur les réunions spécifiques
        const { data: focusedResults, error } = await this.supabase.rpc('search_document_embeddings', {
          query_embedding: queryEmbedding,
          match_threshold: 0.4,
          match_count: 8
        });

        if (!error && focusedResults) {
          // Filtrer pour ne garder que les chunks des réunions pertinentes
          searchResults = focusedResults.filter((result: any) => 
            relevantIds.meetingIds.includes(result.meeting_id)
          );
        }
      } else {
        // Recherche générale
        const { data: generalResults, error } = await this.supabase.rpc('search_document_embeddings', {
          query_embedding: queryEmbedding,
          match_threshold: 0.5,
          match_count: 5
        });

        if (!error) {
          searchResults = generalResults;
        }
      }

      if (searchResults && searchResults.length > 0) {
        console.log(`[EMBEDDINGS] ✅ Found ${searchResults.length} relevant chunks`);
        
        const sources = searchResults.map((result: any) => ({
          type: 'document_embedding',
          title: result.metadata?.title || result.document_type,
          similarity: result.similarity,
          chunk_index: result.chunk_index
        }));

        return {
          chunks: searchResults,
          sources,
          hasRelevantContext: true
        };
      } else {
        console.log('[EMBEDDINGS] ⚠️ No relevant chunks found');
        return {
          chunks: [],
          sources: [],
          hasRelevantContext: false
        };
      }

    } catch (error) {
      console.error('[EMBEDDINGS] ❌ Search error:', error);
      return {
        chunks: [],
        sources: [],
        hasRelevantContext: false
      };
    }
  }
}
