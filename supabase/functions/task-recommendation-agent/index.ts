
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    console.log('[TASK-AGENT] 🎯 Analyse intelligente:', task.description.substring(0, 50));

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Prompt optimisé pour des recommandations précises
    const prompt = `Tu es un agent IA spécialisé dans l'assistance administrative pour un cabinet d'ophtalmologie à Genève dirigé par le Dr Tabibian.

TÂCHE À ANALYSER: "${task.description}"

CONTEXTE RÉUNION:
- Titre: ${meetingContext.title}
- Date: ${meetingContext.date}
- Participants: ${meetingContext.participants}

PARTICIPANTS DISPONIBLES: ${participants.map(p => p.name).join(', ')}

INSTRUCTIONS STRICTES:
1. Détermine si cette tâche nécessite une recommandation IA
2. Si OUI, choisis le type le plus adapté parmi: "action_plan", "contacts_providers", "ai_assistance"
3. Si la tâche implique contacter quelqu'un d'EXTERNE au cabinet, génère un email professionnel

IMPORTANT pour les emails externes:
- Format professionnel et poli
- Contexte médical ophtalmologique
- Signature du Dr Tabibian
- Formatage propre avec retours à la ligne appropriés
- Pas de caractères spéciaux qui cassent le formatage

RETOURNE UNIQUEMENT ce JSON exact:
{
  "hasRecommendation": boolean,
  "recommendationType": "action_plan|contacts_providers|ai_assistance|null",
  "recommendation": "text détaillé ou null",
  "estimatedCost": "montant estimé ou null",
  "contacts": [{"name": "string", "phone": "string", "email": "string", "website": "string", "address": "string"}],
  "needsEmail": boolean,
  "emailDraft": "email formaté proprement ou null"
}`;

    console.log('[TASK-AGENT] 🧠 Appel OpenAI...');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Tu es un assistant spécialisé pour cabinet médical. Pour les emails externes, utilise ce format:

Objet: [Objet clair et professionnel]

Madame, Monsieur,

[Corps de l'email avec paragraphes bien séparés]

Je vous remercie par avance pour votre réponse.

Cordialement,

Dr. Tabibian
Cabinet d'Ophtalmologie
Genève
Tél: [à compléter]
Email: [à compléter]

IMPORTANT: Utilise des \\n pour les retours à la ligne, pas de caractères spéciaux.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();

    console.log('[TASK-AGENT] ✅ Réponse OpenAI reçue');

    // Parsing JSON robuste
    let recommendation;
    try {
      // Nettoyer le contenu
      let cleanContent = content;
      
      // Retirer les blocs markdown
      cleanContent = cleanContent.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      // Chercher le JSON
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanContent = jsonMatch[0];
      }
      
      recommendation = JSON.parse(cleanContent);
      
      // Valider la structure
      if (typeof recommendation.hasRecommendation !== 'boolean') {
        throw new Error('Structure invalide');
      }

      // Nettoyer et formater l'email si présent
      if (recommendation.needsEmail && recommendation.emailDraft) {
        // S'assurer que l'email est bien formaté
        let emailContent = recommendation.emailDraft;
        
        // Remplacer les \\n par de vrais retours à la ligne
        emailContent = emailContent.replace(/\\n/g, '\n');
        
        // S'assurer qu'il y a des retours à la ligne entre les sections
        emailContent = emailContent.replace(/([.!?])\s*([A-Z][a-z])/g, '$1\n\n$2');
        
        // Nettoyer les espaces multiples
        emailContent = emailContent.replace(/\n\s*\n\s*\n/g, '\n\n');
        
        recommendation.emailDraft = emailContent.trim();
      }
      
    } catch (parseError) {
      console.error('[TASK-AGENT] ❌ Erreur parsing:', parseError);
      
      // Retour par défaut en cas d'erreur
      recommendation = {
        hasRecommendation: false,
        recommendationType: null,
        recommendation: null,
        estimatedCost: null,
        contacts: [],
        needsEmail: false,
        emailDraft: null
      };
    }

    console.log('[TASK-AGENT] ✅ Recommandation générée:', {
      hasRec: recommendation.hasRecommendation,
      type: recommendation.recommendationType,
      needsEmail: recommendation.needsEmail
    });

    return new Response(JSON.stringify({
      success: true,
      recommendation
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[TASK-AGENT] ❌ Erreur:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      recommendation: {
        hasRecommendation: false,
        recommendationType: null,
        recommendation: null,
        estimatedCost: null,
        contacts: [],
        needsEmail: false,
        emailDraft: null
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
