
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
    console.log('Résultat complet de l\'API Infomaniak:', JSON.stringify(result, null, 2));

    // Vérifier si la réponse contient un batch_id (traitement asynchrone)
    if (result.batch_id) {
      console.log('Traitement asynchrone détecté, batch_id:', result.batch_id);
      
      // Attendre et récupérer le résultat du batch avec polling optimisé
      let attempts = 0;
      const maxAttempts = 15; // Réduire significativement le nombre de tentatives
      
      while (attempts < maxAttempts) {
        // Délai progressif plus court
        const delay = attempts < 3 ? 1000 : 2000; // 1s puis 2s
        await new Promise(resolve => setTimeout(resolve, delay));
        attempts++;
        
        console.log(`Tentative ${attempts}: Vérification du statut du batch avec délai de ${delay}ms`);
        
        try {
          const batchUrl = `https://api.infomaniak.com/1/ai/105139/results/${result.batch_id}`;
          console.log('URL de vérification des résultats:', batchUrl);
          
          const batchResponse = await fetch(batchUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${infomaniakApiKey}`,
              'Content-Type': 'application/json',
            },
          });
          
          console.log(`Réponse résultats (tentative ${attempts}):`, batchResponse.status);
          
          if (batchResponse.ok) {
            const batchResult = await batchResponse.json();
            console.log(`Résultat complet (tentative ${attempts}):`, JSON.stringify(batchResult, null, 2));
            
            // Infomaniak retourne "success" comme statut
            if (batchResult.status === 'success') {
              console.log('Batch terminé avec succès!');
              
              // Extraire le texte de la propriété "data" qui contient du JSON
              let transcriptionText = '';
              
              if (batchResult.data) {
                try {
                  // La propriété "data" contient du JSON stringifié
                  const dataObj = JSON.parse(batchResult.data);
                  if (dataObj.text) {
                    transcriptionText = dataObj.text;
                  }
                } catch (parseError) {
                  console.error('Erreur lors du parsing de data:', parseError);
                  // Fallback: essayer d'utiliser data directement
                  transcriptionText = batchResult.data;
                }
              }
              
              console.log('Texte de transcription extrait:', transcriptionText);
              
              if (transcriptionText) {
                return new Response(
                  JSON.stringify({ 
                    text: transcriptionText,
                    success: true 
                  }),
                  { 
                    headers: { 
                      ...corsHeaders, 
                      'Content-Type': 'application/json' 
                    } 
                  }
                );
              } else {
                console.error('Aucun texte trouvé dans la réponse success:', batchResult);
                throw new Error('Transcription terminée mais aucun texte trouvé');
              }
            }
            
            // Si le batch a échoué
            if (batchResult.status === 'failed' || batchResult.status === 'error') {
              console.error('Batch échoué:', batchResult);
              throw new Error(`La transcription a échoué: ${batchResult.error || batchResult.message || 'Erreur inconnue'}`);
            }
            
            // Si le batch est encore en cours de traitement
            if (batchResult.status === 'processing' || batchResult.status === 'pending' || batchResult.status === 'queued' || batchResult.status === 'in_progress') {
              console.log(`Batch encore en traitement (statut: ${batchResult.status}), attente...`);
              continue;
            }
            
            // Statut inconnu - arrêter après quelques tentatives
            console.warn('Statut de batch inconnu:', batchResult.status);
            if (attempts >= 5) {
              throw new Error(`Statut de batch non reconnu: ${batchResult.status}`);
            }
            
          } else {
            const errorText = await batchResponse.text();
            console.warn(`Erreur HTTP lors de la vérification des résultats (tentative ${attempts}):`, batchResponse.status, errorText);
            
            // Si c'est une erreur 404, le batch n'existe peut-être pas encore
            if (batchResponse.status === 404 && attempts < 5) {
              console.log('Résultat pas encore disponible (404), attente...');
              continue;
            }
            
            throw new Error(`Erreur lors de la récupération des résultats: ${batchResponse.status}`);
          }
        } catch (batchError) {
          console.warn(`Erreur lors de la vérification des résultats (tentative ${attempts}):`, batchError.message);
          
          // Pour les erreurs de réseau, continuer à essayer
          if (batchError.name === 'TypeError' && attempts < 5) {
            continue;
          }
          
          throw batchError;
        }
      }
      
      throw new Error(`Timeout: La transcription a pris trop de temps (plus de ${maxAttempts} tentatives)`);
    }

    // Si la réponse contient directement le texte (traitement synchrone)
    console.log('Traitement synchrone détecté');
    
    let transcriptionText = '';
    if (result.text) {
      transcriptionText = result.text;
    } else if (result.transcript) {
      transcriptionText = result.transcript;
    } else {
      console.warn('Structure de réponse synchrone inattendue:', result);
      transcriptionText = result.toString();
    }
    
    return new Response(
      JSON.stringify({ 
        text: transcriptionText,
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
