
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
    
    console.log('[MEETING-ASSISTANT] 🤖 Traitement demande:', userMessage.substring(0, 100) + '...');
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
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

    if (meetingError) throw meetingError;

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

    if (todosError) throw todosError;

    const { data: participants, error: participantsError } = await supabase
      .from('meeting_participants')
      .select('participants(*)')
      .eq('meeting_id', meetingId);

    if (participantsError) throw participantsError;

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

    console.log('[MEETING-ASSISTANT] 🧠 Analyse avec GPT-4...');

    const systemPrompt = `Tu es l'assistant IA intelligent du cabinet d'ophtalmologie Dr Tabibian à Genève, spécialisé dans la gestion des réunions.

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

TRANSCRIPT COMPLET :
${meetingContext.transcript}

HISTORIQUE CONVERSATION :
${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

CAPACITÉS :
- Modifier/créer/supprimer des tâches
- Modifier/créer des recommandations IA
- Modifier le résumé de réunion
- Réassigner des tâches à d'autres participants
- Créer des emails pré-rédigés
- Analyser le contexte complet pour des suggestions pertinentes

INSTRUCTIONS :
1. Comprends la demande de l'utilisateur dans le contexte de cette réunion
2. Propose des actions concrètes (créer, modifier, supprimer)
3. Justifie tes propositions avec le contexte disponible
4. Sois précis sur les IDs des tâches à modifier
5. Adapte ton ton professionnel au contexte médical

Réponds UNIQUEMENT en JSON avec cette structure :
{
  "response": "ta réponse conversationnelle à l'utilisateur",
  "actions": [
    {
      "type": "create_todo" | "update_todo" | "delete_todo" | "update_summary" | "create_recommendation" | "update_recommendation",
      "data": {
        // données spécifiques selon le type d'action
      },
      "explanation": "pourquoi cette action"
    }
  ],
  "needsConfirmation": boolean,
  "confirmationMessage": "message de confirmation si nécessaire"
}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    const aiData = await response.json();
    let aiResponse;

    try {
      const aiContent = aiData.choices[0].message.content;
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Format JSON invalide');
      }
    } catch (parseError) {
      console.error('[MEETING-ASSISTANT] Erreur parsing:', parseError);
      aiResponse = {
        response: "Je ne peux pas traiter votre demande pour le moment. Pouvez-vous la reformuler ?",
        actions: [],
        needsConfirmation: false
      };
    }

    console.log('[MEETING-ASSISTANT] ✅ Réponse générée:', {
      actionsCount: aiResponse.actions?.length || 0,
      needsConfirmation: aiResponse.needsConfirmation
    });

    return new Response(JSON.stringify({
      response: aiResponse.response,
      actions: aiResponse.actions || [],
      needsConfirmation: aiResponse.needsConfirmation || false,
      confirmationMessage: aiResponse.confirmationMessage,
      meetingContext: {
        todosCount: meetingContext.todos.length,
        hasTranscript: !!meetingContext.transcript,
        hasSummary: !!meetingContext.summary
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[MEETING-ASSISTANT] ❌ ERREUR:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      response: "Une erreur s'est produite. Veuillez réessayer.",
      actions: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
