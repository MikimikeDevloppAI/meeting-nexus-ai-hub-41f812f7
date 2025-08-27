
export async function callOpenAI(prompt: string, openAIKey: string, temperature?: number, model: string = 'gpt-4o', maxRetries: number = 3, maxTokens?: number, traceId?: string) {
  const callTraceId = traceId || `openai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const callStartTime = Date.now();
  
  console.log(`[TRACE:${callTraceId}] 🔄 Starting OpenAI API call session`)
  console.log(`[TRACE:${callTraceId}] 🤖 Configuration:`, {
    model,
    promptLength: prompt.length,
    maxRetries,
    hasTemperature: temperature !== undefined,
    hasMaxTokens: maxTokens !== undefined,
    timestamp: new Date().toISOString()
  })
  
  // Définir max_tokens selon le modèle si non spécifié - undefined permet des réponses illimitées
  const defaultMaxTokens = maxTokens === undefined ? undefined : (maxTokens || (model.includes('gpt-4.1') ? 16384 : 4096));
  console.log('🎯 Max tokens:', defaultMaxTokens === undefined ? 'UNLIMITED' : defaultMaxTokens)
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const attemptStartTime = Date.now();
      console.log(`[TRACE:${callTraceId}] 📡 Attempt ${attempt}/${maxRetries} - Making request to OpenAI...`);
      
      const isNewModel = /gpt-5.*|gpt-4\.1.*|o4.*|o3.*/.test(model);
      const isGPT5 = /gpt-5.*/.test(model);
      
      console.log(`[TRACE:${callTraceId}] 🔍 Model analysis:`, {
        isNewModel,
        isGPT5,
        modelType: isGPT5 ? 'GPT-5' : isNewModel ? 'New Model' : 'Legacy Model'
      });
      
      const payload: any = {
        model,
        messages: [{ role: 'user', content: prompt }],
      };
      
      // GPT-5 specific configuration
      if (isGPT5) {
        console.log(`[TRACE:${callTraceId}] ⚡ GPT-5 detected - applying specialized configuration`);
        payload.reasoning_effort = 'medium'; // Équilibrer qualité/performance
        console.log(`[TRACE:${callTraceId}] 🧠 Setting reasoning_effort to medium for GPT-5`);
        
        // GPT-5 ne supporte pas temperature
        console.log(`[TRACE:${callTraceId}] 🌡️ Skipping temperature for GPT-5 (not supported)`);
        
        // Ajouter max_completion_tokens seulement si spécifié
        if (defaultMaxTokens !== undefined) {
          payload.max_completion_tokens = defaultMaxTokens;
          console.log(`[TRACE:${callTraceId}] 🎯 Adding max_completion_tokens:`, defaultMaxTokens);
        } else {
          console.log(`[TRACE:${callTraceId}] 🔄 No token limit - allowing unlimited response for GPT-5`);
        }
      } else {
        // Configuration pour modèles plus anciens
        if (!isNewModel && temperature !== null && temperature !== undefined) {
          payload.temperature = temperature;
          console.log('🌡️ Adding temperature:', temperature, 'to older model');
        } else if (isNewModel) {
          console.log('🌡️ Skipping temperature for newer model:', model);
        }
        
        if (isNewModel) {
          // Newer models require 'max_completion_tokens'
          if (defaultMaxTokens !== undefined) {
            payload.max_completion_tokens = defaultMaxTokens;
          }
        } else {
          if (defaultMaxTokens !== undefined) {
            payload.max_tokens = defaultMaxTokens;
          }
        }
      }

      console.log(`[TRACE:${callTraceId}] 📤 Sending request to OpenAI:`, {
        url: 'https://api.openai.com/v1/chat/completions',
        method: 'POST',
        payloadKeys: Object.keys(payload),
        payloadSize: JSON.stringify(payload).length + ' bytes'
      });

      const fetchStartTime = Date.now();
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const fetchDuration = Date.now() - fetchStartTime;

      console.log(`[TRACE:${callTraceId}] 📡 OpenAI response received (attempt ${attempt}) after ${fetchDuration}ms:`, {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: {
          contentType: response.headers.get('content-type'),
          contentLength: response.headers.get('content-length')
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[TRACE:${callTraceId}] ❌ OpenAI API error response (attempt ${attempt}):`, {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText.substring(0, 500),
          isClientError: response.status >= 400 && response.status < 500,
          isServerError: response.status >= 500
        });
        
        // Si c'est une erreur 4xx (client error), ne pas retry
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`OpenAI API client error: ${response.status} - ${errorText}`);
        }
        
        // Pour les erreurs 5xx (server error), continuer à retry
        throw new Error(`OpenAI API server error: ${response.status} - ${errorText}`);
      }

      const parseStartTime = Date.now();
      const data = await response.json();
      const result = data.choices[0]?.message?.content;
      const parseDuration = Date.now() - parseStartTime;
      const attemptDuration = Date.now() - attemptStartTime;
      
      if (!result) {
        console.error(`[TRACE:${callTraceId}] ❌ Empty response from OpenAI:`, {
          hasData: !!data,
          hasChoices: !!data.choices,
          choicesLength: data.choices?.length,
          firstChoice: data.choices?.[0]
        });
        throw new Error('OpenAI API returned empty response');
      }
      
      const totalDuration = Date.now() - callStartTime;
      console.log(`[TRACE:${callTraceId}] ✅ OpenAI API call successful`);
      console.log(`[TRACE:${callTraceId}] 📊 Success metrics:`, {
        responseLength: result.length,
        attemptDuration,
        parseDuration,
        totalDuration,
        attempt,
        model
      });
      
      return result;
      
    } catch (error) {
      lastError = error as Error;
      const attemptDuration = Date.now() - attemptStartTime;
      console.error(`[TRACE:${callTraceId}] ❌ OpenAI API call failed (attempt ${attempt}/${maxRetries}) after ${attemptDuration}ms:`, {
        errorMessage: error.message,
        errorName: error.name,
        isClientError: error.message.includes('client error'),
        attempt,
        totalRetries: maxRetries
      });
      
      // Si c'est une erreur client (4xx), ne pas retry
      if (error.message.includes('client error')) {
        console.error(`[TRACE:${callTraceId}] ❌ Client error - no retry`);
        throw error;
      }
      
      // Si c'est le dernier essai, throw l'erreur
      if (attempt === maxRetries) {
        const totalDuration = Date.now() - callStartTime;
        console.error(`[TRACE:${callTraceId}] ❌ All ${maxRetries} attempts failed after ${totalDuration}ms. Final error:`, error);
        throw error;
      }
      
      // Attendre avant le prochain essai (backoff exponentiel)
      const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s...
      console.log(`[TRACE:${callTraceId}] ⏳ Waiting ${waitTime}ms before retry ${attempt + 1}...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  // Ne devrait jamais arriver, mais au cas où
  throw lastError || new Error('Unknown error during OpenAI API calls');
}
