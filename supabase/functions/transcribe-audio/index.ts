
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

    // Préparer FormData pour l'API Infomaniak avec le modèle "whisper"
    const whisperFormData = new FormData();
    
    whisperFormData.append('file', audioFile, audioFile.name);
    whisperFormData.append('model', 'whisper');
    whisperFormData.append('language', 'fr');
    whisperFormData.append('response_format', 'json');

    console.log('Envoi de la transcription à Infomaniak avec le modèle whisper...');
    console.log('Type du fichier envoyé:', audioFile.type);

    const response = await fetch('https://api.infomaniak.com/1/ai/105139/openai/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${infomaniakApiKey}`,
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

    // Vérifier si la réponse contient un batch_id (traitement asynchrone)
    if (result.batch_id) {
      console.log('Traitement asynchrone détecté, batch_id:', result.batch_id);
      
      // Attendre et récupérer le résultat du batch
      let attempts = 0;
      const maxAttempts = 30; // Maximum 30 tentatives (30 secondes)
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Attendre 1 seconde
        attempts++;
        
        console.log(`Tentative ${attempts}: Vérification du statut du batch`);
        
        // Récupérer le statut du batch
        const batchResponse = await fetch(`https://api.infomaniak.com/1/ai/105139/openai/batches/${result.batch_id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${infomaniakApiKey}`,
          },
        });
        
        if (batchResponse.ok) {
          const batchResult = await batchResponse.json();
          console.log('Statut du batch:', batchResult);
          
          // Si le batch est terminé et contient le texte
          if (batchResult.status === 'completed' && batchResult.output) {
            console.log('Transcription terminée:', batchResult.output);
            return new Response(
              JSON.stringify({ 
                text: batchResult.output.text || batchResult.output,
                success: true 
              }),
              { 
                headers: { 
                  ...corsHeaders, 
                  'Content-Type': 'application/json' 
                } 
              }
            );
          }
          
          // Si le batch a échoué
          if (batchResult.status === 'failed') {
            throw new Error('La transcription a échoué');
          }
        }
      }
      
      throw new Error('Timeout: La transcription a pris trop de temps');
    }

    // Si la réponse contient directement le texte (traitement synchrone)
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
