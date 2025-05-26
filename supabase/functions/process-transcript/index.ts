
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to chunk text into smaller pieces
const chunkText = (text: string, maxChunkSize: number = 3000): string[] => {
  const sentences = text.split(/[.!?]+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += sentence + '.';
    }
  }
  
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(chunk => chunk.length > 0);
};

// Function to process a single chunk with OpenAI
const processChunk = async (chunk: string, participants: any[], chunkIndex: number): Promise<string> => {
  const participantsList = participants.map((p: any) => p.name).join(', ');
  
  const prompt = `Voici un extrait ${chunkIndex + 1} d'un transcript brut d'une réunion médicale.

${chunk}

INSTRUCTIONS:
1. Remplace "speaker 1", "speaker 2", etc. par les vrais noms des participants: ${participantsList}
2. Supprime tous les mots inutiles: hésitations (euh, hmm), répétitions, interruptions non pertinentes
3. Garde uniquement le contenu médical et administratif important
4. Corrige les erreurs de transcription évidentes
5. Structure clairement les interventions: "Dr. X: [contenu]"

Renvoie UNIQUEMENT le transcript nettoyé, sans commentaire.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error for chunk ${chunkIndex + 1}: ${await response.text()}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
};

// Function to generate summary
const generateSummary = async (cleanTranscript: string, participants: any[]): Promise<string> => {
  const participantsList = participants.map((p: any) => p.name).join(', ');
  
  const summaryPrompt = `Voici le transcript nettoyé d'une réunion administrative d'un cabinet médical:

${cleanTranscript}

Participants: ${participantsList}

INSTRUCTIONS:
Rédige un résumé structuré en français qui:

1. **CONTEXTE**: Résume brièvement l'objet de la réunion
2. **POINTS CLÉS PAR SUJET**: Organise par thématiques (ex: Organisation, Patients, Équipement, Finances, etc.)
3. **DÉCISIONS PRISES**: Liste les décisions importantes
4. **ACTIONS À SUIVRE**: Énumère les tâches et responsabilités assignées
5. **PROCHAINES ÉTAPES**: Mentionne les échéances et prochaines réunions

Format: utilise des titres clairs et des listes à puces. Reste factuel et concis tout en gardant les informations essentielles.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: summaryPrompt }
      ],
      temperature: 0.2,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error for summary: ${await response.text()}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript, participants, meetingId } = await req.json();

    if (!transcript) {
      throw new Error('No transcript provided');
    }

    if (!meetingId) {
      throw new Error('No meeting ID provided');
    }

    console.log(`Processing transcript for meeting ${meetingId} - Length: ${transcript.length} characters`);

    // Check if transcript is too long for single processing (>8000 characters)
    const maxSingleProcessSize = 8000;
    let processedTranscript: string;

    if (transcript.length <= maxSingleProcessSize) {
      // Process as single chunk
      console.log('Processing transcript as single chunk');
      
      const participantsList = participants.map((p: any) => p.name).join(', ');
      const prompt = `Voici un transcript brut d'une réunion administrative d'un cabinet médical.

${transcript}

INSTRUCTIONS:
1. Remplace "speaker 1", "speaker 2", etc. par les vrais noms des participants: ${participantsList}
2. Supprime tous les mots inutiles: hésitations (euh, hmm), répétitions, interruptions non pertinentes
3. Garde uniquement le contenu médical et administratif important
4. Corrige les erreurs de transcription évidentes
5. Structure clairement les interventions: "Dr. X: [contenu]"

Renvoie UNIQUEMENT le transcript nettoyé, sans commentaire.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'user', content: prompt }
          ],
          temperature: 0.1,
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${await response.text()}`);
      }

      const data = await response.json();
      processedTranscript = data.choices[0].message.content;
    } else {
      // Process in chunks
      console.log('Processing transcript in chunks due to length');
      
      const chunks = chunkText(transcript, 3000);
      console.log(`Split transcript into ${chunks.length} chunks`);
      
      const processedChunks: string[] = [];
      
      for (let i = 0; i < chunks.length; i++) {
        console.log(`Processing chunk ${i + 1}/${chunks.length}`);
        try {
          const processedChunk = await processChunk(chunks[i], participants, i);
          processedChunks.push(processedChunk);
        } catch (error) {
          console.error(`Error processing chunk ${i + 1}:`, error);
          // Fallback to original chunk if processing fails
          processedChunks.push(chunks[i]);
        }
      }
      
      // Combine all processed chunks
      processedTranscript = processedChunks.join('\n\n');
    }

    console.log(`Processed transcript length: ${processedTranscript.length} characters`);

    // Validate that we haven't lost significant content
    const originalWordCount = transcript.split(/\s+/).length;
    const processedWordCount = processedTranscript.split(/\s+/).length;
    const retentionRatio = processedWordCount / originalWordCount;

    console.log(`Word count - Original: ${originalWordCount}, Processed: ${processedWordCount}, Retention: ${(retentionRatio * 100).toFixed(1)}%`);

    // If we've lost more than 50% of the content, use original transcript
    if (retentionRatio < 0.5) {
      console.warn('Significant content loss detected, falling back to original transcript');
      processedTranscript = transcript;
    }

    // Generate summary
    console.log('Generating summary...');
    let summary: string | null = null;
    
    try {
      summary = await generateSummary(processedTranscript, participants);
      console.log(`Generated summary length: ${summary.length} characters`);
    } catch (error) {
      console.error('Error generating summary:', error);
      // Continue without summary if generation fails
    }

    return new Response(JSON.stringify({ 
      processedTranscript, 
      summary 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in process-transcript function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
