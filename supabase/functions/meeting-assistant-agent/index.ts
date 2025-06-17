
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
    
    console.log('[MEETING-ASSISTANT] 🤖 Traitement demande:', userMessage);
    console.log('[MEETING-ASSISTANT] 🆔 Meeting ID:', meetingId);
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('[MEETING-ASSISTANT] ❌ OpenAI API key non configurée');
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Récupérer le contexte complet de la réunion
    console.log('[MEETING-ASSISTANT] 📋 Récupération contexte réunion...');
    
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .single();

    if (meetingError) {
      console.error('[MEETING-ASSISTANT] ❌ Erreur récupération réunion:', meetingError);
      throw meetingError;
    }

    console.log('[MEETING-ASSISTANT] ✅ Réunion trouvée:', meeting.title);

    const { data: todos, error: todosError } = await supabase
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

    if (todosError) {
      console.error('[MEETING-ASSISTANT] ❌ Erreur récupération todos:', todosError);
      throw todosError;
    }

    console.log('[MEETING-ASSISTANT] ✅ Todos trouvées:', todos.length);

    const { data: participants, error: participantsError } = await supabase
      .from('meeting_participants')
      .select('participants(*)')
      .eq('meeting_id', meetingId);

    if (participantsError) {
      console.error('[MEETING-ASSISTANT] ❌ Erreur récupération participants:', participantsError);
      throw participantsError;
    }

    console.log('[MEETING-ASSISTANT] ✅ Participants trouvés:', participants.length);

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

    console.log('[MEETING-ASSISTANT] 🧠 Préparation prompt pour GPT-4...');

    const systemPrompt = `Tu es l'assistant IA du cabinet d'ophtalmologie Dr Tabibian à Genève, spécialisé dans la gestion des réunions. Tu dois fournir des réponses TRÈS DÉTAILLÉES et COMPLÈTES.

INSTRUCTIONS IMPORTANTES :
- Sois EXTRÊMEMENT DÉTAILLÉ dans tes réponses et analyses
- Développe tous les aspects pertinents de la demande
- Fournis des explications approfondies et structurées
- Propose des actions concrètes avec des justifications détaillées
- Structure tes réponses de manière claire et exhaustive
- N'hésite pas à donner des informations contextuelles supplémentaires
- Sois précis et professionnel tout en étant exhaustif

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

HISTORIQUE CONVERSATION :
${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

CAPACITÉS :
- Modifier/créer/supprimer des tâches
- Modifier/créer des recommandations IA
- Modifier le résumé de réunion
- Réassigner des tâches à d'autres participants
- Créer des emails pré-rédigés
- Analyser le contexte complet pour des suggestions pertinentes

INSTRUCTIONS IMPORTANTES :
1. Comprends la demande de l'utilisateur dans le contexte de cette réunion avec une analyse DÉTAILLÉE
2. Propose des actions concrètes (créer, modifier, supprimer) avec des justifications COMPLÈTES
3. Justifie tes propositions avec le contexte disponible de manière EXHAUSTIVE
4. Sois précis sur les IDs des tâches à modifier
5. Adapte ton ton professionnel au contexte médical
6. TOUJOURS fournir un retour TRÈS DÉTAILLÉ sur les actions que tu vas effectuer
7. Explique clairement et EN DÉTAIL ce qui va être modifié/créé/supprimé
8. Développe tous les aspects pertinents de ta réponse

IMPORTANT: Tu dois TOUJOURS répondre de manière conversationnelle TRÈS DÉTAILLÉE ET proposer des actions concrètes.
- Ne dis jamais "Je ne peux pas" - propose plutôt des alternatives DÉTAILLÉES
- Sois proactif dans tes suggestions EXHAUSTIVES
- Fournis des explications TRÈS claires et COMPLÈTES sur ce que tu vas faire

Réponds UNIQUEMENT en JSON avec cette structure exacte :
{
  "response": "ta réponse conversationnelle TRÈS DÉTAILLÉE à l'utilisateur, expliquant de manière EXHAUSTIVE ce que tu vas faire et pourquoi",
  "actions": [
    {
      "type": "create_todo | update_todo | delete_todo | update_summary | create_recommendation | update_recommendation",
      "data": {},
      "explanation": "explication TRÈS DÉTAILLÉE de cette action spécifique"
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

    console.log('[MEETING-ASSISTANT] 🧠 Appel OpenAI API...');
    console.log('[MEETING-ASSISTANT] 📊 Messages à envoyer:', messages.length);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        temperature: 0.7,
        max_tokens: 16384,
      }),
    });

    console.log('[MEETING-ASSISTANT] 📡 Statut réponse OpenAI:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[MEETING-ASSISTANT] ❌ Erreur OpenAI API:', errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const aiData = await response.json();
    console.log('[MEETING-ASSISTANT] ✅ Réponse OpenAI reçue');
    console.log('[MEETING-ASSISTANT] 📋 Choix disponibles:', aiData.choices?.length || 0);

    let aiResponse;
    try {
      const aiContent = aiData.choices[0].message.content;
      console.log('[MEETING-ASSISTANT] 📝 Contenu brut (premiers 300 chars):', aiContent.substring(0, 300) + '...');
      
      // Extraire le JSON de la réponse
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResponse = JSON.parse(jsonMatch[0]);
        console.log('[MEETING-ASSISTANT] ✅ JSON parsé avec succès');
        
        // Validation de la réponse
        if (!aiResponse.response) {
          console.error('[MEETING-ASSISTANT] ❌ Réponse manquante dans la structure JSON');
          throw new Error('Réponse manquante dans la structure JSON');
        }
        
        if (!Array.isArray(aiResponse.actions)) {
          console.log('[MEETING-ASSISTANT] ⚠️ Actions non définies, initialisation tableau vide');
          aiResponse.actions = [];
        }
        
        console.log('[MEETING-ASSISTANT] 📊 Actions détectées:', aiResponse.actions.length);
        
      } else {
        console.error('[MEETING-ASSISTANT] ❌ Aucun JSON trouvé dans la réponse');
        console.log('[MEETING-ASSISTANT] 📄 Contenu complet:', aiContent);
        // Fallback: traiter comme réponse conversationnelle simple
        aiResponse = {
          response: aiContent.trim() || "Je comprends votre demande, mais j'ai rencontré un problème technique. Pouvez-vous la reformuler plus précisément ?",
          actions: [],
          needsConfirmation: false
        };
      }
    } catch (parseError) {
      console.error('[MEETING-ASSISTANT] ❌ Erreur parsing JSON:', parseError);
      console.log('[MEETING-ASSISTANT] 📄 Contenu qui a causé l\'erreur:', aiData.choices[0]?.message?.content || 'Aucun contenu');
      aiResponse = {
        response: "Je comprends votre demande, mais j'ai rencontré un problème technique lors du traitement. Pouvez-vous reformuler votre demande de manière plus précise ? Par exemple : 'Ajoute une tâche pour...' ou 'Modifie le résumé pour inclure...'",
        actions: [],
        needsConfirmation: false
      };
    }

    console.log('[MEETING-ASSISTANT] ✅ Réponse finale préparée:', {
      hasResponse: !!aiResponse.response,
      responseLength: aiResponse.response?.length || 0,
      actionsCount: aiResponse.actions?.length || 0,
      needsConfirmation: aiResponse.needsConfirmation,
    });

    const finalResponse = {
      response: aiResponse.response,
      actions: aiResponse.actions || [],
      needsConfirmation: aiResponse.needsConfirmation || false,
      confirmationMessage: aiResponse.confirmationMessage || "",
      meetingContext: {
        todosCount: meetingContext.todos.length,
        hasTranscript: !!meetingContext.transcript,
        hasSummary: !!meetingContext.summary
      }
    };

    console.log('[MEETING-ASSISTANT] 🚀 Envoi réponse finale');

    return new Response(JSON.stringify(finalResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[MEETING-ASSISTANT] ❌ ERREUR GLOBALE:', error);
    console.error('[MEETING-ASSISTANT] 📍 Stack trace:', error.stack);
    
    const errorResponse = { 
      error: error.message,
      response: "Une erreur s'est produite lors du traitement de votre demande. Détails de l'erreur: " + error.message + ". Veuillez réessayer dans quelques instants.",
      actions: []
    };
    
    console.log('[MEETING-ASSISTANT] 📤 Envoi réponse d\'erreur:', errorResponse);
    
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
