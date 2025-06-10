
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
    const { meetingId, userMessage } = await req.json();
    
    console.log('[SUMMARY-CHAT] 📝 Modification résumé:', userMessage);
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Récupérer réunion avec timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database timeout')), 3000)
    );

    const meetingPromise = supabase
      .from('meetings')
      .select('title, summary, transcript')
      .eq('id', meetingId)
      .single();

    const { data: meeting, error } = await Promise.race([meetingPromise, timeoutPromise]) as any;

    if (error) {
      throw new Error(`Erreur récupération réunion: ${error.message}`);
    }

    console.log('[SUMMARY-CHAT] ✅ Réunion récupérée');

    const systemPrompt = `Tu es un assistant spécialisé dans la modification de résumés de réunions médicales OphtaCare.

RÉUNION: "${meeting.title}"

RÉSUMÉ ACTUEL:
${meeting.summary || 'Aucun résumé existant'}

TRANSCRIPT (pour contexte):
${meeting.transcript ? meeting.transcript.substring(0, 4000) + '...' : 'Pas de transcript'}

INSTRUCTION: Modifie le résumé selon la demande: "${userMessage}"

Réponds en JSON:
{
  "new_summary": "nouveau résumé complet",
  "explanation": "ce qui a été modifié"
}`;

    console.log('[SUMMARY-CHAT] 🧠 Appel OpenAI...');

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
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    const openAITimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('OpenAI timeout')), 8000)
    );

    const response = await Promise.race([openAIPromise, openAITimeout]) as Response;

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiData = await response.json();
    console.log('[SUMMARY-CHAT] ✅ Réponse OpenAI reçue');

    let aiResponse;
    try {
      const aiContent = aiData.choices[0].message.content;
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        aiResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch (parseError) {
      console.error('[SUMMARY-CHAT] ❌ Erreur parsing:', parseError);
      aiResponse = {
        new_summary: meeting.summary || "",
        explanation: "Impossible de traiter la demande."
      };
    }

    // Mettre à jour le résumé
    try {
      const { error: updateError } = await supabase
        .from('meetings')
        .update({ summary: aiResponse.new_summary })
        .eq('id', meetingId);
      
      if (updateError) throw updateError;
      
      console.log('[SUMMARY-CHAT] ✅ Résumé mis à jour');
      
      return new Response(JSON.stringify({
        success: true,
        explanation: aiResponse.explanation,
        response: aiResponse.explanation
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
      
    } catch (error) {
      console.error('[SUMMARY-CHAT] ❌ Erreur mise à jour:', error);
      throw error;
    }

  } catch (error) {
    console.error('[SUMMARY-CHAT] ❌ ERREUR:', error);
    
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
