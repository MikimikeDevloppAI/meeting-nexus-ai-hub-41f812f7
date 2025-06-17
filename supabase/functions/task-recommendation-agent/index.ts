
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
    let maxTokens = 8192; // Réduire pour éviter les timeouts

    if (isBatchRequest) {
      // Traitement batch - utiliser le prompt pré-construit
      prompt = requestBody.batchPrompt;
      temperature = 0.2; // Plus déterministe pour le batch
      maxTokens = 12288; // Un peu plus pour le batch mais pas trop
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
      
      prompt = `Tu es un assistant IA spécialisé dans la génération de recommandations pour des tâches issues de réunions pour le cabinet Ophtacre du dr tabibian à genève.

CONTEXTE DE LA RÉUNION :
- Titre: ${meetingContext.title}
- Date: ${meetingContext.date}
- Participants: ${meetingContext.participants}

TRANSCRIPT DE LA RÉUNION :
${transcript}

TÂCHE À ANALYSER :
"${task.description}"

Ton objectif est d'analyser la tâche et de :
1. Proposer un **plan d'exécution clair** si la tâche est complexe ou nécessite plusieurs étapes.
2. **Signaler les éléments importants à considérer** (contraintes réglementaires, risques, coordination nécessaire, points d'attention).
3. **Suggérer des prestataires, fournisseurs ou outils** qui peuvent faciliter l’exécution.
4. Si pertinent, **challenger les décisions prises** ou proposer une alternative plus efficace ou moins risquée.
5. Ne faire **aucune recommandation** si la tâche est simple ou évidente (dans ce cas, répondre uniquement : “Aucune recommandation.”).
6. génére des email prérédigé lorsque la tâche nécessite une communication. adapt l'email si il s'agit de communication interne (directe, droit au but en amenant quand meme le contexte nécessaire) et communication externe( donne tout le contexte nécessaire pour que le fournisseur externe comprenne  la tache et soit professionel et détaillé

Critères de qualité :
- Sois **concis, structuré et actionnable**.
- Fournis uniquement des recommandations qui **ajoutent une vraie valeur**.
- N’invente pas de contacts si tu n’en as pas.
- Évite les banalités ou les évidences.

Réponds UNIQUEMENT en JSON avec cette structure :
{
  "hasRecommendation": true,
  "recommendation": "Recommandation détaillée...",
  "emailDraft": "Email pré-rédigé si nécessaire (sinon null)"
}`;
    }

    console.log('[TASK-AGENT] 🧠 Appel OpenAI avec gpt-4o-mini...');
    const openaiStartTime = Date.now();
    
    // Créer un timeout personnalisé pour éviter les blocages
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('⏰ [TASK-AGENT] Timeout OpenAI après 45 secondes');
      timeoutController.abort();
    }, 45000); // 45 secondes max
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Changé pour plus de rapidité
          messages: [{ role: 'user', content: prompt }],
          temperature,
          max_tokens: maxTokens,
        }),
        signal: timeoutController.signal,
      });

      clearTimeout(timeoutId);
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
                recommendation: "Erreur lors de la génération de la recommandation - timeout ou erreur de parsing",
                emailDraft: null
              }))
            };
          } else {
            console.log('[TASK-AGENT] 🔧 Génération fallback pour individuel...');
            recommendation = {
              hasRecommendation: false,
              recommendation: "Erreur lors de la génération de la recommandation - timeout ou erreur de parsing",
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

    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.error('⏰ [TASK-AGENT] Timeout lors de l\'appel OpenAI');
        
        // Réponse de fallback en cas de timeout
        const fallbackRecommendation = isBatchRequest ? {
          recommendations: requestBody.tasks.map(task => ({
            taskIndex: task.index,
            taskId: task.id,
            hasRecommendation: false,
            recommendation: "Timeout lors de la génération de la recommandation. Veuillez réessayer plus tard.",
            emailDraft: null
          }))
        } : {
          hasRecommendation: false,
          recommendation: "Timeout lors de la génération de la recommandation. Veuillez réessayer plus tard.",
          emailDraft: null
        };

        const totalDuration = Date.now() - requestStartTime;
        return new Response(JSON.stringify({
          recommendation: fallbackRecommendation,
          success: false,
          error: 'Timeout',
          performance: {
            totalDuration,
            timeout: true
          }
        }), {
          status: 408, // Request Timeout
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw fetchError; // Re-throw si ce n'est pas un timeout
    }

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
