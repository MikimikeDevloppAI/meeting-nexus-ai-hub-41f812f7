
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

// Simple inline agent implementations for this function
interface QueryAnalysis {
  requiresDatabase: boolean;
  requiresEmbeddings: boolean;
  requiresInternet: boolean;
  queryType: string;
  searchTerms: string[];
  synonyms: string[];
  priority: string;
}

interface DatabaseContext {
  meetings: any[];
  documents: any[];
  todos: any[];
  relevantIds: any;
}

interface EmbeddingContext {
  chunks: any[];
  hasRelevantContext: boolean;
}

interface InternetContext {
  content: string;
  hasContent: boolean;
  enrichmentType: string;
}

// Simple coordinator agent
class CoordinatorAgent {
  private openaiApiKey: string;

  constructor(openaiApiKey: string) {
    this.openaiApiKey = openaiApiKey;
  }

  async analyzeQuery(query: string, history: any[]): Promise<QueryAnalysis> {
    return {
      requiresDatabase: true,
      requiresEmbeddings: true,
      requiresInternet: true,
      queryType: 'task',
      searchTerms: query.split(' '),
      synonyms: [],
      priority: 'embeddings'
    };
  }
}

// Simple database agent
class DatabaseAgent {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  async searchContext(analysis: QueryAnalysis): Promise<DatabaseContext> {
    return {
      meetings: [],
      documents: [],
      todos: [],
      relevantIds: { meetingIds: [], documentIds: [], todoIds: [] }
    };
  }
}

// Simple embeddings agent
class EmbeddingsAgent {
  private openaiApiKey: string;
  private supabase: any;

  constructor(openaiApiKey: string, supabase: any) {
    this.openaiApiKey = openaiApiKey;
    this.supabase = supabase;
  }

  async searchEmbeddings(query: string, analysis: QueryAnalysis, relevantIds: any): Promise<EmbeddingContext> {
    return {
      chunks: [],
      hasRelevantContext: false
    };
  }
}

// Enhanced internet agent with specific provider search
class InternetAgent {
  private perplexityApiKey: string;

  constructor(perplexityApiKey: string) {
    this.perplexityApiKey = perplexityApiKey;
  }

