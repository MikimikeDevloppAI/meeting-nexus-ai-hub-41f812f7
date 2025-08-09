
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { userMessage, rawTranscript, letterContent, chatHistory } = await req.json()

    if (!userMessage) {
      throw new Error('Message utilisateur requis')
    }

    const INFOMANIAK_API_KEY = Deno.env.get('INFOMANIAK_API_KEY')
    if (!INFOMANIAK_API_KEY) {
      throw new Error('INFOMANIAK_API_KEY is not configured')
    }

    // NEW: Allow configuring the Infomaniak App/Workspace ID via secret
    const INFOMANIAK_APP_ID = Deno.env.get('INFOMANIAK_APP_ID') || '105139'
    if (!Deno.env.get('INFOMANIAK_APP_ID')) {
      console.warn('[medical-letter-chat] INFOMANIAK_APP_ID not set, using default 105139')
    }
    const apiUrl = `https://api.infomaniak.com/1/ai/${INFOMANIAK_APP_ID}/openai/chat/completions`

    // Construire le contexte avec l'historique et le contenu actuel
    let contextPrompt = `Tu es un assistant spécialisé dans l'édition et la modification de lettres médicales pour un cabinet d'ophtalmologie.

CONTEXTE ACTUEL :

TRANSCRIPT BRUT :
${rawTranscript || "Aucun transcript disponible"}

LETTRE MÉDICALE ACTUELLE :
${letterContent || "Aucune lettre disponible"}

HISTORIQUE DE LA CONVERSATION :`

    // Ajouter l'historique de conversation
    if (chatHistory && chatHistory.length > 0) {
      chatHistory.forEach((msg: any) => {
        contextPrompt += `\n${msg.role === 'user' ? 'UTILISATEUR' : 'ASSISTANT'}: ${msg.content}`
      })
    } else {
      contextPrompt += "\nAucun historique de conversation"
    }

    contextPrompt += `

INSTRUCTIONS :
1. Réponds aux demandes de modification de la lettre médicale.
2. IMPORTANT: Réponds UNIQUEMENT en JSON valide (UTF-8), sans encadrer avec des blocs de code (pas de code fences).
3. Le JSON DOIT contenir exactement ces clés: "modifications" (string courte) et "letter" (string avec la lettre complète modifiée).
4. Fournis TOUJOURS la lettre médicale complète modifiée dans le champ "letter".
5. Explique brièvement les modifications dans le champ "modifications".
6. Adopte un langage médical professionnel, conserve les informations importantes et respecte la structure d'une lettre médicale.

FORMAT DE RÉPONSE REQUIS (JSON STRICT, SANS BLOC DE CODE):
{"modifications":"...","letter":"..."}

DEMANDE ACTUELLE DE L'UTILISATEUR :
${userMessage}`

    console.log('[medical-letter-chat] Sending request to Infomaniak API...', { appId: INFOMANIAK_APP_ID, model: 'llama3' })

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${INFOMANIAK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3',
        messages: [
          {
            role: 'user',
            content: contextPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[medical-letter-chat] Infomaniak API error:', response.status, errorText)
      throw new Error(`Infomaniak API error: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    console.log('[medical-letter-chat] Infomaniak API response received')

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from Infomaniak API')
    }

    const assistantResponse = data.choices[0].message.content || ''

    // Tenter d'abord de parser une réponse JSON stricte
    let modifiedLetter: string | null = null;
    let explanation: string = assistantResponse;

    const stripCodeFences = (s: string) => {
      const m = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
      return m ? m[1] : s;
    };

    // Try very robust JSON extraction
    const tryParse = (text: string) => {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    };

    const extractBalancedJson = (text: string): any | null => {
      const t = stripCodeFences(text).trim();
      // 1) Direct parse
      const direct = tryParse(t);
      if (direct && typeof direct === 'object') return direct;

      // 2) Regex to find an object containing "modifications" and "letter"
      const jsonLike = t.match(/{[\s\S]*?"modifications"\s*:\s*"(?:[^"\\]|\\.)*?"[\s\S]*?"letter"\s*:\s*"(?:[^"\\]|\\.)*?"[\s\S]*?}/);
      if (jsonLike) {
        const parsed = tryParse(jsonLike[0]);
        if (parsed && typeof parsed === 'object') return parsed;
      }

      // 3) Balanced braces scan
      const start = t.indexOf('{');
      if (start !== -1) {
        let inString = false;
        let escape = false;
        let depth = 0;
        for (let i = start; i < t.length; i++) {
          const ch = t[i];
          if (inString) {
            if (escape) {
              escape = false;
            } else if (ch === '\\') {
              escape = true;
            } else if (ch === '"') {
              inString = false;
            }
          } else {
            if (ch === '"') inString = true;
            else if (ch === '{') depth++;
            else if (ch === '}') {
              depth--;
              if (depth === 0) {
                const candidate = t.slice(start, i + 1);
                const parsed = tryParse(candidate);
                if (parsed && typeof parsed === 'object') return parsed;
              }
            }
          }
        }
      }

      return null;
    };

    const decodeJsonString = (s: string) => {
      try {
        // Wrap in quotes to decode escapes safely
        return JSON.parse(`"${s.replace(/"/g, '\\"')}"`);
      } catch {
        return s;
      }
    };

    // Extract values
    try {
      const parsed = extractBalancedJson(assistantResponse);
      if (parsed) {
        if (typeof parsed.letter === 'string') {
          modifiedLetter = parsed.letter.trim();
        }
        if (typeof parsed.modifications === 'string') {
          explanation = parsed.modifications.trim();
        }
      } else {
        // Heuristic extraction when JSON parse fails
        const letterField = assistantResponse.match(/"letter"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
        if (letterField) {
          modifiedLetter = decodeJsonString(letterField[1]).trim();
        }
        const modsField = assistantResponse.match(/"modifications"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
        if (modsField) {
          explanation = decodeJsonString(modsField[1]).trim();
        }
      }
    } catch (_e) {
      // keep fallbacks below
    }

    if (!modifiedLetter || modifiedLetter.length === 0) {
      // Fallback regex if model used headings
      const letterMatch = assistantResponse.match(/LETTRE MODIFI(?:É|E)E\s*:\s*([\s\S]*)$/i);
      if (letterMatch) {
        modifiedLetter = letterMatch[1].replace(/```/g, '').trim();
      }
      const explanationMatch = assistantResponse.match(/MODIFICATIONS EFFECTU(?:É|E)ES\s*:\s*([\s\S]*?)(?=LETTRE MODIFI(?:É|E)E|$)/i);
      if (explanationMatch) {
        explanation = explanationMatch[1].replace(/```/g, '').trim();
      }
    }

    if (!modifiedLetter || modifiedLetter.length === 0) {
      // Dernier recours: take everything after "LETTRE MODIFI"
      const fallback = assistantResponse.split(/LETTRE MODIFI(?:É|E)E\s*:\s*/i)[1];
      if (fallback) {
        modifiedLetter = fallback.replace(/```/g, '').trim();
      }
    }

    console.log('[medical-letter-chat] Extracted lengths', { letterLength: modifiedLetter?.length || 0, explanationLength: explanation?.length || 0 });
    return new Response(
      JSON.stringify({ 
        success: true, 
        response: explanation,
        modifiedLetter: modifiedLetter
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in medical-letter-chat function:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
