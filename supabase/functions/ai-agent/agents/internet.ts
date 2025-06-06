
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
      // Check if query is related to office equipment or products
      const isProductSearch = this.isProductRelatedQuery(query);
      const searchPrompt = this.buildSearchPrompt(query, analysis, enrichmentType, isProductSearch);

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
              content: this.getSystemPrompt(enrichmentType, isProductSearch)
            },
            {
              role: 'user',
              content: searchPrompt
            }
          ],
          temperature: 0.2,
          max_tokens: isProductSearch ? 1500 : 1200, // More tokens for detailed product searches
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
              enrichmentType,
              isProductSearch
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

  private isProductRelatedQuery(query: string): boolean {
    const productTerms = [
      'matériel', 'équipement', 'acheter', 'produit', 'galaxus', 'achat',
      'ordinateur', 'imprimante', 'chaise', 'bureau', 'écran', 'moniteur',
      'clavier', 'souris', 'téléphone', 'appareil', 'scanner', 'meuble',
      'logiciel', 'licence', 'stockage', 'disque', 'référence', 'recommandation',
      'comparaison', 'prix', 'modèle', 'marque', 'spécification'
    ];
    
    const lowerQuery = query.toLowerCase();
    return productTerms.some(term => lowerQuery.includes(term));
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

  private buildSearchPrompt(query: string, analysis: any, enrichmentType: string, isProductSearch: boolean): string {
    const allTerms = analysis.searchTerms && analysis.synonyms ? 
      [...analysis.searchTerms, ...analysis.synonyms].join(', ') : 
      query.split(' ').join(', ');
    
    if (isProductSearch) {
      return `Recherche APPROFONDIE des produits et équipements pour cabinet médical:
      
1. RECHERCHE PRINCIPALE SUR GALAXUS.CH: Trouve les meilleures références de produits sur Galaxus.ch pour: "${query}"
2. RECHERCHE COMPARATIVE: Compare avec d'autres sources suisses (Digitec, Microspot, etc.)
3. ANALYSE COMPLÈTE: Spécifications techniques détaillées, prix, disponibilité, avis utilisateurs
4. MULTIPLE SOURCES: Utilise au moins 3 sources différentes pour comparer les options
5. COORDONNÉES COMPLÈTES: Pour chaque fournisseur, trouve numéro de téléphone, email et site web
6. CONTEXTE: Équipement pour cabinet d'ophtalmologie Dr Tabibian à Genève

Ne néglige aucun détail même si la recherche prend plus de temps. Termes à considérer: ${allTerms}`;
    }
    
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

  private getSystemPrompt(enrichmentType: string, isProductSearch: boolean): string {
    if (isProductSearch) {
      return `Tu es un assistant spécialisé en recherche approfondie d'équipements et produits pour cabinets médicaux en Suisse.

INSTRUCTIONS CRITIQUES:
1. PRIORITÉ à Galaxus.ch: Trouve toujours les meilleures références produits sur Galaxus.ch
2. COMPARAISON OBLIGATOIRE avec d'autres sources (au moins 3 différentes)
3. ANALYSE DÉTAILLÉE: Spécifications complètes, prix CHF, disponibilité, avantages/inconvénients
4. PRISE DE TEMPS: Fais une recherche exhaustive même si cela prend plus de temps
5. COORDONNÉES COMPLÈTES: Pour chaque fournisseur mentionné, inclus TOUJOURS:
   - Numéro de téléphone (format +41...)
   - Email de contact
   - Site web avec URL complète
6. FORMAT: Présente l'information de manière structurée avec comparatifs clairs
7. RECOMMANDATION: Termine toujours par une recommandation claire du meilleur produit

Ton objectif: Fournir l'analyse la plus complète possible pour permettre une décision d'achat éclairée pour un cabinet d'ophtalmologie à Genève.`;
    }
    
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
