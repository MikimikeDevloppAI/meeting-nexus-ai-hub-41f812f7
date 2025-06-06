
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

// Enhanced database agent with existing tasks context
class DatabaseAgent {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  async searchContext(analysis: QueryAnalysis): Promise<DatabaseContext> {
    console.log('[DATABASE] Récupération du contexte incluant tâches existantes');
    
    // Récupérer les tâches en cours pour éviter les doublons
    const { data: existingTodos } = await this.supabase
      .from('todos')
      .select('id, description, status, created_at')
      .in('status', ['pending', 'confirmed'])
      .order('created_at', { ascending: false })
      .limit(50);

    console.log(`[DATABASE] ${existingTodos?.length || 0} tâches existantes trouvées`);

    return {
      meetings: [],
      documents: [],
      todos: existingTodos || [],
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

// Enhanced internet agent with strict contact validation
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
      // Enhanced search focusing on context and company information
      const enhancedQuery = this.buildContextualQuery(query);
      
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
              content: this.getStrictContactSystemPrompt()
            },
            {
              role: 'user',
              content: enhancedQuery
            }
          ],
          temperature: 0.1,
          max_tokens: 1500,
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

  private buildContextualQuery(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    // Détection des entreprises/sociétés mentionnées
    const companyKeywords = ['société', 'entreprise', 'cabinet', 'firme', 'sa ', 'sarl', 'sas', 'ag ', 'gmbh', 'ltd', 'inc', 'corp'];
    const hasCompanyMention = companyKeywords.some(keyword => lowerQuery.includes(keyword));
    
    if (hasCompanyMention) {
      return `RECHERCHE ENTREPRISE AVEC COORDONNÉES STRICTES pour cabinet médical ophtalmologie Genève:

TÂCHE: ${query}

INSTRUCTIONS CRITIQUES:
1. IDENTIFIER l'entreprise/société mentionnée dans la tâche
2. COORDONNÉES: Inclure UNIQUEMENT si trouvées sur sources officielles vérifiables:
   - Site web: URL complète format [nom](https://url)
   - Téléphone: Format international +41... ou +33... SEULEMENT si sur site officiel
   - Email: contact@ ou info@ SEULEMENT si vérifiés sur site
3. CONTEXTE MÉDICAL: Cabinet d'ophtalmologie Dr Tabibian à Genève
4. NE JAMAIS inventer ou supposer des coordonnées manquantes
5. Si aucune coordonnée trouvée: Ne pas en mentionner

INTERDICTION ABSOLUE: Inventer téléphones, emails ou sites web`;
    }
    
    return `RECOMMANDATION CONTEXTUELLE pour cabinet ophtalmologie Genève:

TÂCHE: ${query}

FOCUS:
- Comprendre le contexte spécifique de la tâche
- Fournir recommandations pertinentes au domaine médical
- Cabinet Dr Tabibian spécialisé ophtalmologie
- Solutions pratiques adaptées à Genève/Suisse

Si entreprise externe mentionnée: coordonnées SEULEMENT si trouvées`;
  }

