
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
    const { todoId, description, meetingContext } = await req.json();
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

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

    // Generate AI recommendation
    const prompt = `As an AI assistant, analyze this todo task and provide helpful recommendations or advice ONLY if you can add meaningful value. If the task is straightforward and doesn't need additional guidance, respond with "No additional recommendations needed."

Task: ${description}
Meeting Context: ${meetingContext || 'No additional context provided'}

Provide practical, actionable advice that could help with:
- Implementation strategies
- Potential challenges to consider
- Resources or tools that might be helpful
- Best practices
- Timeline considerations

Keep recommendations concise and focused. Only provide recommendations if they would genuinely help someone complete this task more effectively.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that provides practical recommendations for todo tasks. Only provide recommendations when they add genuine value.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    const aiData = await response.json();
    const recommendation = aiData.choices[0].message.content.trim();

    // Only add comment if AI provides meaningful recommendations
    if (recommendation && !recommendation.toLowerCase().includes('no additional recommendations needed')) {
      // Add AI recommendation as a comment
      await supabase
        .from('todo_comments')
        .insert({
          todo_id: todoId,
          user_id: '00000000-0000-0000-0000-000000000000', // System user for AI
          comment: `AI Generated: ${recommendation}`
        });
    }

    // Mark that AI recommendation was generated
    await supabase
      .from('todos')
      .update({ ai_recommendation_generated: true })
      .eq('id', todoId);

    return new Response(JSON.stringify({ success: true, recommendation }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating AI recommendation:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
