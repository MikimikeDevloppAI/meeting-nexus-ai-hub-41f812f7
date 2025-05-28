
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { texts } = await req.json();

    if (!texts || !Array.isArray(texts)) {
      throw new Error('No texts array provided');
    }

    console.log(`Generating embeddings for ${texts.length} texts`);

    // Generate embeddings for all texts
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      console.log(`Processing text ${i + 1}/${texts.length} (length: ${text.length})`);

      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error for text ${i + 1}: ${await response.text()}`);
      }

      const data = await response.json();
      embeddings.push(data.data[0].embedding);
    }

    console.log(`Successfully generated ${embeddings.length} embeddings`);

    return new Response(JSON.stringify({ embeddings }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-embeddings function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
