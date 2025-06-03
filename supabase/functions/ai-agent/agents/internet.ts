
export interface InternetContext {
  content: string;
  sources: any[];
  hasContent: boolean;
  enrichmentType: 'supplement' | 'complement' | 'verification';
}

export class InternetAgent {
  private perplexityApiKey: string;

  constructor(perplexityApiKey: string) {
    this.perplexityApiKey = perplexityApiKey;
  }

  async searchInternet(
    query: string, 
    analysis: any,
    hasLocalContext: boolean = false
  ): Promise<InternetContext> {
    if (!this.perplexityApiKey) {
      console.log('[INTERNET] ⚠️ No Perplexity API key available');
      return { content: '', sources: [], hasContent: false, enrichmentType: 'supplement' };
    }

    console.log('[INTERNET] Starting enhanced internet search');
    
    // Determine enrichment strategy
    const enrichmentType = this.determineEnrichmentType(analysis, hasLocalContext);
    
    try {
      const searchPrompt = this.buildSearchPrompt(query, analysis, enrichmentType);

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
              content: this.getSystemPrompt(enrichmentType)
            },
            {
              role: 'user',
              content: searchPrompt
            }
          ],
          temperature: 0.2,
          max_tokens: 1200,
          return_images: false,
          return_related_questions: false,
          search_recency_filter: 'month'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0]?.message?.content || '';
        
        if (content) {
          console.log('[INTERNET] ✅ Enhanced search completed');
          return {
            content,
            sources: [{ 
              type: 'internet', 
              source: 'Perplexity AI', 
              query,
              enrichmentType 
            }],
            hasContent: true,
            enrichmentType
          };
        }
      }
      
      console.log('[INTERNET] ⚠️ No results found');
      return { content: '', sources: [], hasContent: false, enrichmentType: 'supplement' };
      
    } catch (error) {
      console.error('[INTERNET] ❌ Search error:', error);
      return { content: '', sources: [], hasContent: false, enrichmentType: 'supplement' };
    }
  }

  private determineEnrichmentType(analysis: any, hasLocalContext: boolean): 'supplement' | 'complement' | 'verification' {
    if (!hasLocalContext) {
      return 'complement'; // Complete the missing information
    }
    
    if (analysis.queryType === 'general' || analysis.requiresInternet) {
      return 'supplement'; // Add recent information
    }
    
    return 'verification'; // Verify and update existing information
  }

  private buildSearchPrompt(query: string, analysis: any, enrichmentType: string): string {
    const allTerms = [...analysis.searchTerms, ...analysis.synonyms].join(', ');
    
    switch (enrichmentType) {
      case 'complement':
        return `Recherche des informations complètes et actuelles sur : ${query}. Termes connexes : ${allTerms}`;
        
      case 'supplement':
        return `Enrichis avec des informations récentes et des développements actuels concernant : ${query}. Focus ophtalmologie.`;
        
      case 'verification':
        return `Vérifie et actualise les informations concernant : ${query} dans le contexte de l'ophtalmologie moderne.`;
        
      default:
        return `Recherche des informations actuelles et pertinentes sur : ${query}`;
    }
  }

  private getSystemPrompt(enrichmentType: string): string {
    const basePrompt = 'Tu es un assistant spécialisé en ophtalmologie. ';
    
    switch (enrichmentType) {
      case 'complement':
        return basePrompt + 'Fournis des informations complètes et détaillées pour combler les lacunes d\'information.';
        
      case 'supplement':
        return basePrompt + 'Enrichis les connaissances existantes avec des informations récentes et des développements actuels.';
        
      case 'verification':
        return basePrompt + 'Vérifie et actualise les informations, en signalant tout changement ou développement récent.';
        
      default:
        return basePrompt + 'Recherche des informations fiables et récentes.';
    }
  }
}
