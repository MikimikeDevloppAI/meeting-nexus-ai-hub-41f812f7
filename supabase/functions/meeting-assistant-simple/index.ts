
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
    const { meetingId, userMessage, conversationHistory } = await req.json();
    
    console.log('[SIMPLE-ASSISTANT] 🤖 Traitement demande:', userMessage);
    console.log('[SIMPLE-ASSISTANT] 🆔 Meeting ID:', meetingId);
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('[SIMPLE-ASSISTANT] ❌ OpenAI API key non configurée');
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Récupérer le contexte complet de la réunion avec timeout
    console.log('[SIMPLE-ASSISTANT] 📋 Récupération contexte réunion...');
    
    const meetingPromise = supabase
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .single();

    const todosPromise = supabase
      .from('todos')
      .select(`
        *,
        participants(name),
        todo_participants(
          participant_id,
          participants(id, name, email)
        ),
        todo_ai_recommendations(*),
        todo_comments(*)
      `)
      .eq('meeting_id', meetingId)
      .eq('status', 'confirmed');

    const participantsPromise = supabase
      .from('meeting_participants')
      .select('participants(*)')
      .eq('meeting_id', meetingId);

    // Exécuter toutes les requêtes en parallèle avec timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database timeout')), 5000)
    );

    const [meetingResult, todosResult, participantsResult] = await Promise.race([
      Promise.all([meetingPromise, todosPromise, participantsPromise]),
      timeoutPromise
    ]) as any;

    if (meetingResult.error) {
      throw meetingResult.error;
    }
    if (todosResult.error) {
      throw todosResult.error;
    }
    if (participantsResult.error) {
      throw participantsResult.error;
    }

    const meeting = meetingResult.data;
    const todos = todosResult.data || [];
    const participants = participantsResult.data || [];

    console.log('[SIMPLE-ASSISTANT] ✅ Données récupérées:', {
      meeting: meeting.title,
      todos: todos.length,
      participants: participants.length
    });

    // Construire le contexte pour l'IA
    const meetingContext = {
      title: meeting.title,
      date: meeting.created_at,
      summary: meeting.summary || 'Pas de résumé disponible',
      transcript: meeting.transcript || 'Pas de transcript disponible',
      participants: participants.map(p => p.participants.name).join(', '),
      todos: todos.map(todo => ({
        id: todo.id,
        description: todo.description,
        assignedTo: todo.todo_participants?.map(tp => tp.participants.name).join(', ') || 'Non assigné',
        recommendation: todo.todo_ai_recommendations?.[0]?.recommendation_text || 'Aucune',
        emailDraft: todo.todo_ai_recommendations?.[0]?.email_draft || null,
        comments: todo.todo_comments?.map(c => c.comment).join('\n') || 'Aucun commentaire'
      }))
    };

    console.log('[SIMPLE-ASSISTANT] 🧠 Préparation prompt pour GPT-4...');

    const systemPrompt = `Tu es l'assistant IA du cabinet d'ophtalmologie Dr Tabibian à Genève, spécialisé dans la gestion des réunions.

CONTEXTE RÉUNION ACTUELLE :
Titre: ${meetingContext.title}
Date: ${new Date(meetingContext.date).toLocaleDateString('fr-FR')}
Participants: ${meetingContext.participants}

RÉSUMÉ ACTUEL :
${meetingContext.summary}

TÂCHES ACTUELLES (${meetingContext.todos.length}) :
${meetingContext.todos.map((todo, i) => `
${i+1}. [ID: ${todo.id}] ${todo.description}
   - Assigné à: ${todo.assignedTo}
   - Recommandation: ${todo.recommendation}
   ${todo.emailDraft ? '   - Email pré-rédigé: Disponible' : ''}
   - Commentaires: ${todo.comments}
