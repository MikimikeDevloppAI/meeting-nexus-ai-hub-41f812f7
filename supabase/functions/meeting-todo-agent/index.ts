
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fonction pour normaliser les noms et améliorer la correspondance
const normalizeParticipantName = (name: string): string => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .trim();
};

// Fonction pour trouver le meilleur participant correspondant
const findBestParticipantMatch = (searchName: string, allParticipants: any[]): any | null => {
  if (!searchName || !allParticipants?.length) return null;

  console.log(`[TODO-AGENT] 🔍 Recherche correspondance pour: "${searchName}"`);
  
  const normalizedSearch = normalizeParticipantName(searchName);
  
  // Variantes de noms connues
  const nameVariants: Record<string, string[]> = {
    'leila': ['leïla', 'leila'],
    'emilie': ['émilie', 'emilie'],
    'david': ['david', 'david tabibian'],
    'parmice': ['parmice', 'parmis'],
    'sybil': ['sybil'],
    'tabibian': ['tabibian', 'dr tabibian']
  };
  
  // 1. Correspondance exacte avec variantes
  for (const participant of allParticipants) {
    const normalizedParticipantName = normalizeParticipantName(participant.name);
    const normalizedEmail = normalizeParticipantName(participant.email?.split('@')[0] || '');
    
    // Test direct
    if (normalizedParticipantName === normalizedSearch || normalizedEmail === normalizedSearch) {
      console.log(`[TODO-AGENT] ✅ Correspondance exacte: ${participant.name}`);
      return participant;
    }
    
    // Test avec variantes
    for (const [key, variants] of Object.entries(nameVariants)) {
      if (variants.some(variant => normalizeParticipantName(variant) === normalizedSearch)) {
        if (variants.some(variant => normalizeParticipantName(variant) === normalizedParticipantName)) {
          console.log(`[TODO-AGENT] ✅ Correspondance variante: ${participant.name}`);
          return participant;
        }
      }
    }
  }
  
  // 2. Correspondance partielle
  for (const participant of allParticipants) {
    const normalizedParticipantName = normalizeParticipantName(participant.name);
    if (normalizedParticipantName.includes(normalizedSearch) || normalizedSearch.includes(normalizedParticipantName)) {
      console.log(`[TODO-AGENT] ✅ Correspondance partielle: ${participant.name}`);
      return participant;
    }
  }
  
  console.log(`[TODO-AGENT] ⚠️ Aucune correspondance trouvée pour: "${searchName}"`);
  return null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { meetingId, userMessage, conversationHistory, coordinatorContext } = await req.json();
    
    console.log('[TODO-AGENT] 📋 Traitement tâches pour:', userMessage);
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Récupérer le contexte des tâches existantes
    const { data: todos, error: todosError } = await supabase
      .from('todos')
      .select(`
        *,
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
      throw todosError;
    }

    console.log('[TODO-AGENT] ✅ Tâches actuelles:', todos.length);

    // Récupérer TOUS les participants disponibles dans le système
    const { data: allParticipants, error: allParticipantsError } = await supabase
      .from('participants')
      .select('id, name, email')
      .order('name');

    if (allParticipantsError) {
      throw allParticipantsError;
    }

    console.log('[TODO-AGENT] 👥 Total participants disponibles:', allParticipants.length);

    const systemPrompt = `Tu es un agent spécialisé dans la gestion des tâches (todos) pour les réunions.

CONTEXTE ACTUEL :
Meeting ID: ${meetingId}
Participants disponibles dans TOUT le système: ${allParticipants.map(p => `${p.name} (${p.email})`).join(', ')}

TÂCHES EXISTANTES (${todos.length}) :
${todos.map((todo, i) => `
${i+1}. [ID: ${todo.id}] ${todo.description}
   - Assigné à: ${todo.todo_participants?.map(tp => tp.participants.name).join(', ') || 'Non assigné'}
   - Statut: ${todo.status}
   - Commentaires: ${todo.todo_comments?.length || 0} commentaire(s)
`).join('')}

DEMANDE UTILISATEUR : "${userMessage}"

CAPACITÉS :
- Créer de nouvelles tâches
- Modifier des tâches existantes (description, assignation)
- Supprimer des tâches
- Assigner/réassigner des tâches à N'IMPORTE QUEL participant du système (même s'il n'était pas à la réunion)
- Modifier le statut des tâches

RÈGLES D'ASSIGNATION :
- Tu peux assigner à N'IMPORTE QUEL participant de la liste complète
- Utilise les noms EXACTS de la liste des participants
- Variantes acceptées : Leïla/leila, Émilie/emilie, David/david, Parmice/parmis, etc.

INSTRUCTIONS :
1. Analyse la demande utilisateur dans le contexte des tâches
2. Détermine les actions à effectuer (créer, modifier, supprimer, assigner)
3. Sois précis sur les IDs des tâches à modifier
4. Assure-toi que les assignations utilisent des participants valides de la liste complète
5. Explique clairement chaque action

Réponds UNIQUEMENT en JSON avec cette structure :
{
  "actions": [
    {
      "type": "create_todo | update_todo | delete_todo | assign_todo",
      "data": {},
      "explanation": "explication détaillée"
    }
  ],
  "summary": "résumé des actions à effectuer"
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiData = await response.json();
    let aiResponse;

    try {
      const content = aiData.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('[TODO-AGENT] ❌ Erreur parsing:', parseError);
      aiResponse = {
        actions: [],
        summary: "Impossible de traiter la demande concernant les tâches."
      };
    }

    // Exécuter les actions
    const executedActions = [];
    
    for (const action of aiResponse.actions || []) {
      try {
        switch (action.type) {
          case 'create_todo':
            const { data: newTodo, error: createError } = await supabase
              .from('todos')
              .insert({
                meeting_id: meetingId,
                description: action.data.description,
                status: 'confirmed'
              })
              .select()
              .single();
            
            if (createError) throw createError;
            
            // Assigner si spécifié - utilise tous les participants disponibles
            if (action.data.assigned_to && newTodo) {
              const participant = findBestParticipantMatch(action.data.assigned_to, allParticipants);
              
              if (participant) {
                // Mettre à jour assigned_to
                await supabase
                  .from('todos')
                  .update({ assigned_to: participant.id })
                  .eq('id', newTodo.id);
                
                // Créer relation todo_participants
                await supabase.from('todo_participants').insert({
                  todo_id: newTodo.id,
                  participant_id: participant.id
                });
                
                console.log('[TODO-AGENT] ✅ Participant assigné:', participant.name);
              } else {
                console.log('[TODO-AGENT] ⚠️ Participant non trouvé:', action.data.assigned_to);
              }
            }
            
            executedActions.push({
              ...action,
              success: true,
              result: `Tâche créée: "${action.data.description}"`
            });
            break;
            
          case 'update_todo':
            const { error: updateError } = await supabase
              .from('todos')
              .update({ 
                description: action.data.description,
                status: action.data.status || 'confirmed'
              })
              .eq('id', action.data.id);
            
            if (updateError) throw updateError;
            
            executedActions.push({
              ...action,
              success: true,
              result: `Tâche mise à jour`
            });
            break;
            
          case 'delete_todo':
            // Supprimer d'abord les assignations
            await supabase.from('todo_participants').delete().eq('todo_id', action.data.id);
            await supabase.from('todo_ai_recommendations').delete().eq('todo_id', action.data.id);
            await supabase.from('todo_comments').delete().eq('todo_id', action.data.id);
            
            const { error: deleteError } = await supabase
              .from('todos')
              .delete()
              .eq('id', action.data.id);
            
            if (deleteError) throw deleteError;
            
            executedActions.push({
              ...action,
              success: true,
              result: `Tâche supprimée`
            });
            break;
        }
      } catch (error) {
        console.error(`[TODO-AGENT] ❌ Erreur action ${action.type}:`, error);
        executedActions.push({
          ...action,
          success: false,
          error: error.message
        });
      }
    }

    console.log('[TODO-AGENT] ✅ Actions terminées:', executedActions.length);

    return new Response(JSON.stringify({
      actions: executedActions,
      summary: aiResponse.summary,
      success: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[TODO-AGENT] ❌ ERREUR:', error);
    
    return new Response(JSON.stringify({
      error: error.message,
      actions: [],
      summary: "Erreur lors du traitement des tâches",
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
