
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
    hasLocalContext: boolean = false,
    galaxusContext?: any
  ): Promise<InternetContext> {
    if (!this.perplexityApiKey) {
      console.log('[INTERNET] ⚠️ No Perplexity API key available');
      return { content: '', sources: [], hasContent: false, enrichmentType: 'supplement' };
    }

    console.log('[INTERNET] Starting enhanced internet search');
    
    // Déterminer le type d'enrichissement
    const enrichmentType = this.determineEnrichmentType(analysis, hasLocalContext);
    
    try {
      // Si Galaxus a déjà traité une recherche produit, éviter la duplication
      const isProductSearch = this.isProductRelatedQuery(query);
      if (isProductSearch && galaxusContext?.hasProducts) {
        console.log('[INTERNET] ⚠️ Produits déjà traités par Galaxus, recherche générale');
        // Continue avec recherche non-produit
      }

      const searchPrompt = this.buildSearchPrompt(query, analysis, enrichmentType, isProductSearch && !galaxusContext?.hasProducts);

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
              content: this.getSystemPrompt(enrichmentType, isProductSearch && !galaxusContext?.hasProducts)
            },
            {
              role: 'user',
              content: searchPrompt
            }
          ],
          temperature: 0.2,
          max_tokens: isProductSearch ? 1500 : 1200,
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
              isProductSearch: isProductSearch && !galaxusContext?.hasProducts
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
      return `Recherche COMPLÉMENTAIRE d'équipements et fournisseurs pour cabinet médical:
      
1. FOCUS: Fournisseurs spécialisés médicaux (pas Galaxus/Digitec déjà traités)
2. RECHERCHE: Distributeurs médicaux suisses, européens
3. COORDONNÉES COMPLÈTES: UNIQUEMENT si trouvées et pertinentes:
   - Numéro de téléphone international (+41...)
   - Email de contact précis (contact@...)
   - Site web sous forme de lien cliquable [nom](url)
4. ANALYSE: Spécifications techniques, prix, disponibilité
5. CONTEXTE: Équipement pour cabinet d'ophtalmologie Genève

IMPORTANT: Ne fournir les coordonnées QUE si elles sont trouvées et vérifiables.
Termes à considérer: ${allTerms}`;
    }
    
    switch (enrichmentType) {
      case 'complement':
        return `Recherche des informations complètes et actuelles sur : ${query}. 
        IMPORTANT: Fournir les coordonnées de contact UNIQUEMENT si elles sont trouvées et pertinentes.
        Utiliser des liens cliquables format [nom](url). Termes connexes : ${allTerms}`;
        
      case 'supplement':
        return `Enrichis avec des informations récentes et des développements actuels concernant : ${query}. 
        Focus ophtalmologie. Liens cliquables obligatoires. Coordonnées SEULEMENT si trouvées.`;
        
      case 'verification':
        return `Vérifie et actualise les informations concernant : ${query} dans le contexte de l'ophtalmologie moderne.
        Liens cliquables. Coordonnées SEULEMENT si nécessaires et trouvées.`;
        
      default:
        return `Recherche des informations actuelles et pertinentes sur : ${query}. 
        Liens format [nom](url). Coordonnées SEULEMENT si pertinentes et trouvées.`;
    }
  }

  private getSystemPrompt(enrichmentType: string, isProductSearch: boolean): string {
    if (isProductSearch) {
      return `Tu es un assistant spécialisé en recherche d'équipements médicaux et fournisseurs spécialisés.

INSTRUCTIONS CRITIQUES:
1. FOCUS sur fournisseurs médicaux spécialisés (pas les plateformes généralistes)
2. COORDONNÉES: Inclure UNIQUEMENT si trouvées et vérifiables:
   - Numéro de téléphone (format +41...)
   - Email de contact
   - Site web avec URL complète au format [nom](url)
3. LIENS CLIQUABLES OBLIGATOIRES: Toujours format markdown [nom](url)
4. ANALYSE DÉTAILLÉE: Spécifications, prix CHF si disponible, avantages
5. PAS de mentions inutiles des plateformes
6. RECOMMANDATION: Conclure par le meilleur choix

INTERDICTIONS:
- Ne pas inventer de coordonnées
- Ne pas mentionner OphtaCare comme fournisseur
- Ne pas répéter les infos déjà traitées par Galaxus

Objectif: Compléter l'analyse avec des sources spécialisées médicales.`;
    }
    
    const basePrompt = 'Tu es un assistant spécialisé en ophtalmologie. ';
    
    switch (enrichmentType) {
      case 'complement':
        return basePrompt + 'Fournis des informations complètes. LIENS CLIQUABLES format [nom](url). Coordonnées SEULEMENT si trouvées et pertinentes.';
        
      case 'supplement':
        return basePrompt + 'Enrichis avec des informations récentes. LIENS CLIQUABLES obligatoires. Coordonnées SEULEMENT si nécessaires.';
        
      case 'verification':
        return basePrompt + 'Vérifie et actualise les informations. LIENS CLIQUABLES. Coordonnées SEULEMENT si trouvées.';
        
      default:
        return basePrompt + 'Recherche des informations fiables et récentes. LIENS CLIQUABLES format [nom](url).';
    }
  }
}
