
export interface InternetContext {
  content: string;
  sources: any[];
  hasContent: boolean;
}

export class InternetAgent {
  private perplexityApiKey: string;

  constructor(perplexityApiKey: string) {
    this.perplexityApiKey = perplexityApiKey;
  }

  async searchInternet(query: string, shouldEnrich: boolean = false): Promise<InternetContext> {
    if (!this.perplexityApiKey) {
      console.log('[INTERNET] ⚠️ No Perplexity API key available');
      return { content: '', sources: [], hasContent: false };
    }

    console.log('[INTERNET] Starting internet search');
    
    try {
      const searchPrompt = shouldEnrich 
        ? `Enrichis cette information avec des données récentes et fiables concernant l'ophtalmologie : ${query}`
        : `Recherche des informations actuelles et pertinentes sur : ${query}`;

      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.perplexityApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [
            {
              role: 'system',
              content: 'Tu es un assistant spécialisé en ophtalmologie. Recherche des informations fiables et récentes.'
            },
            {
              role: 'user',
              content: searchPrompt
            }
          ],
          temperature: 0.2,
          max_tokens: 1000,
          return_images: false,
          return_related_questions: false,
          search_recency_filter: 'month'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0]?.message?.content || '';
        
        if (content) {
          console.log('[INTERNET] ✅ Search completed');
          return {
            content,
            sources: [{ type: 'internet', source: 'Perplexity AI', query }],
            hasContent: true
          };
        }
      }
      
      console.log('[INTERNET] ⚠️ No results found');
      return { content: '', sources: [], hasContent: false };
      
    } catch (error) {
      console.error('[INTERNET] ❌ Search error:', error);
      return { content: '', sources: [], hasContent: false };
    }
  }
}
