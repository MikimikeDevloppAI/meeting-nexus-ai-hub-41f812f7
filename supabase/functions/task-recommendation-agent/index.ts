
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
    const { task, transcript, meetingContext, participants } = await req.json();
    
    console.log('[TASK-RECOMMENDATION] 📋 Analyse contextuelle:', task.description.substring(0, 100) + '...');
    console.log('[TASK-RECOMMENDATION] 👥 Participants:', participants?.map(p => p.name).join(', ') || 'Aucun');
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[TASK-RECOMMENDATION] 🧠 Analyse avec contexte et recherche fournisseurs');

    // Récupérer le contexte des tâches existantes
    console.log('[TASK-RECOMMENDATION] 🗄️ Récupération contexte + tâches existantes');
    
    const { data: existingTodos } = await supabase
      .from('todos')
      .select('id, description, status')
      .in('status', ['pending', 'confirmed'])
      .limit(50);

    console.log('[DATABASE] Récupération du contexte incluant tâches existantes');
    console.log('[DATABASE]', existingTodos?.length || 0, 'tâches existantes trouvées');

    const contextData = {
      existingTodos: existingTodos || []
    };

    console.log('[TASK-RECOMMENDATION] ✅ Contexte récupéré:', { existingTodos: contextData.existingTodos.length });

    // Recherche internet spécialisée pour fournisseurs
    console.log('[TASK-RECOMMENDATION] 🌐 Recherche fournisseurs et contacts');
    
    let internetContext = { hasContent: false, content: '', providers: [] };
    try {
      // Analyser si la tâche nécessite des fournisseurs/prestataires
      const taskLower = task.description.toLowerCase();
      const needsProviders = taskLower.includes('prestataire') || 
                           taskLower.includes('entreprise') || 
                           taskLower.includes('fournisseur') ||
                           taskLower.includes('contact') ||
                           taskLower.includes('régie') ||
                           taskLower.includes('installation') ||
                           taskLower.includes('matériel') ||
                           taskLower.includes('service') ||
                           taskLower.includes('devis') ||
                           taskLower.includes('distributeur') ||
                           taskLower.includes('fontaine') ||
                           taskLower.includes('messagerie') ||
                           taskLower.includes('sonnette');

      if (needsProviders) {
        const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
        if (perplexityKey) {
          const searchQuery = `${task.description} entreprises prestataires fournisseurs Genève Suisse avec coordonnées contacts adresses sites web téléphones emails`;
          
          const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${perplexityKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'llama-3.1-sonar-small-128k-online',
              messages: [
                {
                  role: 'system',
                  content: 'Tu es un assistant spécialisé dans la recherche de prestataires et fournisseurs en Suisse. Fournis des informations détaillées avec noms d\'entreprises, adresses complètes, numéros de téléphone, emails et sites web quand disponibles. Formate les informations de manière structurée.'
                },
                {
                  role: 'user',
                  content: searchQuery
                }
              ],
              max_tokens: 800,
              temperature: 0.2,
            }),
          });

          if (perplexityResponse.ok) {
            const perplexityData = await perplexityResponse.json();
            const content = perplexityData.choices[0]?.message?.content || '';
            
            // Extraire les noms d'entreprises du contenu
            const providerRegex = /([A-ZÀ-ÿ][a-zà-ÿ\s&-]+(?:SA|SARL|AG|GmbH|Sàrl)?)/g;
            const providers = [...new Set(content.match(providerRegex) || [])].slice(0, 5);
            
            internetContext = {
              hasContent: true,
              content: content,
              providers: providers
            };
          }
        }
      }
    } catch (error) {
      console.error('[TASK-RECOMMENDATION] Erreur recherche internet:', error);
    }

    console.log('[TASK-RECOMMENDATION] ✅ Internet:', { 
      hasContent: internetContext.hasContent, 
      contentLength: internetContext.content.length,
      providersFound: internetContext.providers.length 
    });

    // Synthèse avec recommandations IA avancées
    console.log('[TASK-RECOMMENDATION] ⚡ Synthèse contextuelle avec extraction contacts');

    const systemPrompt = `Tu es un assistant IA spécialisé pour un cabinet d'ophtalmologie à Genève, Suisse.

MISSION : Analyser cette tâche et fournir des recommandations utiles avec contacts de fournisseurs SEULEMENT si tu peux ajouter une valeur significative.

CONTEXTE DISPONIBLE :
- Tâche: ${task.description}
- Transcript: ${transcript ? 'Disponible' : 'Non disponible'}
- Contexte réunion: ${meetingContext?.title || 'Cabinet ophtalmologie'}
- Participants: ${participants?.map(p => p.name).join(', ') || 'Non spécifiés'}
- Tâches existantes: ${contextData.existingTodos.length} tâches en cours

${internetContext.hasContent ? `INFORMATIONS FOURNISSEURS TROUVÉES:
${internetContext.content}

