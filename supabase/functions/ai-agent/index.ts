
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { DatabaseAgent } from './agents/database.ts';
import { EmbeddingsAgent } from './agents/embeddings.ts';
import { TaskAgent } from './agents/tasks.ts';
import { CoordinatorAgent } from './agents/coordinator.ts';
import { SynthesisAgent } from './agents/synthesis.ts';
import { InternetAgent } from './agents/internet.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const apiKey = Deno.env.get('OPENAI_API_KEY');
const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');

if (!apiKey || !supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables');
  Deno.exit(1);
}

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const supabaseClient = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { message, context = {}, conversationHistory = [] } = await req.json();

    // Initialize agents
    const database = new DatabaseAgent(supabaseClient);
    const embeddings = new EmbeddingsAgent(apiKey, supabaseClient);
    const taskAgent = new TaskAgent(supabaseClient);
    const coordinator = new CoordinatorAgent(apiKey);
    const synthesis = new SynthesisAgent(apiKey);
    const internet = new InternetAgent(perplexityApiKey || '');

    console.log('[AI-AGENT-CABINET-MEDICAL] ✉️ Message reçu:', message.substring(0, 100));
    console.log('[AI-AGENT-CABINET-MEDICAL] 📜 Historique conversation:', conversationHistory.length, 'messages');

    // 🎯 DÉTECTION SPÉCIALE : Mode recherche de documents UNIQUEMENT vectorielle (conservé pour compatibilité)
    if (context.documentSearchMode || context.forceEmbeddingsPriority || context.vectorSearchOnly) {
      console.log('[AI-AGENT-CABINET-MEDICAL] 🔍 MODE RECHERCHE DOCUMENTS VECTORIELLE - Restrictions STRICTES activées');
      
      const embeddingsResult = await embeddings.searchEmbeddings(message, {
        priority: 'embeddings',
        embeddings: true,
        database: false,
        tasks: false,
        internet: false,
        queryType: 'document',
        confidence: 0.9
      }, [], conversationHistory);

      console.log('[AI-AGENT-CABINET-MEDICAL] 📊 Résultats embeddings:', embeddingsResult.chunks?.length || 0, 'chunks trouvés');

      let response = '';
      let actuallyUsedDocuments: string[] = [];
      
      // VÉRIFICATION STRICTE : Si pas de chunks pertinents, réponse standard
      if (!embeddingsResult.hasRelevantContext || embeddingsResult.chunks.length === 0) {
        console.log('[AI-AGENT-CABINET-MEDICAL] ⚠️ AUCUN CHUNK PERTINENT - Réponse standard');
        response = 'Je n\'ai pas trouvé d\'informations pertinentes dans les documents du cabinet pour répondre à cette question. Les documents disponibles ne contiennent pas les informations recherchées.';
        
        return new Response(
          JSON.stringify({ 
            response,
            sources: [],
            actuallyUsedDocuments: [],
            hasRelevantContext: false,
            searchIterations: embeddingsResult.searchIterations || 0,
            conversationLength: conversationHistory.length,
            debugInfo: {
              totalChunks: 0,
              totalSources: 0,
              usedDocsCount: 0,
              restrictionMode: 'STRICT_DOCUMENTS_ONLY'
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Construire le contexte pour OpenAI avec les IDs des documents
      const contextText = embeddingsResult.chunks.slice(0, 5).map((chunk, index) => {
        return `Document ID: ${chunk.document_id}\nDocument: ${chunk.document_name || 'Inconnu'}\nContenu: ${chunk.chunk_text}`;
      }).join('\n\n---\n\n');

      // Construire l'historique de conversation
      const conversationContext = conversationHistory.length > 0
        ? '\n\nHISTORIQUE DE CONVERSATION:\n' + 
          conversationHistory.slice(-8).map((msg: any) => `${msg.isUser ? 'Utilisateur' : 'Assistant'}: ${msg.content}`).join('\n')
        : '';

      // PROMPT ULTRA-STRICT pour empêcher l'invention
      const prompt = `Tu es l'assistant IA spécialisé OphtaCare pour le cabinet d'ophtalmologie Dr Tabibian à Genève.

🔒 RÈGLES ABSOLUES - INTERDICTION TOTALE :
- Tu es FORMELLEMENT INTERDIT d'utiliser tes connaissances générales
- Tu ne peux répondre qu'en te basant EXCLUSIVEMENT sur le contenu des documents fournis ci-dessous
- Si les documents fournis ne contiennent pas la réponse à la question, tu DOIS répondre : "Les documents du cabinet ne contiennent pas d'informations sur ce sujet"
- Tu ne peux PAS inventer, déduire ou extrapoler au-delà du contenu exact des documents
- Tu ne peux PAS donner de conseils médicaux généraux non présents dans les documents

✅ CE QUE TU PEUX FAIRE :
- Citer EXACTEMENT le contenu des documents fournis
- Reformuler les informations présentes dans les documents
- Structurer les informations trouvées dans les documents
- Mentionner que les informations proviennent des documents du cabinet

IMPORTANT POUR LES SOURCES - FORMAT OBLIGATOIRE :
À la fin de ta réponse, tu DOIS ajouter une section qui liste UNIQUEMENT les Document IDs que tu as RÉELLEMENT utilisés pour formuler ta réponse. Utilise ce format EXACT :

DOCS_USED:
id1,id2,id3
END_DOCS

⚠️ ATTENTION : Si tu n'as PAS utilisé de documents spécifiques pour ta réponse (ce qui ne devrait JAMAIS arriver car tu ne peux répondre que basé sur les documents), écris DOCS_USED:none END_DOCS

Question de l'utilisateur: "${message}"

CONTEXTE CONVERSATIONNEL:${conversationContext}

CONTEXTE DES DOCUMENTS DU CABINET (SEULE SOURCE AUTORISÉE):
${contextText}

Réponds UNIQUEMENT en te basant sur le contenu exact des documents fournis ci-dessus. Si ces documents ne contiennent pas l'information demandée, dis-le clairement.`;

        console.log('[AI-AGENT-CABINET-MEDICAL] 🔒 Envoi à OpenAI avec prompt ULTRA-STRICT');

        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1, // Température très basse pour éviter l'invention
            max_tokens: 16384,
          }),
        });

        if (openaiResponse.ok) {
          const data = await openaiResponse.json();
          const fullResponse = data.choices[0]?.message?.content || 'Désolé, je n\'ai pas pu générer une réponse basée sur les documents.';
          
          console.log('[AI-AGENT-CABINET-MEDICAL] 📝 RÉPONSE COMPLÈTE D\'OPENAI:');
          console.log(fullResponse);
          
          // Extraction robuste des documents utilisés
          const docsUsedMatch = fullResponse.match(/DOCS_USED:\s*(.*?)\s*END_DOCS/s);
          console.log('[AI-AGENT-CABINET-MEDICAL] 🔍 Match trouvé:', docsUsedMatch);
          
          if (docsUsedMatch) {
            const docsSection = docsUsedMatch[1].trim();
            console.log('[AI-AGENT-CABINET-MEDICAL] 📋 Section docs extraite:', docsSection);
            
            // VÉRIFICATION STRICTE : Si l'IA dit "none", on force une réponse standard
            if (docsSection === 'none' || docsSection === '') {
              console.log('[AI-AGENT-CABINET-MEDICAL] ⚠️ IA A RÉPONDU "none" - FORÇAGE RÉPONSE STANDARD');
              response = 'Les documents du cabinet ne contiennent pas d\'informations spécifiques sur ce sujet. Pouvez-vous reformuler votre question ou demander des informations présentes dans nos documents ?';
              actuallyUsedDocuments = [];
            } else {
              // Séparer les IDs par virgule et nettoyer
              actuallyUsedDocuments = docsSection
                .split(',')
                .map(id => id.trim())
                .filter(id => id && id !== '');
                
              // Nettoyer la réponse en supprimant la section des documents utilisés
              response = fullResponse.replace(/DOCS_USED:.*?END_DOCS/s, '').trim();
            }
          } else {
            console.log('[AI-AGENT-CABINET-MEDICAL] ⚠️ Aucun match DOCS_USED trouvé - FORÇAGE RÉPONSE STANDARD');
            response = 'Les documents du cabinet ne contiennent pas d\'informations spécifiques sur ce sujet. Pouvez-vous reformuler votre question ?';
            actuallyUsedDocuments = [];
          }
          
          console.log('[AI-AGENT-CABINET-MEDICAL] 📄 Documents explicitement utilisés extraits:', actuallyUsedDocuments);
          console.log('[AI-AGENT-CABINET-MEDICAL] 📝 Réponse nettoyée (premiers 200 chars):', response.substring(0, 200));
        } else {
          console.error('[AI-AGENT-CABINET-MEDICAL] ❌ Erreur OpenAI:', await openaiResponse.text());
          response = 'Je n\'ai pas pu traiter votre demande en me basant sur les documents disponibles. Veuillez réessayer.';
          actuallyUsedDocuments = [];
        }

      console.log('[AI-AGENT-CABINET-MEDICAL] 🎯 RÉSULTAT FINAL STRICT:');
      console.log('- Documents utilisés:', actuallyUsedDocuments.length);
      console.log('- Sources disponibles:', embeddingsResult.sources?.length || 0);
      console.log('- Chunks trouvés:', embeddingsResult.chunks?.length || 0);
      console.log('- Mode restriction:', 'DOCUMENTS_ONLY');

      return new Response(
        JSON.stringify({ 
          response,
          sources: embeddingsResult.sources || [],
          actuallyUsedDocuments,
          hasRelevantContext: embeddingsResult.hasRelevantContext,
          searchIterations: embeddingsResult.searchIterations || 0,
          conversationLength: conversationHistory.length,
          debugInfo: {
            totalChunks: embeddingsResult.chunks?.length || 0,
            totalSources: embeddingsResult.sources?.length || 0,
            usedDocsCount: actuallyUsedDocuments.length,
            restrictionMode: 'STRICT_DOCUMENTS_ONLY',
            promptUsed: 'ULTRA_STRICT'
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 🚀 NOUVEAU SYSTÈME : EXÉCUTION OBLIGATOIRE DE TOUS LES AGENTS
    console.log('[AI-AGENT-CABINET-MEDICAL] 🚀 NOUVEAU SYSTÈME: Exécution complète de tous les agents');

    // Phase 1: Analyse initiale
    console.log('[AI-AGENT-CABINET-MEDICAL] 🧠 Phase 1: Analyse intelligente avec historique');
    const analysis = await coordinator.analyzeQuery(message, conversationHistory);
    
    console.log(`[AI-AGENT-CABINET-MEDICAL] 📊 Analyse: ${JSON.stringify({
      queryType: analysis.queryType,
      priority: analysis.priority,
      confidence: analysis.confidence,
      temporalRef: analysis.temporalRef,
      historyLength: conversationHistory.length
    })}`);

    // Phase 1.5: NOUVELLE FONCTIONNALITÉ - Détection et gestion des points de préparation
    console.log('[AI-AGENT-CABINET-MEDICAL] 📝 Phase 1.5: Vérification points préparation réunion');
    const lowerMessage = message.toLowerCase();
    const isMeetingPreparationQuery = lowerMessage.includes('ordre du jour') || 
                                     lowerMessage.includes('points') || 
                                     lowerMessage.includes('préparation') ||
                                     lowerMessage.includes('réunion') ||
                                     (lowerMessage.includes('ajouter') && lowerMessage.includes('point')) ||
                                     (lowerMessage.includes('supprimer') && lowerMessage.includes('point'));

    let meetingPreparationResult = null;
    if (isMeetingPreparationQuery) {
      console.log('[AI-AGENT-CABINET-MEDICAL] 📝 Requête points préparation détectée');
      const userId = context.userId || 'system';
      meetingPreparationResult = await database.handleMeetingPreparationRequest(message, userId);
      console.log('[AI-AGENT-CABINET-MEDICAL] 📝 Résultat préparation:', meetingPreparationResult);
    }

    // Phase 2: EXÉCUTION FORCÉE DE TOUS LES AGENTS
    console.log('[AI-AGENT-CABINET-MEDICAL] 🔄 Phase 2: Exécution FORCÉE de tous les agents');

    // 2a: Recherche vectorielle (TOUJOURS)
    console.log('[AI-AGENT-CABINET-MEDICAL] 🔍 Phase 2a: Recherche vectorielle FORCÉE');
    const embeddingsResult = await embeddings.searchEmbeddings(message, {
      ...analysis,
      embeddings: true
    }, [], conversationHistory);

    console.log(`[AI-AGENT-CABINET-MEDICAL] 📊 Embeddings: ${embeddingsResult.chunks?.length || 0} chunks trouvés`);

    // 2b: Recherche base de données (TOUJOURS)
    console.log('[AI-AGENT-CABINET-MEDICAL] 🗄️ Phase 2b: Recherche base de données FORCÉE');
    const databaseContext = await database.searchContext(message);

    console.log(`[AI-AGENT-CABINET-MEDICAL] 📊 Database: ${databaseContext.meetings?.length || 0} réunions, ${databaseContext.documents?.length || 0} documents, ${databaseContext.participants?.length || 0} participants`);

    // 2c: Gestion des tâches (TOUJOURS)
    console.log('[AI-AGENT-CABINET-MEDICAL] 📋 Phase 2c: Gestion tâches FORCÉE');
    const taskContext = await taskAgent.handleTaskRequest(message, analysis, conversationHistory);

    console.log(`[AI-AGENT-CABINET-MEDICAL] 📊 Tasks: ${taskContext.currentTasks?.length || 0} tâches trouvées, création: ${taskContext.taskCreated ? 'OUI' : 'NON'}`);

    // 2d: NOUVEAU - Recherche internet (ACTIVÉE)
    console.log('[AI-AGENT-CABINET-MEDICAL] 🌐 Phase 2d: Recherche internet ACTIVÉE');
    let internetContext = { hasContent: false, content: '', sources: [] };
    
    // Détection du besoin de recherche internet
    const needsInternet = analysis.requiresInternet || 
                         analysis.queryType === 'contact_search' ||
                         lowerMessage.includes('recherche') || 
                         lowerMessage.includes('internet') || 
                         lowerMessage.includes('web') ||
                         lowerMessage.includes('contact') ||
                         lowerMessage.includes('coordonnées') ||
                         lowerMessage.includes('fournisseur') ||
                         lowerMessage.includes('trouve') ||
                         (!embeddingsResult.hasRelevantContext && !databaseContext.meetings?.length && !taskContext.currentTasks?.length);

    if (needsInternet && perplexityApiKey) {
      console.log('[AI-AGENT-CABINET-MEDICAL] 🌐 Exécution recherche internet avec Perplexity');
      try {
        internetContext = await internet.searchInternet(
          message, 
          analysis, 
          embeddingsResult.hasRelevantContext || databaseContext.meetings?.length > 0 || taskContext.currentTasks?.length > 0
        );
        console.log(`[AI-AGENT-CABINET-MEDICAL] 🌐 Internet: ${internetContext.hasContent ? 'Contenu trouvé' : 'Pas de contenu'}`);
      } catch (error) {
        console.error('[AI-AGENT-CABINET-MEDICAL] ❌ Erreur recherche internet:', error);
      }
    } else {
      console.log('[AI-AGENT-CABINET-MEDICAL] 🌐 Recherche internet ignorée:', { needsInternet, hasPerplexityKey: !!perplexityApiKey });
    }

    // Phase 3: Synthèse complète avec TOUS les résultats
    console.log('[AI-AGENT-CABINET-MEDICAL] 🤖 Phase 3: Synthèse COMPLÈTE avec tous les agents');

    const response = await synthesis.synthesizeResponse(
      message,
      conversationHistory,
      databaseContext,
      embeddingsResult,
      internetContext, // VRAIE recherche internet maintenant
      analysis,
      taskContext,
      meetingPreparationResult
    );

    console.log('[AI-AGENT-CABINET-MEDICAL] ✅ Réponse synthétisée complète:', response.substring(0, 200));

    // Combiner toutes les sources
    let combinedSources = [
      ...embeddingsResult.sources || [],
      ...internetContext.sources || []
    ];

    return new Response(
      JSON.stringify({ 
        response,
        sources: combinedSources,
        taskContext,
        databaseContext,
        meetingPreparationResult,
        internetContext,
        analysis,
        conversationLength: conversationHistory.length,
        hasRelevantContext: embeddingsResult.hasRelevantContext,
        contextFound: (embeddingsResult.chunks?.length > 0) || (databaseContext.meetings?.length > 0) || (taskContext.currentTasks?.length > 0) || internetContext.hasContent,
        debugInfo: {
          embeddingsChunks: embeddingsResult.chunks?.length || 0,
          databaseMeetings: databaseContext.meetings?.length || 0,
          databaseDocuments: databaseContext.documents?.length || 0,
          taskCount: taskContext.currentTasks?.length || 0,
          internetUsed: internetContext.hasContent,
          meetingPreparationAction: meetingPreparationResult?.action || 'none',
          executionMode: 'ALL_AGENTS_FORCED_WITH_INTERNET'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[AI-AGENT-CABINET-MEDICAL] ❌ Erreur principale:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
