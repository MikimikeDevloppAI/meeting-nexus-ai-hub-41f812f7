
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const requestStartTime = Date.now();
  console.log(`🚀 [TASK-AGENT] DÉBUT traitement batch - ${new Date().toISOString()}`);
  
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
    
    // Vérifier que c'est bien une requête batch
    if (!requestBody.batchPrompt || !requestBody.tasks || !Array.isArray(requestBody.tasks)) {
      console.error('❌ [TASK-AGENT] Requête invalide - seul le mode batch est supporté');
      throw new Error('Cette fonction ne supporte que le traitement batch. batchPrompt et tasks sont requis.');
    }
    
    const tasksCount = requestBody.tasks.length;
    if (tasksCount === 0) {
      console.log('⚠️ [TASK-AGENT] Aucune tâche à traiter');
      return new Response(JSON.stringify({
        recommendation: { recommendations: [] },
        success: true,
        performance: { totalDuration: Date.now() - requestStartTime }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[TASK-AGENT] 🔄 Traitement BATCH pour ${tasksCount} tâches`);
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('❌ [TASK-AGENT] OpenAI API key not configured');
      throw new Error('OpenAI API key not configured');
    }

    const prompt = requestBody.batchPrompt;
    const temperature = 0.2; // Déterministe pour le batch
    const maxTokens = 12288;
    
    console.log(`[TASK-AGENT] 📏 Prompt length: ${prompt.length} characters`);
    console.log(`[TASK-AGENT] 📄 Prompt preview:`, prompt.substring(0, 500) + (prompt.length > 500 ? '...' : ''));

    console.log('[TASK-AGENT] 🧠 Appel OpenAI avec gpt-4o...');
    const openaiStartTime = Date.now();
    
    // Créer un timeout pour éviter les blocages
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('⏰ [TASK-AGENT] Timeout OpenAI après 65 secondes');
      timeoutController.abort();
    }, 65000);
    
    try {
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
        
        // Vérifier que nous avons le bon nombre de recommandations
        const receivedCount = recommendation.recommendations?.length || 0;
        console.log(`[TASK-AGENT] ✅ Batch traité: ${receivedCount} recommandations générées pour ${tasksCount} tâches`);
        
        if (receivedCount !== tasksCount) {
          console.error(`[TASK-AGENT] ⚠️ ATTENTION: Nombre de recommandations (${receivedCount}) différent du nombre de tâches (${tasksCount})`);
          
          // Compléter les recommandations manquantes
          if (receivedCount < tasksCount) {
            console.log(`[TASK-AGENT] 🔧 Génération de ${tasksCount - receivedCount} recommandations par défaut`);
            
            if (!recommendation.recommendations) {
              recommendation.recommendations = [];
            }
            
            for (let i = receivedCount; i < tasksCount; i++) {
              const task = requestBody.tasks[i];
              recommendation.recommendations.push({
                taskIndex: i,
                taskId: task.id,
                hasRecommendation: false,
                recommendation: "Recommandation non générée - complétée automatiquement",
                emailDraft: null
              });
            }
            
            console.log(`[TASK-AGENT] ✅ Recommandations complétées: ${recommendation.recommendations.length} total`);
          }
        }
        
        // Logger un aperçu des recommandations
        if (recommendation.recommendations) {
          recommendation.recommendations.forEach((rec, index) => {
            console.log(`[TASK-AGENT] 📋 Recommandation ${index + 1}: taskId=${rec.taskId}, hasRec=${rec.hasRecommendation}, preview=${rec.recommendation?.substring(0, 100)}...`);
          });
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
          
          // Fallback avec recommandations par défaut pour toutes les tâches
          console.log('[TASK-AGENT] 🔧 Génération fallback pour toutes les tâches...');
          recommendation = {
            recommendations: requestBody.tasks.map((task, index) => ({
              taskIndex: index,
              taskId: task.id,
              hasRecommendation: false,
              recommendation: "Erreur lors de la génération de la recommandation - timeout ou erreur de parsing",
              emailDraft: null
            }))
          };
          console.log(`[TASK-AGENT] ✅ Fallback généré pour ${recommendation.recommendations.length} tâches`);
        }
      }

      const totalDuration = Date.now() - requestStartTime;
      console.log(`🏁 [TASK-AGENT] Traitement batch terminé (${totalDuration}ms total)`);

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
        
        // Réponse de fallback en cas de timeout pour toutes les tâches
        const fallbackRecommendation = {
          recommendations: requestBody.tasks.map((task, index) => ({
            taskIndex: index,
            taskId: task.id,
            hasRecommendation: false,
            recommendation: "Timeout lors de la génération de la recommandation. Veuillez réessayer plus tard.",
            emailDraft: null
          }))
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
    
    // Fallback d'erreur pour toutes les tâches si on les a
    let fallbackRecommendation = null;
    if (requestBody?.tasks && Array.isArray(requestBody.tasks)) {
      fallbackRecommendation = {
        recommendations: requestBody.tasks.map((task, index) => ({
          taskIndex: index,
          taskId: task.id,
          hasRecommendation: false,
          recommendation: `Erreur lors de la génération: ${error.message}`,
          emailDraft: null
        }))
      };
    }
    
    return new Response(JSON.stringify({
      error: error.message,
      recommendation: fallbackRecommendation,
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
