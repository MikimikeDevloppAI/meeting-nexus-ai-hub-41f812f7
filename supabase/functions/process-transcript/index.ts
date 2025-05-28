
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to chunk text by speakers (max 5000 chars, split only between speakers)
const chunkBySpeakers = (text: string, maxChunkSize: number = 5000): string[] => {
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const line of lines) {
    // Check if line starts with a speaker (e.g., "Dr. X:" or "Speaker A:")
    const isSpeakerLine = /^(Dr\.|Speaker|Docteur|M\.|Mme\.|Mr\.|Mrs\.)\s*\w+\s*:/.test(line.trim());
    
    if (isSpeakerLine && currentChunk.length > 0 && (currentChunk.length + line.length) > maxChunkSize) {
      // Start new chunk at speaker boundary if current chunk would exceed limit
      chunks.push(currentChunk.trim());
      currentChunk = line;
    } else {
      currentChunk += (currentChunk.length > 0 ? '\n' : '') + line;
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
  
  const prompt = `Nettoie ce transcript de réunion médicale. Participants: ${participantsList}

${chunk}

INSTRUCTIONS STRICTES:
1. Remplace "Speaker A", "Speaker B", etc. par les vrais noms des participants
2. Supprime COMPLÈTEMENT: hésitations (euh, hmm), répétitions, interruptions inutiles, mots de remplissage
3. Garde SEULEMENT le contenu médical/administratif important et utile
4. Corrige les erreurs évidentes de transcription
5. Format final: "Dr. X: [contenu nettoyé]"
6. Enlève tout ce qui n'est pas essentiel à la compréhension

Retourne UNIQUEMENT le transcript nettoyé sans commentaires:`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error for chunk ${chunkIndex + 1}: ${await response.text()}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
};

// Function to generate comprehensive summary
const generateSummary = async (cleanTranscript: string, participants: any[]): Promise<string> => {
  const participantsList = participants.map((p: any) => p.name).join(', ');
  
  const summaryPrompt = `Rédige un résumé COMPLET et STRUCTURÉ de cette réunion médicale. N'OUBLIE RIEN d'important:

${cleanTranscript}

Participants: ${participantsList}

Format requis:
**CONTEXTE ET OBJET**
[Détail de l'objet de la réunion et contexte]

**POINTS CLÉS DISCUTÉS**
• Organisation: [tous les points organisationnels abordés]
• Patients: [toutes les discussions concernant les patients]
• Équipement médical: [tout le matériel médical évoqué]
• Finances: [tous les aspects financiers mentionnés]
• Procédures: [toutes les procédures discutées]

**DÉCISIONS PRISES**
• [liste COMPLÈTE de toutes les décisions prises]

**INFORMATIONS IMPORTANTES**
• [toute information critique ou importante mentionnée]

Sois exhaustif et ne manque aucun détail important:`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: summaryPrompt }],
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

