
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
    const { todoId, todoDescription, userMessage, conversationHistory, todoData, recommendation } = await req.json();
    
    console.log('🤖 Assistant IA Enhanced - Traitement demande pour todo:', todoId);
    
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (!openAIApiKey) {
      throw new Error('Clé API OpenAI manquante');
    }

    // Recherche internet avec Perplexity si disponible et pertinente
    let internetContext = '';
    if (perplexityApiKey && shouldSearchInternet(userMessage)) {
      console.log('🔍 Recherche internet avec Perplexity...');
      try {
        const searchResponse = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${perplexityApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.1-sonar-large-128k-online',
            messages: [
              {
                role: 'system',
                content: 'Tu es un assistant de recherche. Fournir des informations factuelles et récentes en français.'
              },
              {
                role: 'user',
                content: `Recherche des informations pertinentes pour cette question dans le contexte d'une tâche ophtalmologique: ${userMessage}`
              }
            ],
            temperature: 0.2,
            max_tokens: 800,
            return_images: false,
            return_related_questions: false,
            return_citations: true,
            search_recency_filter: 'month'
          }),
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          internetContext = searchData.choices[0]?.message?.content || '';
          console.log('✅ Recherche internet réussie');
        }
      } catch (error) {
        console.log('⚠️ Erreur recherche internet:', error);
      }
    }

    // Préparer le contexte pour l'IA
    let contextPrompt = `Tu es un assistant IA spécialisé dans l'aide aux tâches pour le cabinet d'ophtalmologie Dr Tabibian.

TÂCHE ACTUELLE:
- ID: ${todoId}
- Description: ${todoDescription}`;

    if (todoData?.meetings?.[0]) {
      contextPrompt += `

CONTEXTE DE LA RÉUNION:
- Titre: ${todoData.meetings[0].title}`;
      
      if (todoData.meetings[0].summary) {
        contextPrompt += `
- Résumé: ${todoData.meetings[0].summary}`;
      }
      
      if (todoData.meetings[0].transcript) {
        contextPrompt += `
- Transcript (extrait): ${todoData.meetings[0].transcript.substring(0, 2000)}...`;
      }
    }

    if (recommendation) {
      contextPrompt += `

RECOMMANDATIONS IA EXISTANTES:
${recommendation}`;
    }

    if (internetContext) {
      contextPrompt += `

INFORMATIONS INTERNET RÉCENTES:
${internetContext}`;
    }

    contextPrompt += `

INSTRUCTIONS:
- Aide l'utilisateur avec sa tâche en utilisant toutes les informations disponibles
- Si besoin, suggère des améliorations ou des actions concrètes
- Reste concis et pratique
- Si tu ne peux pas répondre avec les informations disponibles, dis-le clairement
- Utilise les informations internet récentes si disponibles pour enrichir tes réponses

Réponds de manière naturelle et utile à la question de l'utilisateur.`;

    // Préparer l'historique de conversation SANS le message d'accueil
    const messages = [
      { role: 'system', content: contextPrompt }
    ];

    // Ajouter l'historique de conversation en filtrant les messages d'accueil
    if (conversationHistory && conversationHistory.length > 0) {
      const filteredHistory = conversationHistory.filter((msg: any) => 
        !msg.content.includes("Bonjour ! Je suis l'assistant IA pour cette tâche")
      );
      
      filteredHistory.forEach((msg: any) => {
        messages.push({
          role: msg.isUser ? 'user' : 'assistant',
          content: msg.content
        });
      });
    }

    // Ajouter le message actuel
    messages.push({ role: 'user', content: userMessage });

    console.log('🔍 Envoi requête à OpenAI...');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: false
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Erreur OpenAI:', errorData);
      throw new Error(`Erreur OpenAI: ${response.status}`);
    }

    const data = await response.json();
    const assistantResponse = data.choices[0].message.content;

    console.log('✅ Réponse générée:', assistantResponse.substring(0, 100) + '...');

    return new Response(JSON.stringify({
      success: true,
      response: assistantResponse,
      updated: false,
      hasInternetContext: !!internetContext
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❌ Erreur assistant IA:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Fonction pour déterminer si une recherche internet est pertinente
function shouldSearchInternet(message: string): boolean {
  const internetKeywords = [
    'recherche', 'chercher', 'information', 'actualité', 'récent', 'nouveau',
    'prix', 'coût', 'tarif', 'fournisseur', 'contact', 'entreprise',
    'recommandation', 'avis', 'comparaison', 'alternative', 'solution',
    'médecin', 'clinique', 'hôpital', 'spécialiste', 'traitement',
    'médicament', 'équipement', 'matériel', 'acheter', 'commander'
  ];
  
  const lowerMessage = message.toLowerCase();
  return internetKeywords.some(keyword => lowerMessage.includes(keyword));
}
