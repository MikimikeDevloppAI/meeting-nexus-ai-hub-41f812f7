
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

    console.log('[TASK-RECOMMENDATION] 🧠 Analyse enrichie avec recherche internet et templates email');

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

    // Recherche internet enrichie (pas seulement pour fournisseurs)
    console.log('[TASK-RECOMMENDATION] 🌐 Recherche internet enrichie');
    
    let internetContext = { hasContent: false, content: '', providers: [], enrichmentType: 'general' };
    try {
      // Analyser si la tâche nécessite des informations externes
      const taskLower = task.description.toLowerCase();
      const needsInternet = taskLower.includes('contacter') || 
                           taskLower.includes('rechercher') ||
                           taskLower.includes('prestataire') || 
                           taskLower.includes('entreprise') || 
                           taskLower.includes('fournisseur') ||
                           taskLower.includes('régie') ||
                           taskLower.includes('installation') ||
                           taskLower.includes('matériel') ||
                           taskLower.includes('service') ||
                           taskLower.includes('devis') ||
                           taskLower.includes('distributeur') ||
                           taskLower.includes('fontaine') ||
                           taskLower.includes('messagerie') ||
                           taskLower.includes('sonnette') ||
                           taskLower.includes('information') ||
                           taskLower.includes('tarif') ||
                           taskLower.includes('prix') ||
                           taskLower.includes('coordonnées') ||
                           taskLower.includes('site web') ||
                           taskLower.includes('email') ||
                           taskLower.includes('téléphone');

      if (needsInternet) {
        const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
        if (perplexityKey) {
          const enrichmentType = taskLower.includes('prestataire') || taskLower.includes('fournisseur') ? 'providers' : 'general';
          
          let searchQuery;
          if (enrichmentType === 'providers') {
            searchQuery = `${task.description} entreprises prestataires fournisseurs Genève Suisse avec coordonnées contacts adresses sites web téléphones emails`;
          } else {
            searchQuery = `${task.description} informations pratiques Genève Suisse coordonnées contacts procédures tarifs`;
          }
          
          const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${perplexityKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'llama-3.1-sonar-large-128k-online',
              messages: [
                {
                  role: 'system',
                  content: enrichmentType === 'providers' 
                    ? 'Tu es un assistant spécialisé dans la recherche de prestataires et fournisseurs en Suisse. Fournis des informations détaillées avec noms d\'entreprises, adresses complètes, numéros de téléphone, emails et sites web quand disponibles. Formate les informations de manière structurée.'
                    : 'Tu es un assistant spécialisé pour aider avec des informations pratiques en Suisse. Fournis des informations utiles, contacts, procédures, tarifs et coordonnées quand disponibles. Sois précis et concis.'
                },
                {
                  role: 'user',
                  content: searchQuery
                }
              ],
              max_tokens: 1000,
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
              providers: providers,
              enrichmentType: enrichmentType
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
      providersFound: internetContext.providers.length,
      enrichmentType: internetContext.enrichmentType
    });

    // Synthèse avec recommandations IA avancées et templates email
    console.log('[TASK-RECOMMENDATION] ⚡ Synthèse contextuelle avec extraction contacts et emails');

    const systemPrompt = `Tu es un assistant IA spécialisé pour un cabinet d'ophtalmologie à Genève, Suisse.

MISSION : Analyser cette tâche et fournir des recommandations utiles avec contacts de fournisseurs et templates d'email SEULEMENT si tu peux ajouter une valeur significative.

CONTEXTE DISPONIBLE :
- Tâche: ${task.description}
- Transcript: ${transcript ? 'Disponible' : 'Non disponible'}
- Contexte réunion: ${meetingContext?.title || 'Cabinet ophtalmologie'}
- Participants: ${participants?.map(p => p.name).join(', ') || 'Non spécifiés'}
- Tâches existantes: ${contextData.existingTodos.length} tâches en cours

${internetContext.hasContent ? `INFORMATIONS ENRICHIES TROUVÉES:
${internetContext.content}

${internetContext.enrichmentType === 'providers' ? `ENTREPRISES IDENTIFIÉES: ${internetContext.providers.join(', ')}` : 'INFORMATIONS PRATIQUES ENRICHIES'}` : ''}

RÈGLES DE RECOMMANDATION :
1. Si la tâche est simple et ne nécessite pas de conseils → réponds avec hasRecommendation: false
2. Pour les tâches complexes, fournis des recommandations pratiques détaillées
3. Pour les contacts externes, extrais et structure les informations de contact trouvées
4. Inclus toujours les coordonnées complètes : nom, adresse, téléphone, email, site web
5. Pour tous les prix, utilise les CHF (francs suisses)
6. **EMAILS PRÉ-RÉDIGÉS** : Si la tâche implique "contacter", "envoyer email", "demander informations", "demander devis" → crée un brouillon professionnel
7. Assure-toi que les contacts sont réels et vérifiables

DÉTECTION EMAIL OBLIGATOIRE :
- Analyser si la tâche nécessite l'envoi d'un email (mots-clés : contacter, email, envoyer, demander, informer)
- Si OUI → needsExternalEmail: true + emailDraft complet
- Template email professionnel avec objet, salutation, corps, signature

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
  "emailDraft": "brouillon email complet avec objet et corps si nécessaire ou null",
  "contacts": [
    {
      "name": "Nom exact de l'entreprise",
      "address": "Adresse complète si disponible",
      "phone": "Numéro de téléphone au format suisse si disponible",
      "email": "Email de contact si disponible", 
      "website": "Site web complet avec https:// si disponible"
    }
  ],
  "contextAnalysis": "analyse du contexte utilisé incluant internet",
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
          { role: 'user', content: `Analyse cette tâche avec le contexte enrichi et génère email si nécessaire : "${task.description}"` }
        ],
        temperature: 0.7,
        max_tokens: 1500,
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

        // Valider la génération d'email
        if (recommendation.needsExternalEmail && !recommendation.emailDraft) {
          console.log('[TASK-RECOMMENDATION] ⚠️ Email demandé mais pas généré, correction...');
          recommendation.needsExternalEmail = false;
        }
      } else {
        recommendation = { hasRecommendation: false, needsExternalEmail: false };
      }
    } catch (parseError) {
      console.error('[TASK-RECOMMENDATION] Erreur parsing JSON:', parseError);
      recommendation = { hasRecommendation: false, needsExternalEmail: false };
    }

    console.log('[TASK-RECOMMENDATION] ✅ Recommandation générée:', {
      hasRecommendation: recommendation.hasRecommendation,
      hasEmail: recommendation.needsExternalEmail,
      contacts: recommendation.contacts?.length || 0,
      internetUsed: internetContext.hasContent
    });

    return new Response(JSON.stringify({ 
      recommendation,
      contextUsed: {
        existingTodos: contextData.existingTodos.length,
        internetSearch: internetContext.hasContent,
        providersFound: internetContext.providers.length,
        enrichmentType: internetContext.enrichmentType
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[TASK-RECOMMENDATION] ❌ ERREUR:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      recommendation: { hasRecommendation: false, needsExternalEmail: false }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