// Function to extract tasks from transcript
const extractTasks = async (cleanTranscript: string, participants: any[]): Promise<any[]> => {
  const participantsList = participants.map((p: any) => p.name).join(', ');
  
  const tasksPrompt = `Analyse ce transcript de réunion et extrais TOUTES les tâches/actions à faire mentionnées. Participants: ${participantsList}

${cleanTranscript}

INSTRUCTIONS:
1. Identifie TOUTES les tâches, actions, suivis mentionnés
2. Pour chaque tâche, détermine si elle est assignée à quelqu'un spécifiquement
3. Extrais la date limite si mentionnée (format YYYY-MM-DD)
4. Sois très précis sur la description de la tâche

Retourne UNIQUEMENT un JSON valide avec ce format exact (pas de markdown, pas de backticks):
{
  "tasks": [
    {
      "description": "Description précise de la tâche",
      "assigned_to": "Nom exact du participant ou null",
      "due_date": "YYYY-MM-DD ou null",
      "priority": "high ou medium ou low"
    }
  ]
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: tasksPrompt }],
      temperature: 0.1,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error for tasks: ${await response.text()}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content.trim();
  
  try {
    // Clean the content to remove markdown formatting if present
    const cleanContent = content.replace(/```json\s*/, '').replace(/```\s*$/, '').trim();
    const taskData = JSON.parse(cleanContent);
    return taskData.tasks || [];
  } catch (error) {
    console.error('Error parsing tasks JSON:', error);
    console.error('Raw content:', content);
    return [];
  }
};

// Function to generate embeddings for chunks
const generateEmbeddings = async (chunks: string[]): Promise<number[][]> => {
  const embeddings: number[][] = [];
  
  console.log(`Generating embeddings for ${chunks.length} chunks`);
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`Processing embedding for chunk ${i + 1}/${chunks.length} (length: ${chunk.length})`);

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: chunk,
      }),
    });

    if (!response.ok) {
      console.error(`OpenAI API error for embedding ${i + 1}: ${await response.text()}`);
      continue; // Skip this embedding but continue with others
    }

    const data = await response.json();
    embeddings.push(data.data[0].embedding);
  }
  
  console.log(`Successfully generated ${embeddings.length} embeddings`);
  return embeddings;
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

    // Check if transcript is too long for single processing
    const maxSingleProcessSize = 6000;
    let processedTranscript: string;

    if (transcript.length <= maxSingleProcessSize) {
      // Process as single chunk
      console.log('Processing transcript as single chunk');
      
      const participantsList = participants.map((p: any) => p.name).join(', ');
      const prompt = `Nettoie ce transcript de réunion médicale. Participants: ${participantsList}

${transcript}

INSTRUCTIONS STRICTES:
1. Remplace "Speaker A", "Speaker B", etc. par les vrais noms des participants
2. Supprime COMPLÈTEMENT: hésitations (euh, hmm), répétitions, interruptions inutiles, mots de remplissage
3. Garde SEULEMENT le contenu médical/administratif important et utile
4. Corrige les erreurs évidentes de transcription
5. Format final: "Dr. X: [contenu nettoyé]"
6. Enlève tout ce qui n'est pas essentiel à la compréhension

Retourne UNIQUEMENT le transcript nettoyé sans commentaires:`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 3000,
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
      
      const chunks = chunkBySpeakers(transcript, 4000);
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

    // Run summary, tasks extraction, and embeddings generation in parallel
    console.log('Starting parallel processing of summary, tasks, and embeddings...');
    
    // Create speaker-based chunks for embeddings
    const embeddingChunks = chunkBySpeakers(processedTranscript, 5000);
    console.log(`Created ${embeddingChunks.length} embedding chunks`);
    
    const [summaryResult, tasksResult, embeddingsResult] = await Promise.allSettled([
      generateSummary(processedTranscript, participants),
      extractTasks(processedTranscript, participants),
      generateEmbeddings(embeddingChunks)
    ]);

    let summary: string | null = null;
    let tasks: any[] = [];
    let embeddings: number[][] = [];

    // Handle summary result
    if (summaryResult.status === 'fulfilled') {
      summary = summaryResult.value;
      console.log(`Generated summary length: ${summary.length} characters`);
    } else {
      console.error('Error generating summary:', summaryResult.reason);
    }

    // Handle tasks result
    if (tasksResult.status === 'fulfilled') {
      tasks = tasksResult.value;
      console.log(`Extracted ${tasks.length} tasks`);
    } else {
      console.error('Error extracting tasks:', tasksResult.reason);
    }

    // Handle embeddings result
    if (embeddingsResult.status === 'fulfilled') {
      embeddings = embeddingsResult.value;
      console.log(`Generated ${embeddings.length} embeddings`);
    } else {
      console.error('Error generating embeddings:', embeddingsResult.reason);
    }

    return new Response(JSON.stringify({ 
      processedTranscript, 
      summary,
      tasks,
      embeddings: embeddings.length > 0 ? {
        chunks: embeddingChunks,
        embeddings: embeddings
      } : null
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
