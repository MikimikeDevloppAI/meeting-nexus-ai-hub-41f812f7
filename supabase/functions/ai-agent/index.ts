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
