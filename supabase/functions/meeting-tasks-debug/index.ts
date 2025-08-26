import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Import the unified todo service logic
async function callOpenAI(prompt: string, openAIKey: string, temperature: number = 0.3, model: string = 'gpt-4o', maxRetries: number = 3, maxTokens?: number) {
  console.log('🔄 [DEBUG] Making OpenAI API call...')
  console.log('🤖 [DEBUG] Using model:', model)
  console.log('📏 [DEBUG] Prompt length:', prompt.length, 'characters')
  
  const defaultMaxTokens = maxTokens || (model.includes('gpt-4.1') ? 16384 : 4096);
  console.log('🎯 [DEBUG] Max tokens:', defaultMaxTokens)
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📡 [DEBUG] Attempt ${attempt}/${maxRetries} - Making request to OpenAI...`);
      
      const isNewModel = /gpt-5.*|gpt-4\.1.*|o4.*|o3.*/.test(model);
      const payload: any = {
        model,
        messages: [{ role: 'user', content: prompt }],
      };
      
      if (!isNewModel && temperature !== null && temperature !== undefined) {
        payload.temperature = temperature;
      }
      
      if (isNewModel) {
        payload.max_completion_tokens = defaultMaxTokens;
      } else {
        payload.max_tokens = defaultMaxTokens;
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log(`📡 [DEBUG] OpenAI response status:`, response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [DEBUG] OpenAI API error:`, errorText);
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const result = data.choices[0]?.message?.content;
      
      if (!result) {
        throw new Error('OpenAI API returned empty response');
      }
      
      console.log('✅ [DEBUG] OpenAI API call successful');
      console.log('📏 [DEBUG] Response length:', result.length, 'characters');
      console.log('📄 [DEBUG] FULL RESPONSE:', result);
      
      return result;
      
    } catch (error) {
      lastError = error as Error;
      console.error(`❌ [DEBUG] OpenAI API call failed (attempt ${attempt}/${maxRetries}):`, error);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      const waitTime = Math.pow(2, attempt) * 1000;
      console.log(`⏳ [DEBUG] Waiting ${waitTime}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError || new Error('Unknown error during OpenAI API calls');
}

async function debugProcessTasksWithRecommendations(cleanedTranscript: string, meetingData: any, allUsers: any[], supabase: any, openAIKey: string) {
  console.log('🚀 [DEBUG] Starting UNIFIED todo generation debug...');
  console.log('👥 [DEBUG] Users provided:', allUsers.map(u => ({ id: u.id, name: u.name, email: u.email })));

  // Get existing todos
  console.log('📋 [DEBUG] Fetching existing todos...');
  const { data: existingTodos, error: todosError } = await supabase
    .from('todos')
    .select('description')
    .order('created_at', { ascending: false })
    .limit(50);

  if (todosError) {
    console.error('❌ [DEBUG] Error fetching existing todos:', todosError);
    return { processed: 0, successful: 0, failed: 0, error: 'Failed to fetch existing todos' };
  }

  console.log(`📋 [DEBUG] ${existingTodos?.length || 0} existing todos found`);

  const existingTodosText = existingTodos?.map(t => `- ${t.description}`).join('\n') || 'Aucune tâche existante';

  const prompt = `Tu es un assistant IA spécialisé dans l'analyse de transcripts de réunions pour extraire des tâches actionables, générer des recommandations intelligentes et rédiger des brouillons d'emails.

TRANSCRIPT DE LA RÉUNION:
${cleanedTranscript}

TÂCHES EXISTANTES (à éviter de dupliquer):
${existingTodosText}

UTILISATEURS DISPONIBLES POUR ASSIGNATION:
${allUsers.map(u => `- ${u.name} (${u.email})`).join('\n')}

INSTRUCTIONS STRICTES:

1. EXTRACTION DES TÂCHES:
- Extrais UNIQUEMENT les tâches explicitement mentionnées ou clairement implicites
- Évite les doublons avec les tâches existantes
- Chaque tâche doit être concrète et actionnable
- Description concise (max 100 caractères)

2. ASSIGNATION:
- Assigne à la personne mentionnée dans le contexte
- Si pas de mention explicite, assigne à la personne la plus logique selon le contexte
- Si aucune assignation logique: "Non assigné"

3. RECOMMANDATIONS IA:
- Pour chaque tâche, génère une recommandation pratique et personnalisée
- Inclus des conseils méthodologiques, des ressources, ou des étapes concrètes
- Adapte selon le contexte de la réunion et le profil de la personne

4. BROUILLONS D'EMAILS:
- Génère un email professionnel pour chaque tâche
- Ton respectueux et constructif
- Inclus le contexte de la réunion
- Appel à l'action clair

FORMAT DE RÉPONSE (JSON STRICT):
{
  "tasks": [
    {
      "description": "Description concise de la tâche",
      "assigned_to": "Nom exact de l'utilisateur ou 'Non assigné'",
      "ai_recommendation": "Recommandation détaillée et personnalisée pour accomplir cette tâche efficacement",
      "email_draft": "Objet: [Sujet pertinent]\\n\\nBonjour [Nom],\\n\\n[Corps de l'email professionnel]\\n\\nCordialement"
    }
  ]
}

RÉPONDS UNIQUEMENT AVEC LE JSON, AUCUN AUTRE TEXTE.`;

  console.log('📏 [DEBUG] Prompt length:', prompt.length, 'characters');
  console.log('🔄 [DEBUG] Calling OpenAI...');

  try {
    const aiResponse = await callOpenAI(prompt, openAIKey, 0.3, 'gpt-5-mini-2025-08-07');
    
    console.log('📥 [DEBUG] Raw AI Response:', aiResponse);
    console.log('📐 [DEBUG] Response length:', aiResponse.length);

    // Clean the response
    let cleanedResponse = aiResponse.trim();
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    console.log('🧹 [DEBUG] Cleaned Response:', cleanedResponse);

    let parsedData;
    try {
      parsedData = JSON.parse(cleanedResponse);
      console.log('✅ [DEBUG] JSON parsed successfully');
      console.log('📊 [DEBUG] Parsed data structure:', JSON.stringify(parsedData, null, 2));
    } catch (parseError) {
      console.error('❌ [DEBUG] JSON parsing failed:', parseError);
      console.error('🔍 [DEBUG] Failed to parse this text:', cleanedResponse);
      return { processed: 0, successful: 0, failed: 0, error: 'Failed to parse AI response as JSON' };
    }

    if (!parsedData.tasks || !Array.isArray(parsedData.tasks)) {
      console.error('❌ [DEBUG] Invalid response structure - no tasks array');
      console.error('📋 [DEBUG] Response structure:', Object.keys(parsedData));
      return { processed: 0, successful: 0, failed: 0, error: 'Invalid response structure' };
    }

    console.log(`📝 [DEBUG] Found ${parsedData.tasks.length} tasks to process`);

    let processed = 0;
    let successful = 0;
    let failed = 0;

    for (const [index, task] of parsedData.tasks.entries()) {
      console.log(`\n🔄 [DEBUG] Processing task ${index + 1}/${parsedData.tasks.length}`);
      console.log('📝 [DEBUG] Task data:', JSON.stringify(task, null, 2));
      
      processed++;

      // Validate task
      if (!task.description || typeof task.description !== 'string' || task.description.trim().length === 0) {
        console.error(`❌ [DEBUG] Task ${index + 1} missing or empty description`);
        failed++;
        continue;
      }

      // Find user
      let assignedUserId = null;
      if (task.assigned_to && task.assigned_to !== 'Non assigné') {
        const user = allUsers.find(u => u.name.toLowerCase() === task.assigned_to.toLowerCase());
        if (user) {
          assignedUserId = user.id;
          console.log(`👤 [DEBUG] Task assigned to: ${user.name} (${user.id})`);
        } else {
          console.log(`⚠️ [DEBUG] User not found: ${task.assigned_to}`);
        }
      }

      try {
        // Save todo
        console.log(`💾 [DEBUG] Saving todo: "${task.description}"`);
        const { data: todoData, error: todoError } = await supabase
          .from('todos')
          .insert({
            description: task.description,
            status: 'pending',
            priority: 'normal'
          })
          .select()
          .single();

        if (todoError) {
          console.error(`❌ [DEBUG] Failed to save todo:`, todoError);
          failed++;
          continue;
        }

        console.log(`✅ [DEBUG] Todo saved with ID: ${todoData.id}`);

        // Assign user if found
        if (assignedUserId) {
          const { error: assignError } = await supabase
            .from('todo_users')
            .insert({
              todo_id: todoData.id,
              user_id: assignedUserId
            });

          if (assignError) {
            console.error(`❌ [DEBUG] Failed to assign user:`, assignError);
          } else {
            console.log(`✅ [DEBUG] User assigned successfully`);
          }
        }

        // Link to meeting
        const { error: meetingError } = await supabase
          .from('todo_meetings')
          .insert({
            todo_id: todoData.id,
            meeting_id: meetingData.id
          });

        if (meetingError) {
          console.error(`❌ [DEBUG] Failed to link to meeting:`, meetingError);
        } else {
          console.log(`✅ [DEBUG] Todo linked to meeting`);
        }

        // Save AI recommendation
        if (task.ai_recommendation || task.email_draft) {
          const { error: recError } = await supabase
            .from('todo_ai_recommendations')
            .insert({
              todo_id: todoData.id,
              recommendation_text: task.ai_recommendation || '',
              email_draft: task.email_draft || ''
            });

          if (recError) {
            console.error(`❌ [DEBUG] Failed to save AI recommendation:`, recError);
          } else {
            console.log(`✅ [DEBUG] AI recommendation saved`);
          }
        }

        successful++;
        console.log(`✅ [DEBUG] Task ${index + 1} completed successfully`);

      } catch (error) {
        console.error(`❌ [DEBUG] Error processing task ${index + 1}:`, error);
        failed++;
      }
    }

    console.log(`\n📊 [DEBUG] FINAL SUMMARY:`);
    console.log(`   Processed: ${processed}`);
    console.log(`   Successful: ${successful}`);
    console.log(`   Failed: ${failed}`);

    return { processed, successful, failed };

  } catch (error) {
    console.error('❌ [DEBUG] Fatal error in todo processing:', error);
    return { processed: 0, successful: 0, failed: 0, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { meetingId } = await req.json();
    
    if (!meetingId) {
      return new Response(
        JSON.stringify({ error: 'Meeting ID is required' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openAIKey = Deno.env.get('OPENAI_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔍 [DEBUG] Fetching meeting data for:', meetingId);

    // Fetch meeting data
    const { data: meetingData, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .single();

    if (meetingError || !meetingData) {
      console.error('❌ [DEBUG] Meeting not found:', meetingError);
      return new Response(
        JSON.stringify({ error: 'Meeting not found' }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!meetingData.transcript) {
      console.error('❌ [DEBUG] No transcript found for meeting');
      return new Response(
        JSON.stringify({ error: 'No transcript found for this meeting' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [DEBUG] Meeting data fetched:', meetingData.title);

    // Fetch participants
    const { data: participants, error: participantsError } = await supabase
      .from('meeting_users')
      .select(`
        user_id,
        users!inner (
          id,
          name,
          email
        )
      `)
      .eq('meeting_id', meetingId);

    if (participantsError) {
      console.error('❌ [DEBUG] Error fetching participants:', participantsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch participants' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allUsers = participants?.map(p => p.users).filter(Boolean) || [];
    console.log('👥 [DEBUG] Participants fetched:', allUsers.length);

    // Debug process todos
    const result = await debugProcessTasksWithRecommendations(
      meetingData.transcript,
      meetingData,
      allUsers,
      supabase,
      openAIKey
    );

    return new Response(
      JSON.stringify({ 
        success: true, 
        meetingTitle: meetingData.title,
        participantsCount: allUsers.length,
        result 
      }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ [DEBUG] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});