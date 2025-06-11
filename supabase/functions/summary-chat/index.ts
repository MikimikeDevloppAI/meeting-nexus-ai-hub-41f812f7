
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('[SUMMARY-CHAT] 🚀 Démarrage function');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { meetingId, userMessage } = await req.json();
    console.log('[SUMMARY-CHAT] 📝 Demande reçue:', {
      meetingId: meetingId,
      userMessage: userMessage.substring(0, 50) + '...'
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Récupérer les données de la réunion
    console.log('[SUMMARY-CHAT] 🔍 Récupération réunion...');
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('title, summary, transcript')
      .eq('id', meetingId)
      .single();

    if (meetingError || !meeting) {
      throw new Error(`Réunion non trouvée: ${meetingError?.message}`);
    }

    console.log('[SUMMARY-CHAT] ✅ Réunion récupérée:', {
      title: meeting.title,
      summaryLength: meeting.summary?.length || 0,
      transcriptLength: meeting.transcript?.length || 0
    });

    if (!meeting.summary) {
      throw new Error('Aucun résumé disponible pour cette réunion');
    }

    // Limiter le contexte pour éviter les timeouts
    const maxContextLength = 1000;
    const transcriptContext = meeting.transcript 
      ? meeting.transcript.substring(0, maxContextLength)
      : 'Transcript non disponible';

    console.log('[SUMMARY-CHAT] 📝 Context réduit:', transcriptContext.length + ' caractères');

    // Prompt très strict pour le format JSON
    const prompt = `Tu es un assistant spécialisé dans la modification de résumés de réunions.

INSTRUCTION CRITIQUE : Tu dois retourner UNIQUEMENT un objet JSON valide, sans aucun texte avant ou après. Pas de markdown, pas d'explication, SEULEMENT le JSON.

Format de réponse OBLIGATOIRE (respecte exactement cette structure) :
{
  "new_summary": "le nouveau résumé en Markdown avec emojis",
  "explanation": "explication courte de ce qui a été modifié"
}

CONTRAINTES STRICTES :
- Le résumé modifié doit faire maximum 2000 caractères
- Garde la structure Markdown avec les emojis existants
- Applique EXACTEMENT la modification demandée par l'utilisateur
- Si la demande n'est pas claire, garde le résumé original

DONNÉES DE LA RÉUNION :
Titre: ${meeting.title}
Résumé actuel:
${meeting.summary}

Context transcript (partiel):
${transcriptContext}

DEMANDE DE MODIFICATION :
${userMessage}

RAPPEL : Retourne UNIQUEMENT le JSON, rien d'autre.`;

    console.log('[SUMMARY-CHAT] 🧠 Appel OpenAI...');
    
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
            content: 'Tu es un assistant qui modifie des résumés de réunions. Tu dois TOUJOURS retourner UNIQUEMENT du JSON valide, sans aucun texte supplémentaire.'
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

    console.log('[SUMMARY-CHAT] ✅ Réponse OpenAI reçue');
    console.log('[SUMMARY-CHAT] 🔍 Contenu:', content.substring(0, 100) + '...');

    // Parsing JSON plus robuste
    let parsedResponse;
    try {
      // Nettoyer le contenu si nécessaire
      let cleanContent = content;
      
      // Retirer les blocs de code markdown si présents
      cleanContent = cleanContent.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      // Chercher un JSON dans le contenu
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanContent = jsonMatch[0];
      }
      
      parsedResponse = JSON.parse(cleanContent);
      
      // Valider la structure
      if (!parsedResponse.new_summary || typeof parsedResponse.new_summary !== 'string') {
        throw new Error('Structure JSON invalide: new_summary manquant');
      }
      
    } catch (parseError) {
      console.error('[SUMMARY-CHAT] ❌ Erreur parsing:', parseError);
      
      // En cas d'erreur de parsing, retourner le résumé original avec un message d'erreur
      return new Response(JSON.stringify({
        success: false,
        error: 'Erreur de format de réponse de l\'IA',
        response: `Je n'ai pas pu traiter votre demande correctement. Le résumé reste inchangé.`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mise à jour en base
    console.log('[SUMMARY-CHAT] 💾 Mise à jour résumé...');
    const { error: updateError } = await supabase
      .from('meetings')
      .update({
        summary: parsedResponse.new_summary
      })
      .eq('id', meetingId);

    if (updateError) {
      throw new Error(`Erreur mise à jour: ${updateError.message}`);
    }

    console.log('[SUMMARY-CHAT] ✅ Résumé mis à jour');

    return new Response(JSON.stringify({
      success: true,
      response: parsedResponse.explanation || 'Résumé modifié avec succès',
      explanation: parsedResponse.explanation
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[SUMMARY-CHAT] ❌ Erreur générale:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      response: 'Erreur lors de la modification du résumé'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
