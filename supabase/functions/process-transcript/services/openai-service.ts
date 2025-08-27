
export async function callOpenAI(prompt: string, openAIKey: string, temperature: number | null = 0.3, model: string = 'gpt-4o', maxRetries: number = 3, maxTokens?: number) {
  console.log('🔄 Making OpenAI API call...')
  console.log('🤖 Using model:', model)
  console.log('📏 Prompt length:', prompt.length, 'characters')
  console.log('🔁 Max retries:', maxRetries)
  
  // Définir max_tokens selon le modèle si non spécifié
  const defaultMaxTokens = maxTokens || (model.includes('gpt-5') ? 8192 : model.includes('gpt-4.1') ? 16384 : 4096);
  console.log('🎯 Max tokens:', defaultMaxTokens)
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📡 Attempt ${attempt}/${maxRetries} - Making request to OpenAI...`);
      
      const isNewModel = /gpt-5.*|gpt-4\.1.*|o4.*|o3.*/.test(model);
      const payload: any = {
        model,
        messages: [{ role: 'user', content: prompt }],
      };
      
      // GPT-5 has built-in web search capabilities, no explicit tools needed
      if (model.includes('gpt-5')) {
        console.log('🌐 Using GPT-5 with built-in web search capabilities');
      }
      
      // Only add temperature for older models
      if (!isNewModel && temperature !== null && temperature !== undefined) {
        payload.temperature = temperature;
        console.log('🌡️ Adding temperature:', temperature, 'to older model');
      } else if (isNewModel) {
        console.log('🌡️ Skipping temperature for newer model:', model);
      }
      
      if (isNewModel) {
        // Newer models require 'max_completion_tokens'
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

      console.log(`📡 OpenAI response status (attempt ${attempt}):`, response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ OpenAI API error response (attempt ${attempt}):`, errorText);
        
        // Si c'est une erreur 4xx (client error), ne pas retry
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`OpenAI API client error: ${response.status} - ${errorText}`);
        }
        
        // Pour les erreurs 5xx (server error), continuer à retry
        throw new Error(`OpenAI API server error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const result = data.choices[0]?.message?.content;
      
      if (!result) {
        throw new Error('OpenAI API returned empty response');
      }
      
      console.log('✅ OpenAI API call successful');
      console.log('📏 Response length:', result.length, 'characters');
      
      return result;
      
    } catch (error) {
      lastError = error as Error;
      console.error(`❌ OpenAI API call failed (attempt ${attempt}/${maxRetries}):`, error);
      
      // Si c'est une erreur client (4xx), ne pas retry
      if (error.message.includes('client error')) {
        throw error;
      }
      
      // Si c'est le dernier essai, throw l'erreur
      if (attempt === maxRetries) {
        console.error(`❌ All ${maxRetries} attempts failed. Final error:`, error);
        throw error;
      }
      
      // Attendre avant le prochain essai (backoff exponentiel)
      const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s...
      console.log(`⏳ Waiting ${waitTime}ms before retry ${attempt + 1}...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  // Ne devrait jamais arriver, mais au cas où
  throw lastError || new Error('Unknown error during OpenAI API calls');
}
