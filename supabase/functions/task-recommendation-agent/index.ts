
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const requestStartTime = Date.now();
  console.log(`🚀 [TASK-AGENT] DÉBUT traitement - ${new Date().toISOString()}`);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    console.log(`📥 [TASK-AGENT] Données reçues:`, {
      hasBatchPrompt: !!requestBody.batchPrompt,
      tasksCount: requestBody.tasks?.length || 0,
      transcriptLength: requestBody.transcript?.length || 0,
      meetingContext: requestBody.meetingContext
    });
    
    // Détecter si c'est un traitement batch ou individuel
    const isBatchRequest = requestBody.batchPrompt && requestBody.tasks;
    
    console.log(`[TASK-AGENT] ${isBatchRequest ? 'Traitement BATCH' : 'Traitement INDIVIDUEL'}`);
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('❌ [TASK-AGENT] OpenAI API key not configured');
      throw new Error('OpenAI API key not configured');
    }

    let prompt;
    let temperature = 0.3;

    if (isBatchRequest) {
      // Traitement batch - utiliser le prompt pré-construit
      prompt = requestBody.batchPrompt;
      temperature = 0.2; // Plus déterministe pour le batch
      console.log(`[TASK-AGENT] 🔄 Traitement batch pour ${requestBody.tasks.length} tâches`);
      console.log(`[TASK-AGENT] 📏 Prompt length: ${prompt.length} characters`);
      
      // Logger un aperçu du prompt pour debugging
      const promptPreview = prompt.substring(0, 500) + (prompt.length > 500 ? '...' : '');
      console.log(`[TASK-AGENT] 📄 Prompt preview:`, promptPreview);
      
    } else {
      // Traitement individuel - garder l'ancien système
      const { task, transcript, meetingContext, participants } = requestBody;
      
      console.log(`[TASK-AGENT] 🎯 Analyse intelligente: ${task.description.substring(0, 50)}`);
      
      const participantNames = participants?.map(p => p.name).join(', ') || 'Aucun participant spécifié';
      
      prompt = `Tu es un assistant IA spécialisé dans la génération de recommandations pour des tâches issues de réunions.

CONTEXTE DE LA RÉUNION :
- Titre: ${meetingContext.title}
- Date: ${meetingContext.date}
- Participants: ${meetingContext.participants}

TRANSCRIPT DE LA RÉUNION :
${transcript}

TÂCHE À ANALYSER :
"${task.description}"

INSTRUCTIONS :
Analyse cette tâche dans le contexte de la réunion et génère une recommandation IA personnalisée.

La recommandation doit être :
1. Pratique et actionnable
2. Basée sur le contexte de la réunion
3. Spécifique à cette tâche
4. Incluant un email pré-rédigé si la tâche implique une communication externe

Réponds UNIQUEMENT en JSON avec cette structure :
{
  "hasRecommendation": true,
  "recommendation": "Recommandation détaillée...",
  "emailDraft": "Email pré-rédigé si nécessaire (sinon null)"
}`;
    }

    console.log('[TASK-AGENT] 🧠 Appel OpenAI...');
    const openaiStartTime = Date.now();
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: 16384,
      }),
    });

    const openaiDuration = Date.now() - openaiStartTime;
    console.log(`⏱️ [TASK-AGENT] Appel OpenAI terminé (${openaiDuration}ms)`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[TASK-AGENT] ❌ Erreur OpenAI:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    console.log('[TASK-AGENT] ✅ Réponse OpenAI reçue');
    console.log(`[TASK-AGENT] 📏 Réponse length: ${content?.length || 0} characters`);
    console.log(`[TASK-AGENT] 📊 Tokens utilisés: prompt=${data.usage?.prompt_tokens || 0}, completion=${data.usage?.completion_tokens || 0}, total=${data.usage?.total_tokens || 0}`);
    
    // Logger la réponse brute pour debugging (tronquée si trop longue)
    const contentPreview = content?.substring(0, 1000) + (content?.length > 1000 ? '...' : '');
    console.log(`[TASK-AGENT] 📄 Contenu brut reçu:`, contentPreview);

    let recommendation;
    try {
      // Nettoyer la réponse et parser le JSON
      const cleanedContent = content.trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```\s*$/i, '');
      
      console.log(`[TASK-AGENT] 🧹 Contenu nettoyé length: ${cleanedContent.length}`);
      
      recommendation = JSON.parse(cleanedContent);
      
      if (isBatchRequest) {
        const recommendationsCount = recommendation.recommendations?.length || 0;
        console.log(`[TASK-AGENT] ✅ Batch traité: ${recommendationsCount} recommandations générées`);
        
        // Logger un aperçu des recommandations
        if (recommendation.recommendations) {
          recommendation.recommendations.forEach((rec, index) => {
            console.log(`[TASK-AGENT] 📋 Recommandation ${index + 1}: taskId=${rec.taskId}, hasRec=${rec.hasRecommendation}, preview=${rec.recommendation?.substring(0, 100)}...`);
          });
        }
      } else {
        console.log(`[TASK-AGENT] ✅ Recommandation individuelle générée: ${recommendation.hasRecommendation ? 'Oui' : 'Non'}`);
      }
      
    } catch (parseError) {
      console.error('[TASK-AGENT] ❌ Erreur parsing JSON:', parseError);
      console.log('[TASK-AGENT] 📄 Contenu original complet:', content);
      
      // Essayer une extraction plus robuste
      try {
        console.log('[TASK-AGENT] 🔧 Tentative d\'extraction JSON alternative...');
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          recommendation = JSON.parse(jsonMatch[0]);
          console.log('[TASK-AGENT] ✅ Extraction alternative réussie');
        } else {
          throw new Error('Aucun JSON trouvé dans la réponse');
        }
      } catch (altError) {
        console.error('[TASK-AGENT] ❌ Extraction alternative échouée:', altError);
        
        // Fallback pour le batch
        if (isBatchRequest) {
          console.log('[TASK-AGENT] 🔧 Génération fallback pour batch...');
          recommendation = {
            recommendations: requestBody.tasks.map(task => ({
              taskIndex: task.index,
              taskId: task.id,
              hasRecommendation: false,
              recommendation: "Erreur lors de la génération de la recommandation",
              emailDraft: null
            }))
          };
        } else {
          console.log('[TASK-AGENT] 🔧 Génération fallback pour individuel...');
          recommendation = {
            hasRecommendation: false,
            recommendation: "Erreur lors de la génération de la recommandation",
            emailDraft: null
          };
        }
      }
    }

    const totalDuration = Date.now() - requestStartTime;
    console.log(`🏁 [TASK-AGENT] Traitement terminé (${totalDuration}ms total)`);

    return new Response(JSON.stringify({
      recommendation,
      success: true,
      performance: {
        totalDuration,
        openaiDuration,
        tokensUsed: data.usage?.total_tokens || 0
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const totalDuration = Date.now() - requestStartTime;
    console.error(`❌ [TASK-AGENT] Erreur après ${totalDuration}ms:`, error);
    console.error(`❌ [TASK-AGENT] Stack trace:`, error.stack);
    
    return new Response(JSON.stringify({
      error: error.message,
      recommendation: null,
      success: false,
      performance: {
        totalDuration,
        failed: true
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
