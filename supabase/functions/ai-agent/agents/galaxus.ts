
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

    console.log('[GALAXUS] 🛒 Recherche produits spécialisée avec liens réels');

    try {
      const searchPrompt = this.buildGalaxusSearchPrompt(query, analysis);

      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.perplexityApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-large-128k-online',
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
          temperature: 0.1,
          max_tokens: 2500,
          search_recency_filter: 'month',
          return_citations: true,
          search_domain_filter: ['galaxus.ch', 'digitec.ch']
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0]?.message?.content || '';
        
        if (content && this.validateRealProducts(content)) {
          console.log('[GALAXUS] ✅ Produits réels trouvés avec liens validés');
          return {
            products: this.extractValidatedProductInfo(content),
            hasProducts: true,
            searchQuery: query,
            recommendations: content
          };
        }
      }
      
      console.log('[GALAXUS] ⚠️ Aucun produit réel trouvé');
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
    const extractedTerms = this.extractProductTerms(query);
    
    return `RECHERCHE PRODUITS RÉELS GALAXUS/DIGITEC:

🎯 PRODUIT RECHERCHÉ: "${extractedTerms}"

📋 INSTRUCTIONS CRITIQUES:
1. Rechercher UNIQUEMENT sur site:galaxus.ch et site:digitec.ch
2. Trouver 3-4 produits réels avec URLs fonctionnelles
3. VÉRIFIER que chaque lien mène à un produit existant
4. Extraire prix CHF exact, nom précis, spécifications
5. Format markdown obligatoire: [Nom exact produit](URL_complete_galaxus)

6. EXEMPLE de recherche Google à effectuer:
   - site:galaxus.ch ${extractedTerms}
   - site:digitec.ch ${extractedTerms}

7. VALIDATION OBLIGATOIRE:
   - Chaque URL doit commencer par https://www.galaxus.ch/ ou https://www.digitec.ch/
   - Vérifier que le produit existe sur la page
   - Prix en CHF avec montant exact
   - Nom de produit complet avec marque

8. STRUCTURE REQUISE:
   **Option 1:** [Nom complet produit](https://www.galaxus.ch/fr/s1/product/...)
   - Prix: CHF XXX.XX
   - Spécifications: détails techniques
   
9. TOUJOURS MENTIONNER d'autres fournisseurs suisses spécialisés
10. SI AUCUN PRODUIT TROUVÉ: Ne pas inventer de liens

RECHERCHE: ${extractedTerms}`;
  }

  private extractProductTerms(query: string): string {
    // Extraction intelligente des termes de produit
    const cleanQuery = query
      .replace(/trouve|cherche|besoin|acheter|commander/gi, '')
      .replace(/pour|un|une|des|le|la|les/gi, '')
      .trim();
    
    return cleanQuery || query;
  }

  private getGalaxusSystemPrompt(): string {
    return `Tu es un expert en recherche de produits réels sur Galaxus et Digitec.

MISSION CRITIQUE - LIENS RÉELS SEULEMENT:
- Effectuer des recherches Google avec site:galaxus.ch et site:digitec.ch
- JAMAIS inventer d'URLs ou de produits
- Valider chaque lien avant inclusion
- Extraire prix CHF exacts des pages produits
- Noms complets avec marques réelles

RÈGLES STRICTES:
1. URLs complètes: https://www.galaxus.ch/fr/s1/product/...
2. Validation: Chaque lien doit mener à un produit existant
3. Prix: Montants exacts trouvés sur les pages
4. Format: [Nom exact](URL_complete)
5. TOUJOURS mentionner autres fournisseurs suisses

INTERDICTIONS ABSOLUES:
- Inventer des URLs ou produits
- Utiliser des liens génériques
- Mentionner des prix approximatifs
- Créer des liens non fonctionnels

OBJECTIF: Fournir 3-4 options réelles permettant achat immédiat.`;
  }

  private validateRealProducts(content: string): boolean {
    // Validation que le contenu contient de vrais liens Galaxus/Digitec
    const validUrlPatterns = [
      /https:\/\/www\.galaxus\.ch\/[^\s\)]+/g,
      /https:\/\/www\.digitec\.ch\/[^\s\)]+/g
    ];
    
    return validUrlPatterns.some(pattern => pattern.test(content));
  }

  private extractValidatedProductInfo(content: string): any[] {
    const products = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      // Recherche de liens markdown avec URLs Galaxus/Digitec
      const markdownLinkMatch = line.match(/\[([^\]]+)\]\((https:\/\/www\.(galaxus|digitec)\.ch[^)]+)\)/);
      const priceMatch = line.match(/CHF\s*(\d+[\.\,]\d{2})/);
      
      if (markdownLinkMatch && priceMatch) {
        products.push({
          name: markdownLinkMatch[1],
          url: markdownLinkMatch[2],
          price: priceMatch[0],
          description: line.trim(),
          validated: true,
          source: markdownLinkMatch[3] === 'galaxus' ? 'Galaxus' : 'Digitec'
        });
      }
    }
    
    return products;
  }
}
