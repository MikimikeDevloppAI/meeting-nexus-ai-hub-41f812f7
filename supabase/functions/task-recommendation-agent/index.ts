
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    
    console.log('[TASK-RECOMMENDATION] 📋 Analyse contextuelle:', task.description.substring(0, 100) + '...');
    console.log('[TASK-RECOMMENDATION] 👥 Participants:', participants?.map(p => p.name).join(', ') || 'Aucun');
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[TASK-RECOMMENDATION] 🧠 Analyse avec contexte tâches existantes');

    // Récupérer le contexte des tâches existantes
    console.log('[TASK-RECOMMENDATION] 🗄️ Récupération contexte + tâches existantes');
    
    const { data: existingTodos } = await supabase
      .from('todos')
      .select('id, description, status')
      .in('status', ['pending', 'confirmed'])
      .limit(50);

    console.log('[DATABASE] Récupération du contexte incluant tâches existantes');
    console.log('[DATABASE]', existingTodos?.length || 0, 'tâches existantes trouvées');

    const contextData = {
      existingTodos: existingTodos || []
    };

    console.log('[TASK-RECOMMENDATION] ✅ Contexte récupéré:', { existingTodos: contextData.existingTodos.length });

    // Recherche internet contextuelle
    console.log('[TASK-RECOMMENDATION] 🌐 Recherche internet contextuelle');
    
    let internetContext = { hasContent: false, content: '' };
    try {
      // Identifier si la tâche nécessite des informations externes
      const taskLower = task.description.toLowerCase();
      const needsInternet = taskLower.includes('prestataire') || 
                           taskLower.includes('entreprise') || 
                           taskLower.includes('fournisseur') ||
                           taskLower.includes('contact') ||
                           taskLower.includes('régie') ||
                           taskLower.includes('installation') ||
                           taskLower.includes('matériel');

      if (needsInternet) {
        const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
        if (perplexityKey) {
          const searchQuery = `${task.description} Genève Suisse prestataires contacts`;
          
          const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${perplexityKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'llama-3.1-sonar-small-128k-online',
              messages: [
                {
                  role: 'system',
                  content: 'Fournis des informations pratiques sur les prestataires et fournisseurs à Genève, Suisse. Inclus des noms d\'entreprises, coordonnées si disponibles.'
                },
                {
                  role: 'user',
                  content: searchQuery
                }
              ],
              max_tokens: 500,
              temperature: 0.2,
            }),
          });

          if (perplexityResponse.ok) {
            const perplexityData = await perplexityResponse.json();
            internetContext = {
              hasContent: true,
              content: perplexityData.choices[0]?.message?.content || ''
            };
          }
        }
      }
    } catch (error) {
      console.error('[TASK-RECOMMENDATION] Erreur recherche internet:', error);
    }

    console.log('[TASK-RECOMMENDATION] ✅ Internet:', { hasContent: internetContext.hasContent, contentLength: internetContext.content.length });

    // Synthèse avec recommandations IA
    console.log('[TASK-RECOMMENDATION] ⚡ Synthèse contextuelle avancée');

    const systemPrompt = `Tu es un assistant IA spécialisé pour un cabinet d'ophtalmologie à Genève, Suisse.

MISSION : Analyser cette tâche et fournir des recommandations utiles SEULEMENT si tu peux ajouter une valeur significative.

CONTEXTE DISPONIBLE :
- Tâche: ${task.description}
- Transcript: ${transcript ? 'Disponible' : 'Non disponible'}
- Contexte réunion: ${meetingContext?.title || 'Cabinet ophtalmologie'}
- Participants: ${participants?.map(p => p.name).join(', ') || 'Non spécifiés'}
- Tâches existantes: ${contextData.existingTodos.length} tâches en cours

${internetContext.hasContent ? `INFORMATIONS EXTERNES TROUVÉES:
${internetContext.content}` : ''}

RÈGLES DE RECOMMANDATION :
1. Si la tâche est simple et ne nécessite pas de conseils → réponds avec hasRecommendation: false
2. Pour les tâches complexes, fournis des recommandations pratiques
3. Pour les contacts externes, suggère des prestataires genevois si pertinent
4. Pour tous les prix, utilise les CHF (francs suisses)
5. Si email externe nécessaire, crée un brouillon professionnel

RÉPONSE REQUISE (JSON uniquement) :
{
  "hasRecommendation": boolean,
  "recommendation": "texte de recommandation ou null",
  "needsExternalEmail": boolean,
  "emailDraft": "brouillon email si nécessaire ou null",
  "externalProviders": ["liste prestataires si pertinent"],
  "contextAnalysis": "analyse du contexte utilisé",
  "duplicateTask": "avertissement si tâche similaire existe ou null"
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyse cette tâche : "${task.description}"` }
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    const aiData = await response.json();
    let recommendation;

    try {
      const aiContent = aiData.choices[0].message.content;
      // Nettoyer la réponse et extraire le JSON
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        recommendation = JSON.parse(jsonMatch[0]);
      } else {
        recommendation = { hasRecommendation: false };
      }
    } catch (parseError) {
      console.error('[TASK-RECOMMENDATION] Erreur parsing JSON:', parseError);
      recommendation = { hasRecommendation: false };
    }

    console.log('[TASK-RECOMMENDATION] ✅ Recommandation générée:', recommendation.hasRecommendation);

    return new Response(JSON.stringify({ 
      recommendation,
      contextUsed: {
        existingTodos: contextData.existingTodos.length,
        internetSearch: internetContext.hasContent
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[TASK-RECOMMENDATION] ❌ ERREUR:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      recommendation: { hasRecommendation: false }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
