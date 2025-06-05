
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { todoId, description, meetingContext, meetingId, participantList } = await req.json();
    
    console.log('[ENHANCED-TODO] Processing recommendation for:', description.substring(0, 50));
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if AI recommendation already generated
    const { data: todo } = await supabase
      .from('todos')
      .select('ai_recommendation_generated')
      .eq('id', todoId)
      .single();

    if (todo?.ai_recommendation_generated) {
      return new Response(JSON.stringify({ message: 'AI recommendation already generated' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Récupérer le transcript de la réunion pour le contexte
    const { data: meetingData } = await supabase
      .from('meetings')
      .select('transcript, title, created_at')
      .eq('id', meetingId)
      .single();

    const transcript = meetingData?.transcript || '';
    
    // Récupérer les participants
    const { data: participantsData } = await supabase
      .from('meeting_participants')
      .select(`
        participant_id,
        participants (
          id,
          name,
          email
        )
      `)
      .eq('meeting_id', meetingId);

    const participants = participantsData?.map((mp: any) => mp.participants) || [];

    console.log('[ENHANCED-TODO] Using new task recommendation agent...');

    // Utiliser le nouvel agent de recommandations
    const { data: recommendationResult, error: recommendationError } = await supabase.functions.invoke('task-recommendation-agent', {
      body: {
        task: { description },
        transcript: transcript,
        meetingContext: {
          title: meetingData?.title || 'Réunion',
          date: meetingData?.created_at,
          participants: participantList || participants.map((p: any) => p.name).join(', ')
        },
        participants: participants
      }
    });

    if (recommendationError) {
      console.error('[ENHANCED-TODO] Error calling task recommendation agent:', recommendationError);
      throw new Error('Failed to generate recommendation');
    }

    if (recommendationResult?.recommendation?.hasRecommendation) {
      const rec = recommendationResult.recommendation;
      
      console.log('[ENHANCED-TODO] Adding valuable AI recommendation...');
      
      // Add AI recommendation as a comment
      await supabase
        .from('todo_comments')
        .insert({
          todo_id: todoId,
          user_id: '00000000-0000-0000-0000-000000000000', // System user for AI
          comment: `💡 **Conseil IA:** ${rec.recommendation}${rec.externalProviders?.length > 0 ? `\n\n📋 **Prestataires suggérés:** ${rec.externalProviders.join(', ')}` : ''}${rec.estimatedCost ? `\n\n💰 **Coût estimé:** ${rec.estimatedCost}` : ''}`
        });

      // Sauvegarder la recommandation complète
      await supabase
        .from('todo_ai_recommendations')
        .insert({
          todo_id: todoId,
          recommendation_text: rec.recommendation,
          email_draft: rec.needsExternalEmail ? rec.emailDraft : null
        });
      
      console.log('[ENHANCED-TODO] Recommendation added successfully');
    } else {
      console.log('[ENHANCED-TODO] No valuable recommendation to add');
    }

    // Mark that AI recommendation was generated
    await supabase
      .from('todos')
      .update({ ai_recommendation_generated: true })
      .eq('id', todoId);

    return new Response(JSON.stringify({ 
      success: true, 
      recommendation: recommendationResult?.recommendation || null,
      contextUsed: recommendationResult?.contextUsed || {}
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[ENHANCED-TODO] Error generating AI recommendation:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
