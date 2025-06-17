
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
    const { message, documentId, conversationHistory = [] } = await req.json();
    console.log(`[DOCUMENT_CHAT] Processing message for document: ${documentId}`);
    console.log(`[DOCUMENT_CHAT] Conversation history: ${conversationHistory.length} messages`);
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get document info including extracted text
    console.log('[DOCUMENT_CHAT] Fetching document data...');
    const { data: document, error: docError } = await supabase
      .from('uploaded_documents')
      .select('original_name, ai_generated_name, ai_summary, extracted_text')
      .eq('id', documentId)
      .single();

    if (docError) {
      console.error('[DOCUMENT_CHAT] Document error:', docError);
      throw new Error('Document not found');
    }

    if (!document.extracted_text) {
      console.log('[DOCUMENT_CHAT] No extracted text available');
      throw new Error('No extracted text available for this document');
    }

    console.log(`[DOCUMENT_CHAT] Found document with ${document.extracted_text.length} characters of extracted text`);

    // Prepare context from extracted text
    let context = document.extracted_text;
    
    // Truncate if text is too long (keep first 8000 characters to stay within token limits)
    const maxContextLength = 8000;
    if (context.length > maxContextLength) {
      context = context.substring(0, maxContextLength) + "... (texte tronqué)";
      console.log(`[DOCUMENT_CHAT] Truncated context to ${maxContextLength} characters`);
    }

    // Build conversation history for context
    let conversationContext = '';
    if (conversationHistory.length > 0) {
      console.log('[DOCUMENT_CHAT] Building conversation context from history...');
      conversationContext = '\n\nHISTORIQUE DE CONVERSATION RÉCENT:\n' + 
        conversationHistory
          .slice(-10) // Derniers 10 messages pour le contexte
          .map((msg: any) => `${msg.isUser ? 'Utilisateur' : 'Assistant'}: ${msg.content}`)
          .join('\n');
    }

    // Generate response using OpenAI with enhanced context
    console.log('[DOCUMENT_CHAT] Generating AI response with conversation context...');
    const systemPrompt = `Tu es un assistant IA spécialisé dans l'analyse de documents pour le cabinet d'ophtalmologie Dr Tabibian à Genève. Tu dois fournir des réponses TRÈS DÉTAILLÉES et COMPLÈTES.

INSTRUCTIONS IMPORTANTES :
- Sois EXTRÊMEMENT DÉTAILLÉ dans tes réponses
- Développe tous les aspects pertinents du document
- Fournis des explications approfondies et structurées
- Utilise des exemples concrets du document quand c'est possible
- Structure tes réponses avec des sections claires
- N'hésite pas à donner des informations contextuelles supplémentaires
- Sois précis et professionnel tout en étant exhaustif
- Cite les parties pertinentes du document de manière détaillée

Tu réponds uniquement aux questions concernant le document "${document.ai_generated_name || document.original_name}".

Règles importantes:
- Utilise uniquement les informations fournies dans le texte extrait du document
- Si l'information n'est pas dans le document, dis-le clairement et suggère des pistes
- Réponds en français de manière TRÈS claire, précise et DÉTAILLÉE
- Cite les parties pertinentes du document quand c'est utile
- Reste factuel et professionnel tout en étant exhaustif
- Tu peux faire référence à des sections spécifiques du texte
- MAINTIENS LE CONTEXTE de la conversation en cours
- Si l'utilisateur fait référence à quelque chose mentionné précédemment, utilise l'historique pour comprendre
- Développe tous les aspects pertinents de ta réponse de manière approfondie

${conversationContext}

TEXTE COMPLET DU DOCUMENT:
${context}`;

    const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 16384,
      }),
    });

    if (!chatResponse.ok) {
      throw new Error('Failed to generate AI response');
    }

    const chatData = await chatResponse.json();
    const response = chatData.choices[0]?.message?.content || 'Désolé, je n\'ai pas pu générer une réponse.';

    console.log('[DOCUMENT_CHAT] Response generated successfully with conversation context');

    return new Response(JSON.stringify({ 
      response,
      hasExtractedText: true,
      textLength: document.extracted_text.length,
      conversationLength: conversationHistory.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[DOCUMENT_CHAT] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