  async searchInternet(query: string, analysis: QueryAnalysis, hasLocalContext: boolean): Promise<InternetContext> {
    if (!this.perplexityApiKey) {
      return { content: '', hasContent: false, enrichmentType: 'supplement' };
    }

    try {
      // Enhanced search with specific provider focus
      const enhancedQuery = this.buildEnhancedQuery(query);
      
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
              content: 'Tu es un assistant spécialisé pour cabinet médical suisse. Recherche des informations spécifiques sur les fournisseurs, prix, et procédures en Suisse, particulièrement à Genève.'
            },
            {
              role: 'user',
              content: enhancedQuery
            }
          ],
          temperature: 0.2,
          max_tokens: 1200,
          search_recency_filter: 'month'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0]?.message?.content || '';
        return {
          content,
          hasContent: !!content,
          enrichmentType: 'supplement'
        };
      }
    } catch (error) {
      console.error('[INTERNET] Search error:', error);
    }

    return { content: '', hasContent: false, enrichmentType: 'supplement' };
  }

  private buildEnhancedQuery(query: string): string {
    // Detect specific scenarios and enhance query accordingly
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('email') || lowerQuery.includes('mail')) {
      if (lowerQuery.includes('infomaniak') || lowerQuery.includes('sécurité')) {
        return `Infomaniak règles sécurité email configuration SMTP cabinet médical Suisse: ${query}`;
      }
      return `Configuration email professionnel cabinet médical Suisse fournisseurs recommandés: ${query}`;
    }
    
    if (lowerQuery.includes('matériel') || lowerQuery.includes('équipement')) {
      return `Fournisseurs matériel médical ophtalmologie Genève Suisse prix: ${query}`;
    }
    
    if (lowerQuery.includes('site') || lowerQuery.includes('web')) {
      return `Développeurs sites web cabinet médical Genève Suisse prix: ${query}`;
    }
    
    if (lowerQuery.includes('formation')) {
      return `Formation médicale ophtalmologie Suisse organismes certifiés: ${query}`;
    }
    
    if (lowerQuery.includes('service') || lowerQuery.includes('maintenance')) {
      return `Services maintenance technique cabinet médical Genève prestataires: ${query}`;
    }
    
    // General enhancement for Swiss medical practice context
    return `Cabinet médical ophtalmologie Genève Suisse fournisseurs prestataires: ${query}`;
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { task, transcript, meetingContext, participants } = await req.json();
    
    console.log(`[TASK-RECOMMENDATION] 📋 Analysing task: ${task.description.substring(0, 100)}...`);
    console.log(`[TASK-RECOMMENDATION] 👥 Participants: ${participants.map((p: any) => p.name).join(', ')}`);
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Initialisation des agents spécialisés
    const coordinator = new CoordinatorAgent(openaiApiKey);
    const databaseAgent = new DatabaseAgent(supabase);
    const embeddingsAgent = new EmbeddingsAgent(openaiApiKey, supabase);

    // 🧠 PHASE 1: ANALYSE SPÉCIALISÉE pour recommandations de tâches
    console.log('[TASK-RECOMMENDATION] 🧠 Phase 1: Analyse spécialisée de la tâche');
    
    // Adapter l'analyse pour se concentrer sur cette tâche spécifique
    const taskQuery = `Recommandation pour la tâche: ${task.description}`;
    const analysis = await coordinator.analyzeQuery(taskQuery, []);
    
    // Forcer la recherche d'embeddings et internet pour les recommandations
    analysis.requiresEmbeddings = true;
    analysis.requiresInternet = true;
    analysis.priority = 'embeddings';

    console.log('[TASK-RECOMMENDATION] 📊 Analyse:', {
      queryType: analysis.queryType,
      requiresEmbeddings: analysis.requiresEmbeddings,
      requiresInternet: analysis.requiresInternet
    });

    // 🗄️ PHASE 2: RECHERCHE DATABASE avec contexte de la tâche
    console.log('[TASK-RECOMMENDATION] 🗄️ Phase 2: Recherche database contextuelle');
    const databaseContext = await databaseAgent.searchContext(analysis);
    
    console.log('[TASK-RECOMMENDATION] ✅ Database:', {
      meetings: databaseContext.meetings.length,
      documents: databaseContext.documents.length,
      todos: databaseContext.todos.length
    });

    // Enhanced Phase 4: Internet search with specific provider focus
    console.log('[TASK-RECOMMENDATION] 🌐 Phase 4: Recherche internet fournisseurs spécifiques');
    const internetAgent = new InternetAgent(perplexityApiKey);
    const internetContext = await internetAgent.searchInternet(
      task.description, 
      { requiresInternet: true, queryType: 'task', searchTerms: [], synonyms: [], requiresDatabase: false, requiresEmbeddings: false, priority: 'internet' }, 
      false
    );

    console.log('[TASK-RECOMMENDATION] ✅ Internet:', {
      hasContent: internetContext.hasContent,
      contentLength: internetContext.content.length
    });

    // ⚡ PHASE 5: Enhanced synthesis with provider-specific recommendations
    console.log('[TASK-RECOMMENDATION] ⚡ Phase 5: Synthèse avec fournisseurs spécifiques');
    
    const taskRecommendationPrompt = `Tu es un assistant IA expert pour cabinet d'ophtalmologie Dr Tabibian à Genève, spécialisé dans les recommandations précises avec fournisseurs spécifiques ou informations techniques utiles.

**CONTEXTE CABINET:**
- Cabinet d'ophtalmologie dirigé par Dr Tabibian à Genève, Suisse
- Participants: ${participants.map((p: any) => p.name).join(', ')}
- Budget en CHF (francs suisses)

**TÂCHE À ANALYSER:**
${task.description}

**CONTEXTE RÉUNION:**
${transcript.substring(0, 1500)}...

**INFORMATIONS INTERNET ACTUELLES:**
${internetContext.content ? internetContext.content.substring(0, 1500) : 'Informations limitées disponibles'}

**INSTRUCTIONS CRITIQUES:**

1. **RECOMMANDATIONS CONCRÈTES ET UTILES**:
   - Fournir des **fournisseurs spécifiques** suisses ou européens selon le besoin (services, matériel, support technique, etc.)
   - Si aucun fournisseur pertinent, fournir des **informations techniques précises** (ex : protocoles de configuration, normes à respecter, détails techniques utiles)
   - Si un service est mentionné (ex. messagerie, site web, stockage, logiciels, etc.), proposer **plusieurs prestataires** avec **avantages et inconvénients résumés de chacun**

2. **INFORMATIONS CONCRÈTES**:
   - Prix approximatifs en CHF
   - Contacts/sites web si disponibles
   - Procédures spécifiques utiles
   - Délais typiques

3. **EMAIL EXTERNE UNIQUEMENT**: Si recommandé, l'email doit être pour un prestataire externe avec:
   - Présentation professionnelle du cabinet Dr Tabibian
   - Demande précise de devis/information
   - Mention du contexte ophtalmologique
   - Coordonnées Genève

4. **SÉLECTIVITÉ**: Ne recommande que si tu peux apporter:
   - Des fournisseurs précis avec comparaison claire
   - Des informations techniques utiles à l'action
   - Une vraie valeur ajoutée, concise et applicable

5. **FORMAT JSON REQUIS**:
{
  "hasRecommendation": [true/false],
  "recommendation": "[Recommandation avec fournisseurs ou infos techniques concrètes et prix CHF]",
  "needsExternalEmail": [true/false],
  "emailDraft": "[Email professionnel pour prestataire externe]",
  "externalProviders": ["Liste noms entreprises/fournisseurs spécifiques"],
  "estimatedCost": "[Coût en CHF avec fourchette]",
  "specificInfo": "[Infos techniques spécifiques ex: protocole SMTP sécurisé, type de licence, contraintes réglementaires, etc.]"
}

**EXEMPLES DE BONNES RECOMMANDATIONS:**
- "Configurer un service mail sécurisé avec SPF/DKIM, tarif environ 50-100 CHF/an"
- "Fournisseur Haag-Streit (Berne) pour matériel ophtalmologique, devis sur mesure"
- "Comparaison : MedWeb (intégration médicale, + spécialisé / - plus cher), SwissDigitalCare (bon support, + flexible / - moins orienté santé), budget 5000-15000 CHF"

Analyse maintenant et fournis une recommandation JSON avec fournisseurs ou informations techniques utiles.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'Tu es un expert en recommandations pour cabinet médical avec focus sur les fournisseurs suisses spécifiques. Réponds UNIQUEMENT en JSON valide.' 
          },
          { role: 'user', content: taskRecommendationPrompt }
        ],
        max_tokens: 1000,
        temperature: 0.2,
      }),
    });

    const aiData = await response.json();
    let recommendationResult;
    
    try {
      const content = aiData.choices[0].message.content.trim();
      // Nettoyer le JSON si nécessaire
      const cleanedContent = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      recommendationResult = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('[TASK-RECOMMENDATION] Erreur parsing JSON:', parseError);
      recommendationResult = { hasRecommendation: false };
    }

    console.log('[TASK-RECOMMENDATION] ✅ RECOMMANDATION AVEC FOURNISSEURS:', {
      hasRecommendation: recommendationResult.hasRecommendation,
      providers: recommendationResult.externalProviders?.length || 0,
      hasSpecificInfo: !!recommendationResult.specificInfo
    });

    return new Response(JSON.stringify({
      success: true,
      recommendation: recommendationResult,
      contextUsed: {
        internet: internetContext.hasContent,
        internetContentLength: internetContext.content.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[TASK-RECOMMENDATION] ❌ ERREUR:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      context: 'Enhanced Task Recommendation Agent'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
