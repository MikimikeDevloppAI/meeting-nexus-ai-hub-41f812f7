
export interface GalaxusContext {
  products: any[];
  hasProducts: boolean;
  searchQuery: string;
  recommendations: string;
}

export class GalaxusAgent {
  private perplexityApiKey: string;

  constructor(perplexityApiKey: string) {
    this.perplexityApiKey = perplexityApiKey;
  }

  async searchProducts(query: string, analysis: any): Promise<GalaxusContext> {
    if (!this.perplexityApiKey) {
      console.log('[GALAXUS] ⚠️ No Perplexity API key available');
      return { products: [], hasProducts: false, searchQuery: query, recommendations: '' };
    }

    // Détection si c'est une recherche de produit
    if (!this.isProductQuery(query)) {
      return { products: [], hasProducts: false, searchQuery: query, recommendations: '' };
    }

    console.log('[GALAXUS] 🛒 Recherche produits spécialisée');

    try {
      const searchPrompt = this.buildGalaxusSearchPrompt(query, analysis);

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
              content: this.getGalaxusSystemPrompt()
            },
            {
              role: 'user',
              content: searchPrompt
            }
          ],
          temperature: 0.2,
          max_tokens: 2000,
          search_recency_filter: 'month',
          search_domain_filter: ['galaxus.ch', 'digitec.ch', 'microspot.ch', 'brack.ch']
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0]?.message?.content || '';
        
        if (content) {
          console.log('[GALAXUS] ✅ Produits trouvés');
          return {
            products: this.extractProductInfo(content),
            hasProducts: true,
            searchQuery: query,
            recommendations: content
          };
        }
      }
      
      console.log('[GALAXUS] ⚠️ Aucun produit trouvé');
      return { products: [], hasProducts: false, searchQuery: query, recommendations: '' };
      
    } catch (error) {
      console.error('[GALAXUS] ❌ Erreur recherche:', error);
      return { products: [], hasProducts: false, searchQuery: query, recommendations: '' };
    }
  }

  private isProductQuery(query: string): boolean {
    const productTerms = [
      'matériel', 'équipement', 'acheter', 'produit', 'achat',
      'ordinateur', 'imprimante', 'chaise', 'bureau', 'écran', 'moniteur',
      'clavier', 'souris', 'téléphone', 'appareil', 'scanner', 'meuble',
      'logiciel', 'licence', 'stockage', 'disque', 'référence', 'recommandation',
      'comparaison', 'prix', 'modèle', 'marque', 'spécification',
      'tablet', 'tablette', 'smartphone', 'casque', 'enceinte', 'caméra',
      'projecteur', 'serveur', 'routeur', 'switch', 'wifi', 'réseau'
    ];
    
    const lowerQuery = query.toLowerCase();
    return productTerms.some(term => lowerQuery.includes(term));
  }

  private buildGalaxusSearchPrompt(query: string, analysis: any): string {
    const allTerms = analysis.searchTerms && analysis.synonyms ? 
      [...analysis.searchTerms, ...analysis.synonyms].join(', ') : 
      query.split(' ').join(', ');
    
    return `RECHERCHE SPÉCIALISÉE PRODUITS SUISSES pour cabinet médical:

🎯 DEMANDE: "${query}"

📋 INSTRUCTIONS PRÉCISES:
1. FOCUS PRINCIPAL: Rechercher sur Galaxus.ch les meilleures options
2. COMPLÉTER avec: Digitec.ch, Microspot.ch, Brack.ch
3. FOURNIR pour chaque produit trouvé:
   - Nom exact du produit
   - Prix en CHF
   - Lien direct cliquable vers la page produit
   - Spécifications techniques principales
   - Avis/notes utilisateurs si disponibles

4. COMPARER minimum 3 options différentes
5. RECOMMANDATION finale claire avec le meilleur rapport qualité/prix

6. FORMAT REQUIS pour les liens:
   - Utiliser la syntaxe markdown: [Nom du produit](URL_directe)
   - URLs complètes et fonctionnelles

Termes à considérer: ${allTerms}

CONTEXTE: Équipement pour cabinet d'ophtalmologie professionnel à Genève`;
  }

  private getGalaxusSystemPrompt(): string {
    return `Tu es un expert en recherche de produits pour cabinets médicaux suisses.

MISSION SPÉCIALISÉE GALAXUS:
- Rechercher PRIORITAIREMENT sur Galaxus.ch
- Compléter avec autres sources suisses fiables
- Fournir OBLIGATOIREMENT des liens directs cliquables
- Comparer prix et spécifications
- Recommander le meilleur choix

RÈGLES STRICTES:
1. TOUS les liens doivent être au format markdown [nom](url)
2. URLs complètes et fonctionnelles uniquement
3. Prix en CHF obligatoire
4. Minimum 3 options à comparer
5. Recommandation finale claire
6. Spécifications techniques détaillées

INTERDICTIONS:
- Pas de coordonnées de contact pour Galaxus/Digitec
- Pas de mentions inutiles des plateformes
- Focus uniquement sur les produits et leurs caractéristiques

OBJECTIF: Fournir une analyse complète permettant un achat éclairé.`;
  }

  private extractProductInfo(content: string): any[] {
    // Extraction basique des informations produits du contenu
    // Cette fonction pourrait être améliorée avec des regex plus sophistiquées
    const products = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.includes('CHF') && (line.includes('[') || line.includes('http'))) {
        products.push({
          description: line.trim(),
          hasLink: line.includes('[') && line.includes(']('),
          hasPrice: line.includes('CHF')
        });
      }
    }
    
    return products;
  }
}