`).join('')}

TRANSCRIPT (extrait) :
${meetingContext.transcript.substring(0, 2000)}...

CAPACITÉS :
- Modifier/créer/supprimer des tâches
- Modifier/créer des recommandations IA
- Modifier le résumé de réunion
- Réassigner des tâches à d'autres participants
- Créer des emails pré-rédigés
- Analyser le contexte complet pour des suggestions pertinentes

INSTRUCTIONS IMPORTANTES :
1. Comprends la demande de l'utilisateur dans le contexte de cette réunion
2. Propose des actions concrètes (créer, modifier, supprimer)
3. Justifie tes propositions avec le contexte disponible
4. Sois précis sur les IDs des tâches à modifier
5. Adapte ton ton professionnel au contexte médical
6. TOUJOURS fournir un retour détaillé sur les actions que tu vas effectuer
7. Explique clairement ce qui va être modifié/créé/supprimé

IMPORTANT: Tu dois TOUJOURS répondre de manière conversationnelle ET proposer des actions concrètes.

Réponds UNIQUEMENT en JSON avec cette structure exacte :
{
  "response": "ta réponse conversationnelle détaillée à l'utilisateur, expliquant ce que tu vas faire et pourquoi",
  "actions": [
    {
      "type": "create_todo | update_todo | delete_todo | update_summary | create_recommendation | update_recommendation",
      "data": {},
      "explanation": "explication détaillée de cette action spécifique"
    }
  ],
  "needsConfirmation": false,
  "confirmationMessage": ""
}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ];

    console.log('[SIMPLE-ASSISTANT] 🧠 Appel OpenAI API...');

    // Appel OpenAI avec timeout
    const openAITimeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('OpenAI timeout')), 15000)
    );

    const openAIPromise = fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    const response = await Promise.race([openAIPromise, openAITimeoutPromise]) as Response;

    console.log('[SIMPLE-ASSISTANT] 📡 Statut réponse OpenAI:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SIMPLE-ASSISTANT] ❌ Erreur OpenAI API:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiData = await response.json();
    console.log('[SIMPLE-ASSISTANT] ✅ Réponse OpenAI reçue');

    let aiResponse;
    try {
      const aiContent = aiData.choices[0].message.content;
      console.log('[SIMPLE-ASSISTANT] 📝 Contenu brut (premiers 200 chars):', aiContent.substring(0, 200) + '...');
      
      // Extraire le JSON de la réponse
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResponse = JSON.parse(jsonMatch[0]);
        console.log('[SIMPLE-ASSISTANT] ✅ JSON parsé avec succès');
        
        if (!aiResponse.response) {
          throw new Error('Réponse manquante dans la structure JSON');
        }
        
        if (!Array.isArray(aiResponse.actions)) {
          aiResponse.actions = [];
        }
        
      } else {
        console.error('[SIMPLE-ASSISTANT] ❌ Aucun JSON trouvé dans la réponse');
        aiResponse = {
          response: "Je comprends votre demande, mais j'ai rencontré un problème technique. Pouvez-vous la reformuler ?",
          actions: [],
          needsConfirmation: false
        };
      }
    } catch (parseError) {
      console.error('[SIMPLE-ASSISTANT] ❌ Erreur parsing JSON:', parseError);
      aiResponse = {
        response: "Je comprends votre demande, mais j'ai rencontré un problème technique lors du traitement. Pouvez-vous reformuler votre demande de manière plus précise ?",
        actions: [],
        needsConfirmation: false
      };
    }

    // Exécuter les actions
    const executedActions = [];
    
    for (const action of aiResponse.actions || []) {
      try {
        console.log(`[SIMPLE-ASSISTANT] 🚀 Exécution action: ${action.type}`);
        
        switch (action.type) {
          case 'create_todo':
            const { error: createTodoError } = await supabase
              .from('todos')
              .insert({
                meeting_id: meetingId,
                description: action.data.description,
                assigned_to: action.data.assigned_to || null,
                due_date: action.data.due_date || null,
                status: 'confirmed'
              });
            
            if (createTodoError) throw createTodoError;
            
            executedActions.push({
              ...action,
              success: true,
              result: "Tâche créée avec succès"
            });
            break;
            
          case 'update_todo':
            const updateData: any = {};
            if (action.data.description) updateData.description = action.data.description;
            if (action.data.assigned_to) updateData.assigned_to = action.data.assigned_to;
            if (action.data.due_date) updateData.due_date = action.data.due_date;
            
            const { error: updateTodoError } = await supabase
              .from('todos')
              .update(updateData)
              .eq('id', action.data.todo_id);
            
            if (updateTodoError) throw updateTodoError;
            
            executedActions.push({
              ...action,
              success: true,
              result: "Tâche mise à jour avec succès"
            });
            break;
            
          case 'delete_todo':
            const { error: deleteTodoError } = await supabase
              .from('todos')
              .delete()
              .eq('id', action.data.todo_id);
            
            if (deleteTodoError) throw deleteTodoError;
            
            executedActions.push({
              ...action,
              success: true,
              result: "Tâche supprimée avec succès"
            });
            break;
            
          case 'update_summary':
            const { error: updateSummaryError } = await supabase
              .from('meetings')
              .update({ summary: action.data.new_summary })
              .eq('id', meetingId);
            
            if (updateSummaryError) throw updateSummaryError;
            
            executedActions.push({
              ...action,
              success: true,
              result: "Résumé mis à jour avec succès"
            });
            break;
            
          case 'create_recommendation':
            const { error: createRecError } = await supabase
              .from('todo_ai_recommendations')
              .insert({
                todo_id: action.data.todo_id,
                recommendation_text: action.data.recommendation,
                email_draft: action.data.email_draft || null
              });
            
            if (createRecError) throw createRecError;
            
            executedActions.push({
              ...action,
              success: true,
              result: "Recommandation créée avec succès"
            });
            break;
            
          case 'update_recommendation':
            const { error: updateRecError } = await supabase
              .from('todo_ai_recommendations')
              .update({
                recommendation_text: action.data.recommendation,
                email_draft: action.data.email_draft || null,
                updated_at: new Date().toISOString()
              })
              .eq('todo_id', action.data.todo_id);
            
            if (updateRecError) throw updateRecError;
            
            executedActions.push({
              ...action,
              success: true,
              result: "Recommandation mise à jour avec succès"
            });
            break;
            
          default:
            console.log(`[SIMPLE-ASSISTANT] ⚠️ Action non reconnue: ${action.type}`);
            executedActions.push({
              ...action,
              success: false,
              error: "Type d'action non reconnu"
            });
        }
      } catch (error) {
        console.error(`[SIMPLE-ASSISTANT] ❌ Erreur action ${action.type}:`, error);
        executedActions.push({
          ...action,
          success: false,
          error: error.message
        });
      }
    }

    console.log('[SIMPLE-ASSISTANT] ✅ Actions terminées:', executedActions.length);

    const finalResponse = {
      response: aiResponse.response,
      actions: executedActions,
      needsConfirmation: aiResponse.needsConfirmation || false,
      confirmationMessage: aiResponse.confirmationMessage || "",
      success: true
    };

    console.log('[SIMPLE-ASSISTANT] 🚀 Envoi réponse finale');

    return new Response(JSON.stringify(finalResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[SIMPLE-ASSISTANT] ❌ ERREUR GLOBALE:', error);
    
    const errorResponse = { 
      error: error.message,
      response: "Une erreur s'est produite lors du traitement de votre demande. Détails: " + error.message,
      actions: [],
      success: false
    };
    
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
