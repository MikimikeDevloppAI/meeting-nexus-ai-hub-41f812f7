
export interface InternetContext {
  content: string;
  sources: any[];
  hasContent: boolean;
  enrichmentType: 'supplement' | 'complement' | 'verification';
  contactValidation: {
    hasValidatedContacts: boolean;
    confidenceScore: number;
    foundContacts: any[];
  };
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
      return { 
        content: '', 
        sources: [], 
        hasContent: false, 
        enrichmentType: 'supplement',
        contactValidation: { hasValidatedContacts: false, confidenceScore: 0, foundContacts: [] }
      };
    }

    console.log('[INTERNET] Starting enhanced search with strict contact validation');
    
    // Déterminer le type d'enrichissement
    const enrichmentType = this.determineEnrichmentType(analysis, hasLocalContext);
    
    try {
      // Si Galaxus a déjà traité une recherche produit, éviter la duplication
      const isProductSearch = this.isProductRelatedQuery(query);
      if (isProductSearch && galaxusContext?.hasProducts) {
        console.log('[INTERNET] ⚠️ Produits déjà traités par Galaxus, recherche fournisseurs spécialisés');
      }

      const searchPrompt = this.buildEnhancedSearchPrompt(query, analysis, enrichmentType, isProductSearch);

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
              content: this.getStrictValidationSystemPrompt(enrichmentType, isProductSearch)
            },
            {
              role: 'user',
              content: searchPrompt
            }
          ],
          temperature: 0.1,
          max_tokens: 2000,
          return_images: false,
          return_related_questions: false,
          return_citations: true,
          search_recency_filter: 'month'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0]?.message?.content || '';
        
        if (content) {
          console.log('[INTERNET] ✅ Enhanced search completed with validation');
          
          // Validation stricte des coordonnées
          const contactValidation = this.validateContactInformation(content);
          
          return {
            content: this.sanitizeContent(content),
            sources: [{ 
              type: 'internet', 
              source: 'Perplexity AI', 
              query,
              enrichmentType,
              isProductSearch: isProductSearch && !galaxusContext?.hasProducts,
              validation: contactValidation
            }],
            hasContent: true,
            enrichmentType,
            contactValidation
          };
        }
      }
      
      console.log('[INTERNET] ⚠️ No validated results found');
      return { 
        content: '', 
        sources: [], 
        hasContent: false, 
        enrichmentType: 'supplement',
        contactValidation: { hasValidatedContacts: false, confidenceScore: 0, foundContacts: [] }
      };
      
    } catch (error) {
      console.error('[INTERNET] ❌ Search error:', error);
      return { 
        content: '', 
        sources: [], 
        hasContent: false, 
        enrichmentType: 'supplement',
        contactValidation: { hasValidatedContacts: false, confidenceScore: 0, foundContacts: [] }
      };
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
      return 'complement';
    }
    
    if (analysis.queryType === 'general' || analysis.requiresInternet) {
      return 'supplement';
    }
    
    return 'verification';
  }

  private buildEnhancedSearchPrompt(query: string, analysis: any, enrichmentType: string, isProductSearch: boolean): string {
    const allTerms = analysis.searchTerms && analysis.synonyms ? 
      [...analysis.searchTerms, ...analysis.synonyms].join(', ') : 
      query.split(' ').join(', ');
    
    if (isProductSearch) {
      return `RECHERCHE FOURNISSEURS SPÉCIALISÉS AVEC VALIDATION STRICTE:

🎯 RECHERCHE: ${query}

📋 INSTRUCTIONS VALIDATION STRICTE:
1. Trouver fournisseurs spécialisés médicaux/techniques Suisse/Europe
2. COORDONNÉES: Inclure SEULEMENT si trouvées sur sites officiels:
   - Téléphone: Format international +41... ou +33... (vérifiés)
   - Email: contact@, info@, sales@ (vérifiés sur site officiel)
   - Site web: URL complète format [nom](https://url)
3. VALIDATION: Chaque coordonnée doit provenir d'une source identifiable
4. PRIX: Montants CHF/EUR uniquement si trouvés sur sites
5. NE PAS inventer d'informations manquantes

6. FOCUS FOURNISSEURS:
   - Distributeurs médicaux suisses
   - Fournisseurs techniques spécialisés
   - Grossistes équipements médicaux

TERMES: ${allTerms}

INTERDICTION ABSOLUE: Inventer téléphones, emails ou coordonnées`;
    }
    
    switch (enrichmentType) {
      case 'complement':
        return `RECHERCHE INFORMATIONS AVEC VALIDATION COORDONNÉES:

Recherche: ${query}
Instructions strictes:
- Coordonnées SEULEMENT si trouvées et vérifiables sur sources officielles
- Téléphones: Format +41... uniquement si sur site officiel
- Emails: contact@ uniquement si vérifiés
- Sites web: URLs complètes format [nom](https://url)
- NE JAMAIS inventer d'informations manquantes

Termes: ${allTerms}`;
        
      case 'supplement':
        return `ENRICHISSEMENT INFORMATIONS OPHTALMOLOGIE:

Recherche: ${query}
Focus: Informations récentes, développements actuels
Coordonnées: SEULEMENT si trouvées et pertinentes
Liens: Format markdown cliquable obligatoire
NE PAS inventer d'informations manquantes`;
        
      case 'verification':
        return `VÉRIFICATION INFORMATIONS MÉDICALES:

Recherche: ${query}
Objectif: Actualiser informations existantes
Validation: Coordonnées SEULEMENT si trouvées
NE PAS mentionner coordonnées inexistantes`;
        
      default:
        return `Recherche: ${query}. Format markdown pour liens. Coordonnées SEULEMENT si trouvées.`;
    }
  }

  private getStrictValidationSystemPrompt(enrichmentType: string, isProductSearch: boolean): string {
    const baseRules = `RÈGLES STRICTES VALIDATION:
1. COORDONNÉES: Inclure UNIQUEMENT si trouvées sur sources officielles
2. TÉLÉPHONES: Format +41/+33... SEULEMENT si vérifiés
3. EMAILS: contact@/info@ SEULEMENT si sur sites officiels  
4. SITES WEB: URLs complètes format [nom](https://url)
5. INTERDICTION ABSOLUE: Inventer coordonnées manquantes
6. SI PAS TROUVÉ: Ne pas mentionner l'information`;

    if (isProductSearch) {
      return `Expert recherche fournisseurs médicaux/techniques avec validation stricte.

${baseRules}

FOCUS SPÉCIALISÉ:
- Fournisseurs médicaux suisses/européens
- Distributeurs équipements techniques
- Validation coordonnées sur sites officiels
- Comparaisons prix CHF/EUR si disponibles

OBJECTIF: Informations fiables pour professionnels médicaux.`;
    }
    
    const basePrompt = 'Assistant spécialisé ophtalmologie avec validation stricte informations. ';
    
    switch (enrichmentType) {
      case 'complement':
        return basePrompt + `${baseRules}
MISSION: Compléter informations manquantes avec sources vérifiables.`;
        
      case 'supplement':
        return basePrompt + `${baseRules}
MISSION: Enrichir avec informations récentes validées.`;
        
      case 'verification':
        return basePrompt + `${baseRules}
MISSION: Vérifier et actualiser informations existantes.`;
        
      default:
        return basePrompt + baseRules;
    }
  }

  private validateContactInformation(content: string): any {
    const validation = {
      hasValidatedContacts: false,
      confidenceScore: 0,
      foundContacts: [] as any[]
    };

    // Recherche de téléphones avec validation
    const phoneRegex = /(\+\d{1,3}[\s\-]?\d{1,3}[\s\-]?\d{3,4}[\s\-]?\d{3,4})/g;
    const phones = [...content.matchAll(phoneRegex)];
    
    // Recherche d'emails avec validation
    const emailRegex = /(contact@|info@|sales@|support@)[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,}/g;
    const emails = [...content.matchAll(emailRegex)];
    
    // Recherche de sites web avec validation
    const websiteRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
    const websites = [...content.matchAll(websiteRegex)];

    // Calcul du score de confiance
    let score = 0;
    if (phones.length > 0) score += 30;
    if (emails.length > 0) score += 25;
    if (websites.length > 0) score += 45;
    
    // Validation contextuelle
    const hasCompanyContext = /entreprise|société|cabinet|clinique|fournisseur/i.test(content);
    if (hasCompanyContext) score += 20;
    
    validation.confidenceScore = Math.min(score, 100);
    validation.hasValidatedContacts = score >= 50;
    
    validation.foundContacts = [
      ...phones.map(p => ({ type: 'phone', value: p[1], validated: true })),
      ...emails.map(e => ({ type: 'email', value: e[0], validated: true })),
      ...websites.map(w => ({ type: 'website', name: w[1], url: w[2], validated: true }))
    ];

    return validation;
  }

  private sanitizeContent(content: string): string {
    // Suppression des coordonnées non validées
    let sanitized = content;
    
    // Supprimer les numéros de téléphone non formatés
    sanitized = sanitized.replace(/(?<!\+)\b\d{10,}\b/g, '');
    
    // Supprimer les emails génériques non vérifiés
    sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@(?!contact|info|sales|support)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '');
    
    return sanitized.trim();
  }
}