ENTREPRISES IDENTIFIÉES: ${internetContext.providers.join(', ')}` : ''}

RÈGLES DE RECOMMANDATION :
1. Si la tâche est simple et ne nécessite pas de conseils → réponds avec hasRecommendation: false
2. Pour les tâches complexes, fournis des recommandations pratiques détaillées
3. Pour les contacts externes, extrais et structure les informations de contact trouvées
4. Inclus toujours les coordonnées complètes : nom, adresse, téléphone, email, site web
5. Pour tous les prix, utilise les CHF (francs suisses)
6. Si email externe nécessaire, crée un brouillon professionnel
7. Assure-toi que les contacts sont réels et vérifiables

EXTRACTION DE CONTACTS :
- Extrais les noms d'entreprises, adresses, téléphones, emails, sites web
- Formate les adresses complètement (rue, code postal, ville)
- Vérifie que les sites web sont au format correct (avec http/https)
- N'invente JAMAIS de coordonnées, utilise seulement celles trouvées

RÉPONSE REQUISE (JSON uniquement) :
{
  "hasRecommendation": boolean,
  "recommendation": "texte de recommandation détaillé avec conseils pratiques ou null",
  "needsExternalEmail": boolean,
  "emailDraft": "brouillon email professionnel si nécessaire ou null",
  "contacts": [
    {
      "name": "Nom exact de l'entreprise",
      "address": "Adresse complète si disponible",
      "phone": "Numéro de téléphone au format suisse si disponible",
      "email": "Email de contact si disponible", 
      "website": "Site web complet avec https:// si disponible"
    }
  ],
  "contextAnalysis": "analyse du contexte utilisé",
  "duplicateTask": "avertissement si tâche similaire existe ou null",
  "estimatedCost": "estimation des coûts en CHF si pertinent ou null"
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
          { role: 'user', content: `Analyse cette tâche et extrais tous les contacts utiles : "${task.description}"` }
        ],
        temperature: 0.7,
        max_tokens: 1200,
      }),
    });

    const aiData = await response.json();
    let recommendation;

    try {
      const aiContent = aiData.choices[0].message.content;
      // Nettoyer la réponse et extraire le JSON
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        recommendation = JSON.parse(jsonMatch[0]);
        
        // Valider et nettoyer les contacts
        if (recommendation.contacts) {
          recommendation.contacts = recommendation.contacts.filter(contact => 
            contact.name && contact.name.length > 2
          ).map(contact => ({
            ...contact,
            website: contact.website && !contact.website.startsWith('http') 
              ? `https://${contact.website}` 
              : contact.website
          }));
        }
      } else {
        recommendation = { hasRecommendation: false };
      }
    } catch (parseError) {
      console.error('[TASK-RECOMMENDATION] Erreur parsing JSON:', parseError);
      recommendation = { hasRecommendation: false };
    }

    console.log('[TASK-RECOMMENDATION] ✅ Recommandation générée:', recommendation.hasRecommendation);
    if (recommendation.contacts) {
      console.log('[TASK-RECOMMENDATION] 📋 Contacts trouvés:', recommendation.contacts.length);
    }

    return new Response(JSON.stringify({ 
      recommendation,
      contextUsed: {
        existingTodos: contextData.existingTodos.length,
        internetSearch: internetContext.hasContent,
        providersFound: internetContext.providers.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[TASK-RECOMMENDATION] ❌ ERREUR:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      recommendation: { hasRecommendation: false }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
