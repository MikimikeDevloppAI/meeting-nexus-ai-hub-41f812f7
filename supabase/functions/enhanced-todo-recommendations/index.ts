
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
    
    console.log('[ENHANCED-TODO] Analyse contextuelle pour:', description.substring(0, 50));
    
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

    // Récupérer le transcript ET les tâches existantes pour contexte
    const { data: meetingData } = await supabase
      .from('meetings')
      .select('transcript, title, created_at')
      .eq('id', meetingId)
      .single();

    // Récupérer toutes les tâches existantes pour éviter doublons
    const { data: existingTodos } = await supabase
      .from('todos')
      .select('id, description, status')
      .in('status', ['pending', 'confirmed'])
      .neq('id', todoId) // Exclure la tâche actuelle
      .limit(50);

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

    console.log('[ENHANCED-TODO] Utilisation agent contextuel avec tâches existantes...');

    // Utiliser l'agent de recommandations avec contexte amélioré
    const { data: recommendationResult, error: recommendationError } = await supabase.functions.invoke('task-recommendation-agent', {
      body: {
        task: { description },
        transcript: transcript,
        meetingContext: {
          title: meetingData?.title || 'Réunion',
          date: meetingData?.created_at,
          participants: participantList || participants.map((p: any) => p.name).join(', '),
          existingTodos: existingTodos || []
        },
        participants: participants
      }
    });

    if (recommendationError) {
      console.error('[ENHANCED-TODO] Erreur agent contextuel:', recommendationError);
      throw new Error('Failed to generate contextual recommendation');
    }

    if (recommendationResult?.recommendation?.hasRecommendation) {
      const rec = recommendationResult.recommendation;
      
      console.log('[ENHANCED-TODO] Ajout recommandation contextuelle...');
      
      // Construire le commentaire avec analyse contextuelle
      let comment = `💡 **Analyse Contextuelle IA:**`;
      
      if (rec.contextAnalysis) {
        comment += `\n📋 **Contexte:** ${rec.contextAnalysis}`;
      }
      
      if (rec.duplicateTask) {
        comment += `\n⚠️ **Attention:** ${rec.duplicateTask}`;
      }
      
      comment += `\n\n💡 **Recommandation:** ${rec.recommendation}`;
      
      if (rec.externalProviders?.length > 0) {
        comment += `\n\n📋 **Prestataires:** ${rec.externalProviders.join(', ')}`;
      }
      
      if (rec.estimatedCost) {
        comment += `\n\n💰 **Coût estimé:** ${rec.estimatedCost}`;
      }

      // Add AI recommendation as a comment
      await supabase
        .from('todo_comments')
        .insert({
          todo_id: todoId,
          user_id: '00000000-0000-0000-0000-000000000000', // System user for AI
          comment: comment
        });

      // Sauvegarder la recommandation avec coordonnées validées
      const recommendationData: any = {
        todo_id: todoId,
        recommendation_text: rec.recommendation,
        email_draft: rec.needsExternalEmail ? rec.emailDraft : null
      };

      await supabase
        .from('todo_ai_recommendations')
        .insert(recommendationData);
      
      console.log('[ENHANCED-TODO] Recommandation contextuelle ajoutée avec succès');
    } else {
      console.log('[ENHANCED-TODO] Aucune recommandation contextuelle pertinente');
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
    console.error('[ENHANCED-TODO] Erreur génération recommandation contextuelle:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
