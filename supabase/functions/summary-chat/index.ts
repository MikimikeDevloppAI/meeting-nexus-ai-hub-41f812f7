
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
      userMessage: userMessage?.substring(0, 50) + '...'
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

    const { data: meeting, error } = await supabase
      .from('meetings')
      .select('title, summary, transcript')
      .eq('id', meetingId)
      .single();

    if (error) {
      console.error('[SUMMARY-CHAT] ❌ Erreur DB:', error);
      throw new Error(`Erreur récupération réunion: ${error.message}`);
    }

    console.log('[SUMMARY-CHAT] ✅ Réunion récupérée:', {
      title: meeting.title,
      summaryLength: meeting.summary?.length || 0,
      transcriptLength: meeting.transcript?.length || 0
    });

    // Extraire seulement les parties essentielles du transcript
    let contextInfo = '';
    if (meeting.transcript) {
      // Prendre seulement le début (500 chars) et chercher les mots-clés de la demande
      const transcriptStart = meeting.transcript.substring(0, 500);
      
      // Chercher 1 passage pertinent maximum
      const keywords = userMessage.toLowerCase().split(' ').filter(word => word.length > 4);
      let relevantPart = '';
      
      if (keywords.length > 0) {
        const keyword = keywords[0];
        const index = meeting.transcript.toLowerCase().indexOf(keyword);
        if (index !== -1) {
          const start = Math.max(0, index - 100);
          const end = Math.min(meeting.transcript.length, index + 200);
          relevantPart = meeting.transcript.substring(start, end);
        }
      }
      
      contextInfo = transcriptStart + (relevantPart ? `\n\nPASSAGE PERTINENT: ${relevantPart}` : '');
      
      // Limiter strictement à 800 caractères
      if (contextInfo.length > 800) {
        contextInfo = contextInfo.substring(0, 800) + '...';
      }
    }

    console.log('[SUMMARY-CHAT] 📝 Context réduit:', contextInfo.length, 'caractères');

    // Prompt beaucoup plus court et simple
    const systemPrompt = `Modifie ce résumé de réunion médicale selon la demande.

RÉSUMÉ ACTUEL:
${meeting.summary || 'Aucun résumé'}

CONTEXTE:
${contextInfo || 'Pas de contexte'}

DEMANDE: ${userMessage}

Réponds en JSON:
{"new_summary":"résumé modifié","explanation":"ce qui a changé"}`;

    console.log('[SUMMARY-CHAT] 🧠 Appel OpenAI...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt }
        ],
        temperature: 0.1,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SUMMARY-CHAT] ❌ Erreur OpenAI:', response.status, errorText);
      throw new Error(`OpenAI error: ${response.status}`);
    }

    const aiData = await response.json();
    console.log('[SUMMARY-CHAT] ✅ Réponse OpenAI reçue');

    let aiResponse;
    try {
      const aiContent = aiData.choices[0].message.content;
      console.log('[SUMMARY-CHAT] 🔍 Contenu:', aiContent.substring(0, 100));
      
      // Parser le JSON plus robuste
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Pas de JSON trouvé');
      }
    } catch (parseError) {
      console.error('[SUMMARY-CHAT] ❌ Erreur parsing:', parseError);
      aiResponse = {
        new_summary: meeting.summary || "",
        explanation: "Erreur lors du traitement."
      };
    }

    // Mettre à jour le résumé
    console.log('[SUMMARY-CHAT] 💾 Mise à jour résumé...');
    
    const { error: updateError } = await supabase
      .from('meetings')
      .update({ summary: aiResponse.new_summary })
      .eq('id', meetingId);
    
    if (updateError) {
      console.error('[SUMMARY-CHAT] ❌ Erreur update:', updateError);
      throw updateError;
    }
    
    console.log('[SUMMARY-CHAT] ✅ Résumé mis à jour');
    
    return new Response(JSON.stringify({
      success: true,
      explanation: aiResponse.explanation,
      response: aiResponse.explanation
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

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
