
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
    
    console.log('[TASK-RECOMMENDATION] 📋 Analyse intelligente:', task.description.substring(0, 100) + '...');
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Récupérer le contexte enrichi si nécessaire
    let embeddingContext = { chunks: [], hasContent: false };
    let internetContext = { hasContent: false, content: '', providers: [] };

    // Analyser si la tâche nécessite un contexte enrichi
    const taskLower = task.description.toLowerCase();
    const needsContext = taskLower.includes('choisir') || 
                        taskLower.includes('comparer') ||
                        taskLower.includes('système') ||
                        taskLower.includes('installation') ||
                        taskLower.includes('matériel') ||
                        taskLower.includes('fournisseur') ||
                        taskLower.includes('prestataire') ||
                        taskLower.includes('devis') ||
                        taskLower.includes('rechercher') ||
                        taskLower.includes('trouver');

    if (needsContext) {
      console.log('[TASK-RECOMMENDATION] 🔍 Recherche de contexte enrichi...');
      
      // Recherche dans les embeddings
      try {
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: task.description,
          }),
        });

        if (embeddingResponse.ok) {
          const embeddingData = await embeddingResponse.json();
          const queryEmbedding = embeddingData.data[0].embedding;

          const { data: chunks } = await supabase.rpc('search_document_embeddings', {
            query_embedding: queryEmbedding,
            match_threshold: 0.7,
            match_count: 5
          });

          if (chunks && chunks.length > 0) {
            embeddingContext = { chunks, hasContent: true };
          }
        }
      } catch (error) {
        console.error('[TASK-RECOMMENDATION] Erreur embeddings:', error);
      }

      // Recherche internet si pertinent
      const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
      if (perplexityKey && (taskLower.includes('fournisseur') || taskLower.includes('prestataire') || taskLower.includes('contact'))) {
        try {
          const searchQuery = `${task.description} entreprises prestataires Genève Suisse coordonnées contacts`;
          
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
                  content: 'Trouve des entreprises et prestataires en Suisse avec leurs coordonnées complètes (nom, adresse, téléphone, email, site web).'
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
            
            if (content) {
              internetContext = { hasContent: true, content, providers: [] };
            }
          }
        } catch (error) {
          console.error('[TASK-RECOMMENDATION] Erreur internet:', error);
        }
      }
    }

    console.log('[TASK-RECOMMENDATION] 🤖 Analyse IA avec logique intelligente...');

    const systemPrompt = `Tu es l'assistant IA spécialisé du cabinet d'ophtalmologie Dr Tabibian à Genève, Suisse.

MISSION CRITIQUE : Analyser cette tâche et SEULEMENT fournir des recommandations si elles apportent une VRAIE valeur ajoutée.

TÂCHE À ANALYSER : "${task.description}"

CONTEXTE CABINET :
- Cabinet d'ophtalmologie Dr David Tabibian, Genève, Suisse
- Participants disponibles : ${participants?.map(p => p.name).join(', ') || 'Non spécifiés'}

${embeddingContext.hasContent ? `CONTEXTE HISTORIQUE CABINET :
${embeddingContext.chunks.slice(0, 3).map(chunk => `- ${chunk.chunk_text.substring(0, 150)}...`).join('\n')}` : ''}

${internetContext.hasContent ? `INFORMATIONS INTERNET TROUVÉES :
${internetContext.content}` : ''}

RÈGLES STRICTES POUR LES RECOMMANDATIONS :

1. NE RECOMMANDE PAS si la tâche est simple et claire comme :
   - "Appeler Dr. Martin"
   - "Envoyer le rapport à X"
   - "Programmer une réunion"
   - "Vérifier les stocks"

2. RECOMMANDE SEULEMENT pour les cas COMPLEXES nécessitant :
   - PLAN D'ACTION : tâches impliquant plusieurs étapes, choix techniques, comparaisons
   - ORIENTATION IA : comment l'IA peut concrètement aider pour cette tâche
   - CONTACTS/FOURNISSEURS : coordonnées pertinentes avec informations complètes

3. GÉNÉRATION EMAIL INTELLIGENTE :
   - Génère un email DÈS QUE la tâche implique une COMMUNICATION (contacter, informer, demander, envoyer, communiquer, répondre, etc.)
   - ADAPTE automatiquement le style :
     * EXTERNE (prestataires, fournisseurs, clients) : ton professionnel, détails techniques, demande formelle
     * INTERNE (équipe, collègues) : ton direct, instructions claires, délais précis
   - Inclus l'objet, le corps complet et la signature appropriée

4. EXTRACTION CONTACTS :
   - SEULEMENT utiliser les coordonnées trouvées via internet
   - JAMAIS inventer de coordonnées
   - Format : nom, adresse complète, téléphone, email, site web

5. TOUJOURS utiliser CHF pour les prix

RÉPONSE REQUISE (JSON uniquement) :
{
  "hasRecommendation": boolean,
  "recommendation": "recommandation détaillée avec plan d'action OU orientation IA OU null",
  "recommendationType": "action_plan" | "ai_assistance" | "contacts" | null,
  "needsEmail": boolean,
  "emailDraft": "email complet avec objet et corps si nécessaire ou null",
  "emailType": "external" | "internal" | null,
  "contacts": [
    {
      "name": "Nom entreprise",
      "address": "Adresse complète",
      "phone": "Téléphone",
      "email": "Email",
      "website": "Site web"
    }
  ],
  "estimatedCost": "coût en CHF si pertinent ou null"
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
          { role: 'user', content: `Analyse cette tâche avec logique intelligente : "${task.description}"` }
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    const aiData = await response.json();
    let recommendation;

    try {
      const aiContent = aiData.choices[0].message.content;
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        recommendation = JSON.parse(jsonMatch[0]);
        
        // Nettoyer et valider les contacts
        if (recommendation.contacts) {
          recommendation.contacts = recommendation.contacts.filter(contact => 
            contact.name && contact.name.length > 2
          );
        }
      } else {
        recommendation = { hasRecommendation: false, needsEmail: false };
      }
    } catch (parseError) {
      console.error('[TASK-RECOMMENDATION] Erreur parsing JSON:', parseError);
      recommendation = { hasRecommendation: false, needsEmail: false };
    }

    console.log('[TASK-RECOMMENDATION] ✅ Analyse terminée:', {
      hasRecommendation: recommendation.hasRecommendation,
      needsEmail: recommendation.needsEmail,
      recommendationType: recommendation.recommendationType,
      emailType: recommendation.emailType,
      contacts: recommendation.contacts?.length || 0
    });

    return new Response(JSON.stringify({ 
      recommendation,
      contextUsed: {
        embeddingChunks: embeddingContext.chunks.length,
        internetSearch: internetContext.hasContent
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[TASK-RECOMMENDATION] ❌ ERREUR:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      recommendation: { hasRecommendation: false, needsEmail: false }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