  private getStrictContactSystemPrompt(): string {
    return `Expert en recommandations pour cabinet médical ophtalmologie avec validation stricte des coordonnées.

RÈGLES ABSOLUES COORDONNÉES:
1. SITES WEB: URLs complètes format [nom](https://url) SEULEMENT si trouvés
2. TÉLÉPHONES: Format +41/+33... SEULEMENT si vérifiés sur sites officiels
3. EMAILS: contact@/info@ SEULEMENT si trouvés sur sites officiels
4. INTERDICTION TOTALE: Inventer coordonnées inexistantes
5. SI PAS TROUVÉ: Ne pas mentionner l'information

CONTEXTE: Cabinet ophtalmologie Dr Tabibian Genève - Recommandations pertinentes uniquement.

OBJECTIF: Informations fiables et contextuelles pour professionnels médicaux.`;
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
    
    console.log(`[TASK-RECOMMENDATION] 📋 Analyse contextuelle: ${task.description.substring(0, 100)}...`);
    console.log(`[TASK-RECOMMENDATION] 👥 Participants: ${participants.map((p: any) => p.name).join(', ')}`);
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Initialisation des agents avec contexte amélioré
    const coordinator = new CoordinatorAgent(openaiApiKey);
    const databaseAgent = new DatabaseAgent(supabase);
    const embeddingsAgent = new EmbeddingsAgent(openaiApiKey, supabase);

    // 🧠 PHASE 1: ANALYSE avec contexte des tâches existantes
    console.log('[TASK-RECOMMENDATION] 🧠 Analyse avec contexte tâches existantes');
    
    const taskQuery = `Recommandation contextuelle: ${task.description}`;
    const analysis = await coordinator.analyzeQuery(taskQuery, []);
    
    analysis.requiresEmbeddings = true;
    analysis.requiresInternet = true;
    analysis.priority = 'context';

    // 🗄️ PHASE 2: RECHERCHE avec tâches existantes
    console.log('[TASK-RECOMMENDATION] 🗄️ Récupération contexte + tâches existantes');
    const databaseContext = await databaseAgent.searchContext(analysis);
    
    console.log('[TASK-RECOMMENDATION] ✅ Contexte récupéré:', {
      existingTodos: databaseContext.todos.length
    });

    // 🌐 PHASE 3: Recherche internet contextuelle avec coordonnées strictes
    console.log('[TASK-RECOMMENDATION] 🌐 Recherche internet contextuelle');
    const internetAgent = new InternetAgent(perplexityApiKey);
    const internetContext = await internetAgent.searchInternet(
      task.description, 
      analysis, 
      false
    );

    console.log('[TASK-RECOMMENDATION] ✅ Internet:', {
      hasContent: internetContext.hasContent,
      contentLength: internetContext.content.length
    });

    // ⚡ PHASE 4: Synthèse contextuelle avec validation coordonnées
    console.log('[TASK-RECOMMENDATION] ⚡ Synthèse contextuelle avancée');
    
    // Extraction du contexte autour de la tâche dans le transcript
    const taskContext = this.extractTaskContext(task.description, transcript);
    
    const contextualPrompt = `Tu es l'assistant IA expert OphtaCare pour cabinet Dr Tabibian à Genève, spécialisé dans les recommandations précises avec compréhension contextuelle.

**CONTEXTE CABINET:**
- Cabinet d'ophtalmologie Dr Tabibian à Genève, Suisse
- Participants réunion: ${participants.map((p: any) => p.name).join(', ')}
- Utilisation: Outil professionnel pour gestion cabinet médical

**TÂCHE À ANALYSER:**
${task.description}

**CONTEXTE DÉTAILLÉ DE LA TÂCHE DANS LA RÉUNION:**
${taskContext}

**TÂCHES EXISTANTES À ÉVITER (${databaseContext.todos.length}):**
${databaseContext.todos.slice(0, 10).map((todo: any) => `- ${todo.description}`).join('\n')}

**INFORMATIONS INTERNET CONTEXTUELLES:**
${internetContext.content ? internetContext.content.substring(0, 1500) : 'Informations contextuelles limitées'}

**INSTRUCTIONS CRITIQUES CONTEXTUELLES:**

1. **COMPRÉHENSION CONTEXTUELLE OBLIGATOIRE**:
   - Analyser le CONTEXTE précis dans lequel la tâche a été mentionnée
   - Comprendre le POURQUOI et les ENJEUX de cette tâche
   - Adapter les recommandations au contexte médical/ophtalmologique

2. **ÉVITER DOUBLONS**:
   - Vérifier si une tâche similaire existe déjà
   - Si similaire trouvée, mentionner "Tâche similaire existante: [description]"

3. **COORDONNÉES ENTREPRISES EXTERNES** (VALIDATION STRICTE):
   - Si entreprise/société mentionnée dans la tâche
   - Coordonnées UNIQUEMENT si trouvées dans mes informations:
     * Site web: [nom](https://url) si URL exacte connue
     * Téléphone: +41... si numéro exact connu
     * Email: contact@ si adresse exacte connue
   - SI AUCUNE COORDONNÉE CONNUE: Ne rien mentionner

4. **RECOMMANDATIONS CONTEXTUELLES**:
   - Basées sur la compréhension du contexte spécifique
   - Adaptées au domaine ophtalmologique
   - Pratiques pour cabinet médical genevois

5. **FORMAT JSON REQUIS**:
{
  "hasRecommendation": [true/false],
  "contextAnalysis": "[Analyse du contexte spécifique de la tâche]",
  "recommendation": "[Recommandation adaptée au contexte]",
  "duplicateTask": "[Si tâche similaire existe déjà]",
  "needsExternalEmail": [true/false],
  "emailDraft": "[Email si prestataire externe]",
  "externalProviders": ["Liste entreprises spécifiques"],
  "estimatedCost": "[Coût CHF si pertinent]",
  "contactInfo": [
    {
      "name": "Nom entreprise",
      "phone": "Téléphone SI CONNU",
      "email": "Email SI CONNU", 
      "website": "URL SI CONNUE"
    }
  ]
}

Analyse maintenant la tâche avec son contexte spécifique et fournis une recommandation JSON contextuelle.`;

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
            content: 'Tu es un expert en recommandations contextuelles pour cabinet médical. Tu comprends le contexte spécifique des tâches et ne fournis des coordonnées que si tu les connais vraiment. Réponds UNIQUEMENT en JSON valide.' 
          },
          { role: 'user', content: contextualPrompt }
        ],
        max_tokens: 1200,
        temperature: 0.2,
      }),
    });

    const aiData = await response.json();
    let recommendationResult;
    
    try {
      const content = aiData.choices[0].message.content.trim();
      const cleanedContent = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      recommendationResult = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('[TASK-RECOMMENDATION] Erreur parsing JSON:', parseError);
      recommendationResult = { hasRecommendation: false };
    }

    console.log('[TASK-RECOMMENDATION] ✅ RECOMMANDATION CONTEXTUELLE:', {
      hasRecommendation: recommendationResult.hasRecommendation,
      hasContextAnalysis: !!recommendationResult.contextAnalysis,
      hasDuplicateCheck: !!recommendationResult.duplicateTask,
      contactInfoValidated: recommendationResult.contactInfo?.length || 0
    });

    return new Response(JSON.stringify({
      success: true,
      recommendation: recommendationResult,
      contextUsed: {
        existingTodos: databaseContext.todos.length,
        internet: internetContext.hasContent,
        contextAnalysis: !!recommendationResult.contextAnalysis
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[TASK-RECOMMENDATION] ❌ ERREUR:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      context: 'Enhanced Contextual Task Recommendation Agent'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Fonction utilitaire pour extraire le contexte de la tâche
function extractTaskContext(taskDescription: string, transcript: string): string {
  if (!transcript || !taskDescription) return 'Contexte non disponible';
  
  const taskWords = taskDescription.toLowerCase().split(' ').filter(word => word.length > 3);
  const transcriptSentences = transcript.split(/[.!?]+/);
  
  // Trouver les phrases du transcript qui contiennent des mots-clés de la tâche
  const relevantSentences = transcriptSentences.filter(sentence => {
    const sentenceLower = sentence.toLowerCase();
    return taskWords.some(word => sentenceLower.includes(word));
  });
  
  if (relevantSentences.length > 0) {
    return relevantSentences.slice(0, 3).join('. ').trim();
  }
  
  return 'Contexte spécifique non identifié dans le transcript';
}
