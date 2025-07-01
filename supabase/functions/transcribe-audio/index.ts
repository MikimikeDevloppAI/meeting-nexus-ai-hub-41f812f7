
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const infomaniakApiKey = Deno.env.get('INFOMANIAK_API_KEY');
    
    if (!infomaniakApiKey) {
      throw new Error('Clé API Infomaniak non configurée');
    }

    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      throw new Error('Aucun fichier audio fourni');
    }

    console.log('Fichier audio reçu:', audioFile.name, audioFile.type, audioFile.size);

    // Préparer FormData pour l'API Infomaniak Whisper v2
    const whisperFormData = new FormData();
    whisperFormData.append('file', audioFile);
    whisperFormData.append('model', 'whisperV2');
    whisperFormData.append('language', 'fr');
    whisperFormData.append('response_format', 'json');

    console.log('Envoi de la transcription à Infomaniak Whisper v2...');

    const response = await fetch('https://api.infomaniak.com/1/ai/105139/openai/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${infomaniakApiKey}`,
        // Ne pas définir Content-Type pour FormData - le navigateur le fera automatiquement
      },
      body: whisperFormData,
    });

    console.log('Réponse de l\'API Infomaniak:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erreur API Infomaniak:', errorText);
      throw new Error(`Erreur API Infomaniak: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Résultat de la transcription:', result);

    return new Response(
      JSON.stringify({ 
        text: result.text || '',
        success: true 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Erreur de transcription:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
      }
    );
  }
});
