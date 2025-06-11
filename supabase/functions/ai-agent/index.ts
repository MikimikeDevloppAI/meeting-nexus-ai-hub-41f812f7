import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { DatabaseAgent } from './agents/database.ts';
import { EmbeddingsAgent } from './agents/embeddings.ts';
import { TaskAgent } from './agents/tasks.ts';
import { CoordinatorAgent } from './agents/coordinator.ts';
// import { InternetAgent } from './agents/internet.ts';

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
    const { message, context = {} } = await req.json();

    // Initialize agents
    const database = new DatabaseAgent(supabaseClient);
    const embeddings = new EmbeddingsAgent(apiKey, supabaseClient);
    const taskAgent = new TaskAgent(supabaseClient);
    const coordinator = new CoordinatorAgent(apiKey);
    // const internet = new InternetAgent(apiKey);

    // Extract conversation history from context
    const conversationHistory = context.conversationHistory || [];

    // Enrich message with conversation history
    const enrichedMessage = `${message}\n\n${conversationHistory.slice(-3).map((msg: any) => `${msg.isUser ? 'User' : 'Assistant'}: ${msg.content}`).join('\n')}`;

    console.log('[AI-AGENT-CABINET-MEDICAL] ✉️ Message reçu:', message.substring(0, 100));
    console.log('[AI-AGENT-CABINET-MEDICAL] 📜 Historique conversation:', conversationHistory.length, 'messages');

    // 🎯 DÉTECTION SPÉCIALE : Mode recherche de documents UNIQUEMENT vectorielle
    if (context.documentSearchMode || context.forceEmbeddingsPriority || context.vectorSearchOnly) {
      console.log('[AI-AGENT-CABINET-MEDICAL] 🔍 MODE RECHERCHE DOCUMENTS VECTORIELLE UNIQUEMENT - Bypass complet des autres agents');
      
      const embeddingsResult = await embeddings.searchEmbeddings(message, {
        priority: 'embeddings',
        embeddings: true,
        database: false,
        tasks: false,
        internet: false,
        queryType: 'document',
        confidence: 0.9
      }, [], conversationHistory);

      console.log('[AI-AGENT-CABINET-MEDICAL] 📊 Résultats embeddings uniquement:', embeddingsResult.chunks?.length || 0, 'chunks trouvés');

      // Générer une réponse directe en utilisant OpenAI avec température 0.3
      let response = '';
      
      if (embeddingsResult.hasRelevantContext && embeddingsResult.chunks.length > 0) {
        // Construire le contexte pour OpenAI
        const contextText = embeddingsResult.chunks.slice(0, 5).map((chunk, index) => {
          return `Document: ${chunk.document_name || 'Inconnu'}\nContenu: ${chunk.chunk_text}`;
        }).join('\n\n---\n\n');

        const prompt = `Basé uniquement sur les informations suivantes trouvées dans les documents, réponds à la question: "${message}"

CONTEXTE DES DOCUMENTS:
${contextText}

Réponds de manière naturelle et précise en utilisant uniquement les informations des documents fournis. Si les informations ne sont pas suffisantes, dis-le clairement.`;

        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
          }),
        });

        if (openaiResponse.ok) {
          const data = await openaiResponse.json();
          response = data.choices[0]?.message?.content || 'Désolé, je n\'ai pas pu générer une réponse.';
        } else {
          response = `J'ai trouvé ${embeddingsResult.chunks.length} élément(s) pertinent(s) dans vos documents.`;
        }
      } else {
        response = 'Je n\'ai pas trouvé d\'informations pertinentes dans vos documents pour cette requête. Essayez de reformuler votre question ou vérifiez que les documents contiennent les informations recherchées.';
      }

      return new Response(
        JSON.stringify({ 
          response,
          sources: embeddingsResult.sources || [],
          hasRelevantContext: embeddingsResult.hasRelevantContext,
          searchIterations: embeddingsResult.searchIterations || 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[AI-AGENT-CABINET-MEDICAL] 🧠 Phase 1: Analyse intelligente avec historique transmis au coordinateur');
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
      
      // Phase 1: Recherche vectorielle en premier
      console.log('[AI-AGENT-CABINET-MEDICAL] 🔍 Phase 1a: Recherche vectorielle prioritaire');
      embeddingsResult = await embeddings.searchEmbeddings(message, analysis, [], conversationHistory);
      
      // Phase 1: Recherche tâches spécialisée
      console.log('[AI-AGENT-CABINET-MEDICAL] 📋 Phase 1b: Recherche tâches spécialisée');
      taskContext = await taskAgent.handleTaskRequest(message, analysis, conversationHistory);
      
      // Phase 2: Recherche database complémentaire
      console.log('[AI-AGENT-CABINET-MEDICAL] 🗄️ Phase 2: Recherche database complémentaire');
      databaseContext = await database.searchContext(enrichedMessage);
    }
    // Traitement existant pour les autres priorités
    else if (analysis.priority === 'direct') {
      console.log('[AI-AGENT-CABINET-MEDICAL] ✨ Phase Direct: Réponse directe sans recherche');
      return new Response(
        JSON.stringify({ response: 'Bonjour ! Comment puis-je vous aider ?' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    else {
      // Phase 2: Recherche embeddings si nécessaire
      if (analysis.embeddings) {
        console.log('[AI-AGENT-CABINET-MEDICAL] 🔍 Phase 2: Recherche embeddings');
        embeddingsResult = await embeddings.searchEmbeddings(message, analysis, [], conversationHistory);
      }

      // Phase 3: Recherche database complémentaire
      if (analysis.database) {
        console.log('[AI-AGENT-CABINET-MEDICAL] 🗄️ Phase 3: Recherche database complémentaire');
        databaseContext = await database.searchContext(enrichedMessage);
      }

      // Phase 4: Gestion spécialisée des tâches
      if (analysis.tasks) {
        console.log('[AI-AGENT-CABINET-MEDICAL] 📋 Phase 4: Gestion tâches spécialisée');
        taskContext = await taskAgent.handleTaskRequest(message, analysis, conversationHistory);
      }

      // Phase 5: Recherche internet si nécessaire
      if (analysis.internet) {
        console.log('[AI-AGENT-CABINET-MEDICAL] 🌐 Phase 5: Recherche internet');
        // const internetResults = await internet.searchInternet(message);
        // console.log('[AI-AGENT-CABINET-MEDICAL] 🌐 Résultats Internet:', internetResults.length, 'sources');
      }
    }

    // Feedback loop
    console.log('[AI-AGENT-CABINET-MEDICAL] 👍 Analyse feedback (TODO)');

    // Synthèse et réponse
    console.log('[AI-AGENT-CABINET-MEDICAL] 🤖 Synthèse réponse...');
    let combinedSources = [
      ...embeddingsResult.sources || [],
    ];

    // Ajouter les participants au contexte pour les assigner aux tâches
    let contextParticipants = '';
    if (databaseContext.participants && databaseContext.participants.length > 0) {
      contextParticipants = `CONTEXT_PARTICIPANTS: ${databaseContext.participants.map(p => `${p.name} (${p.email} ID: ${p.id})`).join(', ')}`;
    }

    // Construire la réponse
    let response = 'Voici les informations que j\'ai trouvées :\n\n';

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
    } else if (response === 'Voici les informations que j\'ai trouvées :\n\n') {
      response = 'Désolé, je n\'ai pas trouvé d\'informations pertinentes.';
    }

    // Ajouter le contexte des participants à la réponse
    response += `\n${contextParticipants}`;

    console.log('[AI-AGENT-CABINET-MEDICAL] ✅ Réponse synthétisée:', response.substring(0, 200));

    return new Response(
      JSON.stringify({ 
        response,
        sources: combinedSources,
        taskContext,
        databaseContext,
        analysis
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
