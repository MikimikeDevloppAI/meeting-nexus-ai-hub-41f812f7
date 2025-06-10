
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

  console.log('[SUMMARY-CHAT] 🚀 Démarrage function');

  try {
    const { meetingId, userMessage } = await req.json();
    
    console.log('[SUMMARY-CHAT] 📝 Demande reçue:', {
      meetingId,
      userMessage: userMessage?.substring(0, 100) + '...'
    });
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('[SUMMARY-CHAT] ❌ Clé OpenAI manquante');
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[SUMMARY-CHAT] 🔍 Récupération réunion...');

    // Récupérer réunion avec timeout optimisé
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database timeout (4s)')), 4000)
    );

    const meetingPromise = supabase
      .from('meetings')
      .select('title, summary, transcript')
      .eq('id', meetingId)
      .single();

    const { data: meeting, error } = await Promise.race([meetingPromise, timeoutPromise]) as any;

    if (error) {
      console.error('[SUMMARY-CHAT] ❌ Erreur DB:', error);
      throw new Error(`Erreur récupération réunion: ${error.message}`);
    }

    console.log('[SUMMARY-CHAT] ✅ Réunion récupérée:', {
      title: meeting.title,
      summaryLength: meeting.summary?.length || 0,
      transcriptLength: meeting.transcript?.length || 0
    });

    // Préparer le transcript complet (jusqu'à 4200 caractères)
    const fullTranscript = meeting.transcript ? 
      meeting.transcript.substring(0, 4200) + (meeting.transcript.length > 4200 ? '...' : '') : 
      'Pas de transcript disponible';

    const systemPrompt = `Tu es un assistant spécialisé dans la modification de résumés de réunions médicales OphtaCare.

RÉUNION: "${meeting.title}"

RÉSUMÉ ACTUEL:
${meeting.summary || 'Aucun résumé existant'}

TRANSCRIPT COMPLET (pour contexte):
${fullTranscript}

INSTRUCTION UTILISATEUR: "${userMessage}"

Tu dois modifier le résumé selon cette demande. Utilise le transcript comme source principale d'information.

IMPORTANT: Réponds UNIQUEMENT en JSON valide avec cette structure exacte:
{
  "new_summary": "le nouveau résumé complet et détaillé",
  "explanation": "explication courte de ce qui a été modifié"
}

Assure-toi que le JSON soit valide et bien formaté.`;

    console.log('[SUMMARY-CHAT] 🧠 Appel OpenAI (timeout 10s)...');

    const openAIPromise = fetch('https://api.openai.com/v1/chat/completions', {
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
        temperature: 0.2,
        max_tokens: 600,
      }),
    });

    const openAITimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('OpenAI timeout (10s)')), 10000)
    );

    const response = await Promise.race([openAIPromise, openAITimeout]) as Response;

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SUMMARY-CHAT] ❌ Erreur OpenAI:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const aiData = await response.json();
    console.log('[SUMMARY-CHAT] ✅ Réponse OpenAI reçue');

    let aiResponse;
    try {
      const aiContent = aiData.choices[0].message.content;
      console.log('[SUMMARY-CHAT] 🔍 Contenu brut:', aiContent.substring(0, 200));
      
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        aiResponse = JSON.parse(jsonMatch[0]);
        console.log('[SUMMARY-CHAT] ✅ JSON parsé avec succès');
      } else {
        throw new Error('Aucun JSON trouvé dans la réponse');
      }
    } catch (parseError) {
      console.error('[SUMMARY-CHAT] ❌ Erreur parsing JSON:', parseError);
      aiResponse = {
        new_summary: meeting.summary || "",
        explanation: "Erreur lors du traitement de la demande."
      };
    }

    // Mettre à jour le résumé dans la base
    console.log('[SUMMARY-CHAT] 💾 Mise à jour résumé...');
    
    try {
      const { error: updateError } = await supabase
        .from('meetings')
        .update({ summary: aiResponse.new_summary })
        .eq('id', meetingId);
      
      if (updateError) {
        console.error('[SUMMARY-CHAT] ❌ Erreur update:', updateError);
        throw updateError;
      }
      
      console.log('[SUMMARY-CHAT] ✅ Résumé mis à jour avec succès');
      
      return new Response(JSON.stringify({
        success: true,
        explanation: aiResponse.explanation,
        response: aiResponse.explanation
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
      
    } catch (error) {
      console.error('[SUMMARY-CHAT] ❌ Erreur mise à jour DB:', error);
      throw error;
    }

  } catch (error) {
    console.error('[SUMMARY-CHAT] ❌ ERREUR GLOBALE:', error);
    
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
