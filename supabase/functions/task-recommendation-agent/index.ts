
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { CoordinatorAgent } from '../ai-agent/agents/coordinator.ts';
import { DatabaseAgent } from '../ai-agent/agents/database.ts';
import { EmbeddingsAgent } from '../ai-agent/agents/embeddings.ts';
import { InternetAgent } from '../ai-agent/agents/internet.ts';
import { SynthesisAgent } from '../ai-agent/agents/synthesis.ts';

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
    const internetAgent = new InternetAgent(perplexityApiKey);
    const synthesisAgent = new SynthesisAgent(openaiApiKey);

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

    // 🎯 PHASE 3: RECHERCHE VECTORIELLE avec transcript complet
    console.log('[TASK-RECOMMENDATION] 🎯 Phase 3: Recherche vectorielle avec transcript');
    const embeddingContext = await embeddingsAgent.searchEmbeddings(
      taskQuery + " " + transcript.substring(0, 1000), 
      analysis, 
      databaseContext.relevantIds
    );

    console.log('[TASK-RECOMMENDATION] ✅ Embeddings:', {
      chunks: embeddingContext.chunks.length,
      hasContext: embeddingContext.hasRelevantContext
    });

    // 🌐 PHASE 4: RECHERCHE INTERNET pour prestataires externes
    console.log('[TASK-RECOMMENDATION] 🌐 Phase 4: Recherche internet prestataires');
    const internetContext = await internetAgent.searchInternet(taskQuery, analysis, embeddingContext.hasRelevantContext);

    console.log('[TASK-RECOMMENDATION] ✅ Internet:', {
      hasContent: internetContext.hasContent,
      enrichmentType: internetContext.enrichmentType
    });

    // ⚡ PHASE 5: SYNTHÈSE SPÉCIALISÉE pour recommandations de tâches
    console.log('[TASK-RECOMMENDATION] ⚡ Phase 5: Synthèse spécialisée');
    
    const taskRecommendationPrompt = `Tu es un assistant IA expert pour cabinet d'ophtalmologie à Genève, spécialisé dans les recommandations de tâches professionnelles.

**CONTEXTE CABINET:**
- Cabinet d'ophtalmologie dirigé par Dr Tabibian à Genève, Suisse
- Participants de l'équipe: ${participants.map((p: any) => p.name).join(', ')}
- Utilise TOUJOURS les CHF (francs suisses) pour les prix

**TÂCHE À ANALYSER:**
${task.description}

**CONTEXTE DE LA RÉUNION:**
${transcript.substring(0, 2000)}...

**INFORMATIONS INTERNES DISPONIBLES:**
${embeddingContext.chunks.slice(0, 3).map((chunk: any) => chunk.chunk_text.substring(0, 200)).join('\n')}

**INFORMATIONS EXTERNES:**
${internetContext.content ? internetContext.content.substring(0, 1000) : 'Aucune information externe disponible'}

**INSTRUCTIONS CRITIQUES:**

1. **SÉLECTIVITÉ MAXIMALE**: Ne fournis une recommandation QUE si elle apporte une valeur ajoutée SIGNIFICATIVE et CONCRÈTE

2. **FOCUS EXTERNE**: Si tu recommandes un email, il doit être destiné à un PRESTATAIRE EXTERNE (régie, fournisseur, entreprise de service, etc.), PAS à l'équipe interne

3. **RECHERCHE DE PRESTATAIRES**: Si la tâche nécessite de contacter une entreprise externe:
   - Identifie des prestataires spécifiques en Suisse/Genève
   - Inclus des noms d'entreprises, contacts ou sites web si disponibles
   - Mentionne les prix approximatifs en CHF

4. **EMAIL EXTERNE UNIQUEMENT**: L'email doit être professionnel, destiné à un prestataire externe, avec:
   - Objet clair et professionnel
   - Présentation du cabinet d'ophtalmologie Dr Tabibian
   - Demande précise (devis, information, service)
   - Coordonnées du cabinet à Genève

5. **RÉPONSE STRUCTURÉE**: Réponds avec ce format JSON exact:
{
  "hasRecommendation": [true ou false],
  "recommendation": "[Recommandation concise et actionnable ou null]",
  "needsExternalEmail": [true ou false],
  "emailDraft": "[Email professionnel pour prestataire externe ou null]",
  "externalProviders": ["Liste des prestataires identifiés ou array vide"],
  "estimatedCost": "[Coût estimé en CHF ou null]"
}

**CRITÈRES DE REJET**: Réponds avec hasRecommendation: false si:
- La tâche est évidente et ne nécessite aucun conseil
- Aucun prestataire externe n'est nécessaire
- Les informations disponibles sont insuffisantes
- La tâche concerne uniquement l'organisation interne

Analyse maintenant cette tâche et fournis une réponse JSON uniquement.`;

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
            content: 'Tu es un assistant expert en recommandations pour cabinet médical. Réponds UNIQUEMENT en JSON valide.' 
          },
          { role: 'user', content: taskRecommendationPrompt }
        ],
        max_tokens: 800,
        temperature: 0.3,
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

    console.log('[TASK-RECOMMENDATION] ✅ RECOMMANDATION GÉNÉRÉE:', {
      hasRecommendation: recommendationResult.hasRecommendation,
      needsExternalEmail: recommendationResult.needsExternalEmail,
      providers: recommendationResult.externalProviders?.length || 0
    });

    return new Response(JSON.stringify({
      success: true,
      recommendation: recommendationResult,
      contextUsed: {
        embeddings: embeddingContext.chunks.length,
        internet: internetContext.hasContent,
        database: databaseContext.meetings.length + databaseContext.documents.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[TASK-RECOMMENDATION] ❌ ERREUR:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      context: 'Task Recommendation Agent'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
