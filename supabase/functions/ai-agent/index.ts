import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { DatabaseAgent } from './agents/database.ts';
import { EmbeddingsAgent } from './agents/embeddings.ts';
import { TaskAgent } from './agents/tasks.ts';
import { CoordinatorAgent } from './agents/coordinator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const apiKey = Deno.env.get('OPENAI_API_KEY');
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

    console.log('[AI-AGENT-CABINET-MEDICAL] ✉️ Message reçu:', message.substring(0, 100));
    console.log('[AI-AGENT-CABINET-MEDICAL] 📜 Historique conversation:', conversationHistory.length, 'messages');

    // Enrich message with conversation history for analysis
    const enrichedMessage = `${message}\n\n${conversationHistory.slice(-5).map((msg: any) => `${msg.isUser ? 'User' : 'Assistant'}: ${msg.content}`).join('\n')}`;

    // 🎯 DÉTECTION SPÉCIALE : Mode recherche de documents UNIQUEMENT vectorielle
    if (context.documentSearchMode || context.forceEmbeddingsPriority || context.vectorSearchOnly) {
      console.log('[AI-AGENT-CABINET-MEDICAL] 🔍 MODE RECHERCHE DOCUMENTS VECTORIELLE - Historique transmis');
      
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

      // Générer une réponse directe en utilisant OpenAI avec historique
      let response = '';
      let actuallyUsedDocuments: string[] = [];
      
      if (embeddingsResult.hasRelevantContext && embeddingsResult.chunks.length > 0) {
        // Construire le contexte pour OpenAI avec les IDs des documents
        const contextText = embeddingsResult.chunks.slice(0, 5).map((chunk, index) => {
          return `Document ID: ${chunk.document_id}\nDocument: ${chunk.document_name || 'Inconnu'}\nContenu: ${chunk.chunk_text}`;
        }).join('\n\n---\n\n');

        // Construire l'historique de conversation
        const conversationContext = conversationHistory.length > 0
          ? '\n\nHISTORIQUE DE CONVERSATION:\n' + 
            conversationHistory.slice(-8).map((msg: any) => `${msg.isUser ? 'Utilisateur' : 'Assistant'}: ${msg.content}`).join('\n')
          : '';

        const prompt = `Tu es l'assistant IA spécialisé OphtaCare pour le cabinet d'ophtalmologie Dr Tabibian à Genève. Tu dois fournir des réponses TRÈS DÉTAILLÉES et COMPLÈTES.

INSTRUCTIONS IMPORTANTES :
- Sois EXTRÊMEMENT DÉTAILLÉ dans tes réponses
- Développe tous les aspects pertinents du sujet
- Fournis des explications approfondies et structurées
- Utilise des exemples concrets quand c'est possible
- Structure tes réponses avec des sections claires
- N'hésite pas à donner des informations contextuelles supplémentaires
- Sois précis et professionnel tout en étant exhaustif

IMPORTANT POUR LES SOURCES :
À la fin de ta réponse, tu DOIS ajouter une section spéciale qui liste UNIQUEMENT les Document IDs que tu as RÉELLEMENT utilisés pour formuler ta réponse. Utilise ce format exact :

[DOCUMENTS_UTILISÉS]
- ID_DU_DOCUMENT_1
- ID_DU_DOCUMENT_2
(etc.)
[/DOCUMENTS_UTILISÉS]

Ne liste que les documents dont tu as vraiment lu et utilisé le contenu pour ta réponse. Si tu n'as utilisé aucun document spécifique, écris [DOCUMENTS_UTILISÉS]Aucun[/DOCUMENTS_UTILISÉS]

Question de l'utilisateur: "${message}"

CONTEXTE CONVERSATIONNEL:${conversationContext}

CONTEXTE DES DOCUMENTS TROUVÉS:
${contextText}

Réponds de manière TRÈS DÉTAILLÉE et COMPLÈTE en utilisant les informations des documents ET en tenant compte du contexte de la conversation. Si les informations ne sont pas suffisantes, explique clairement ce qui manque et suggère des pistes. Maintiens la cohérence avec l'historique de conversation. Développe tous les aspects pertinents de ta réponse.`;

        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 16384,
          }),
        });

        if (openaiResponse.ok) {
          const data = await openaiResponse.json();
          const fullResponse = data.choices[0]?.message?.content || 'Désolé, je n\'ai pas pu générer une réponse.';
          
          // Extraire la liste des documents utilisés
          const usedDocsMatch = fullResponse.match(/\[DOCUMENTS_UTILISÉS\](.*?)\[\/DOCUMENTS_UTILISÉS\]/s);
          if (usedDocsMatch) {
            const usedDocsSection = usedDocsMatch[1].trim();
            if (usedDocsSection !== 'Aucun') {
              // Extraire les IDs des documents
              actuallyUsedDocuments = usedDocsSection
                .split('\n')
                .map(line => line.replace(/^- /, '').trim())
                .filter(id => id && id !== '');
            }
            // Nettoyer la réponse en supprimant la section des documents utilisés
            response = fullResponse.replace(/\[DOCUMENTS_UTILISÉS\].*?\[\/DOCUMENTS_UTILISÉS\]/s, '').trim();
          } else {
            response = fullResponse;
          }
          
          console.log('[AI-AGENT-CABINET-MEDICAL] 📄 Documents explicitement utilisés:', actuallyUsedDocuments);
        } else {
          response = `J'ai trouvé ${embeddingsResult.chunks.length} élément(s) pertinent(s) dans vos documents, mais je n'ai pas pu générer une réponse détaillée.`;
        }
      } else {
        response = 'Je n\'ai pas trouvé d\'informations pertinentes dans vos documents pour cette requête. Essayez de reformuler votre question ou vérifiez que les documents contiennent les informations recherchées.';
      }

      return new Response(
        JSON.stringify({ 
          response,
          sources: embeddingsResult.sources || [],
          actuallyUsedDocuments,
          hasRelevantContext: embeddingsResult.hasRelevantContext,
          searchIterations: embeddingsResult.searchIterations || 0,
          conversationLength: conversationHistory.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[AI-AGENT-CABINET-MEDICAL] 🧠 Phase 1: Analyse intelligente avec historique');
    const analysis = await coordinator.analyzeQuery(enrichedMessage, conversationHistory);
    
    console.log(`[AI-AGENT-CABINET-MEDICAL] 📊 Analyse optimisée: ${JSON.stringify({
      queryType: analysis.queryType,
      priority: analysis.priority,
      confidence: analysis.confidence,
      temporalRef: analysis.temporalRef,
      isSimple: analysis.queryType === 'simple',
      embeddings: analysis.embeddings,
      database: analysis.database,
      tasks: analysis.tasks,
      internet: analysis.internet,
      historyLength: conversationHistory.length
    })}`);

    let embeddingsResult = { chunks: [], sources: [], hasRelevantContext: false };
    let taskContext = { currentTasks: [], hasTaskContext: false };
    let databaseContext = { meetings: [], documents: [], participants: [], todos: [] };

    // 🎯 TRAITEMENT SPÉCIAL: Recherche vectorielle + tâches prioritaire
    if (analysis.priority === 'embeddings_and_tasks') {
      console.log('[AI-AGENT-CABINET-MEDICAL] 🎯 Phase spéciale: RECHERCHE VECTORIELLE + TÂCHES COMBINÉE');
      
      // Phase 1: Recherche vectorielle avec historique
      console.log('[AI-AGENT-CABINET-MEDICAL] 🔍 Phase 1a: Recherche vectorielle avec historique');
      embeddingsResult = await embeddings.searchEmbeddings(message, analysis, [], conversationHistory);
      
      // Phase 1: Recherche tâches spécialisée avec historique
      console.log('[AI-AGENT-CABINET-MEDICAL] 📋 Phase 1b: Recherche tâches avec historique');
      taskContext = await taskAgent.handleTaskRequest(message, analysis, conversationHistory);
      
      // Phase 2: Recherche database complémentaire
      console.log('[AI-AGENT-CABINET-MEDICAL] 🗄️ Phase 2: Recherche database complémentaire');
      databaseContext = await database.searchContext(enrichedMessage);
    }
    // Traitement existant pour les autres priorités
    else if (analysis.priority === 'direct') {
      console.log('[AI-AGENT-CABINET-MEDICAL] ✨ Phase Direct: Réponse directe sans recherche');
      return new Response(
        JSON.stringify({ 
          response: 'Bonjour ! Comment puis-je vous aider ?',
          conversationLength: conversationHistory.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    else {
      // Phase 2: Recherche embeddings si nécessaire avec historique
      if (analysis.embeddings) {
        console.log('[AI-AGENT-CABINET-MEDICAL] 🔍 Phase 2: Recherche embeddings avec historique');
        embeddingsResult = await embeddings.searchEmbeddings(message, analysis, [], conversationHistory);
      }

      // Phase 3: Recherche database complémentaire
      if (analysis.database) {
        console.log('[AI-AGENT-CABINET-MEDICAL] 🗄️ Phase 3: Recherche database complémentaire');
        databaseContext = await database.searchContext(enrichedMessage);
      }

      // Phase 4: Gestion spécialisée des tâches avec historique
      if (analysis.tasks) {
        console.log('[AI-AGENT-CABINET-MEDICAL] 📋 Phase 4: Gestion tâches avec historique');
        taskContext = await taskAgent.handleTaskRequest(message, analysis, conversationHistory);
      }
    }

    // Synthèse et réponse avec prise en compte de l'historique
    console.log('[AI-AGENT-CABINET-MEDICAL] 🤖 Synthèse réponse avec historique...');
    let combinedSources = [
      ...embeddingsResult.sources || [],
    ];

    // Ajouter les participants au contexte pour les assigner aux tâches
    let contextParticipants = '';
    if (databaseContext.participants && databaseContext.participants.length > 0) {
      contextParticipants = `CONTEXT_PARTICIPANTS: ${databaseContext.participants.map(p => `${p.name} (${p.email} ID: ${p.id})`).join(', ')}`;
    }

    // Construire la réponse avec contexte d'historique
    let response = '';

    if (embeddingsResult.hasRelevantContext) {
      response += '🔍 Contexte pertinent trouvé dans vos documents.\n';
    }

    if (taskContext.hasTaskContext && taskContext.currentTasks.length > 0) {
      response += '✅ Tâches correspondantes trouvées :\n';
      taskContext.currentTasks.forEach((task: any) => {
        response += `- ${task.description} (ID: ${task.id})\n`;
      });
    }

    if (databaseContext.meetings && databaseContext.meetings.length > 0) {
      response += '📅 Réunions correspondantes trouvées :\n';
      databaseContext.meetings.forEach((meeting: any) => {
        response += `- ${meeting.name} (ID: ${meeting.id})\n`;
      });
    }

    if (taskContext.pendingTaskCreation && taskContext.pendingTaskCreation.waitingForAssignment) {
      response = `D'accord, je vais créer la tâche "${taskContext.pendingTaskCreation.description}". À qui devrais-je assigner cette tâche ? ${contextParticipants}`;
    } else if (taskContext.taskCreated) {
      response = `Parfait ! J'ai créé la tâche "${taskContext.taskCreated.description}".`;
    } else if (response === '') {
      response = 'Désolé, je n\'ai pas trouvé d\'informations pertinentes. Pouvez-vous reformuler votre question ?';
    }

    // Ajouter le contexte des participants à la réponse
    response += `\n${contextParticipants}`;

    console.log('[AI-AGENT-CABINET-MEDICAL] ✅ Réponse synthétisée avec historique:', response.substring(0, 200));

    return new Response(
      JSON.stringify({ 
        response,
        sources: combinedSources,
        taskContext,
        databaseContext,
        analysis,
        conversationLength: conversationHistory.length
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
