import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { todoId, todoDescription, userMessage, conversationHistory = [] } = await req.json();
    
    console.log('🤖 Assistant IA Enhanced - Traitement demande pour todo:', todoId);
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Récupérer les subtasks
    const { data: subtasks } = await supabase
      .from('todo_subtasks')
      .select('*')
      .eq('todo_id', todoId)
      .order('created_at', { ascending: true });

    // Récupérer les pièces jointes avec texte extrait
    const { data: attachments } = await supabase
      .from('todo_attachments')
      .select('*')
      .eq('todo_id', todoId)
      .order('created_at', { ascending: false });

    console.log('📎 Attachments trouvés:', attachments?.length || 0);
    
    // Construire le contexte des subtasks
    let subtasksContext = '';
    if (subtasks && subtasks.length > 0) {
      subtasksContext = '\n\nSOUS-TÂCHES ASSOCIÉES :\n';
      subtasks.forEach((subtask, index) => {
        const status = subtask.completed ? '✅ Terminée' : '⏳ En cours';
        subtasksContext += `${index + 1}. ${subtask.description} (${status})\n`;
      });
    }

    // Construire le contexte des fichiers joints
    let attachmentsContext = '';
    if (attachments && attachments.length > 0) {
      console.log('📄 Traitement des attachments...');
      attachments.forEach((attachment) => {
        console.log('📄 Attachment:', attachment.file_name, 'extracted_text length:', attachment.extracted_text?.length || 0);
        if (attachment.extracted_text && attachment.extracted_text.trim()) {
          attachmentsContext += `\n\nFICHIER JOINT À LA TÂCHE - ${attachment.file_name} :\n`;
          attachmentsContext += `Voici son contenu :\n${attachment.extracted_text}\n`;
        }
      });
    }

    console.log('📄 Contexte attachments length:', attachmentsContext.length);

    // Construire l'historique de conversation
    let historyContext = '';
    if (conversationHistory && conversationHistory.length > 0) {
      historyContext = '\n\nHISTORIQUE DE CONVERSATION :\n';
      conversationHistory.forEach((msg: any) => {
        const role = msg.isUser ? 'Utilisateur' : 'Assistant';
        historyContext += `${role}: ${msg.content}\n`;
      });
    }

    // Message contextualisé complet
    const fullContext = `ASSISTANCE SPÉCIALISÉE TÂCHE OPHTACARE

CONTEXTE TÂCHE SPÉCIFIQUE :
- ID tâche : ${todoId}
- Description : "${todoDescription}"
- Cabinet : OphtaCare (Dr Tabibian, Genève)
- Type : Assistance administrative pour accomplissement${subtasksContext}${attachmentsContext}${historyContext}

DEMANDE UTILISATEUR :
${userMessage}

INSTRUCTIONS ASSISTANT :
Tu es l'assistant IA spécialisé pour le cabinet ophtalmologique OphtaCare du Dr Tabibian à Genève.
Concentre-toi sur l'aide pratique en utilisant toutes les données internes disponibles.
Si des fichiers sont joints, utilise leur contenu pour enrichir tes réponses.
Si des sous-tâches existent, prends-les en compte dans tes conseils.
Fournis des conseils concrets, des étapes détaillées et des suggestions contextuelles.
Reste dans le contexte du cabinet d'ophtalmologie OphtaCare.
Ne propose PAS de créer de nouvelles tâches, aide seulement à accomplir celle-ci.`;

    console.log('🔍 Envoi requête à OpenAI avec contexte enrichi...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          {
            role: 'system',
            content: fullContext
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const aiData = await response.json();
    const aiResponse = aiData.choices[0].message.content;

    console.log('✅ Réponse générée:', aiResponse.substring(0, 100) + '...');

    return new Response(JSON.stringify({
      success: true,
      response: aiResponse,
      updated: false,
      hasInternetContext: false
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      response: `Erreur: ${error.message}`,
      success: false
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});