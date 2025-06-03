
// Embeddings generation utilities

export async function generateEmbeddings(chunks: string[], openaiApiKey: string): Promise<number[][]> {
  const embeddings: number[][] = [];
  
  console.log(`🔢 Generating embeddings for ${chunks.length} chunks...`);
  
  // Process in batches to avoid rate limits
  for (let i = 0; i < chunks.length; i += 3) {
    const batch = chunks.slice(i, i + 3);
    console.log(`⚡ Processing embedding batch ${Math.floor(i/3) + 1}/${Math.ceil(chunks.length/3)}`);
    
    try {
      const batchPromises = batch.map(async (chunk) => {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: chunk,
          }),
        });

        if (!response.ok) {
          throw new Error(`Embedding failed: ${response.statusText}`);
        }

        const data = await response.json();
        return data.data[0].embedding;
      });

      const batchResults = await Promise.all(batchPromises);
      embeddings.push(...batchResults);
      
      // Small delay between batches
      if (i + 3 < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
    } catch (error) {
      console.log(`⚠️ Batch ${i} failed:`, error.message);
      // Continue with next batch
    }
  }

  console.log(`✅ Generated ${embeddings.length} embeddings`);
  return embeddings;
}

export function chunkText(text: string, maxChunkSize: number): string[] {
  const chunks = [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if ((currentChunk + ' ' + trimmedSentence).length > maxChunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = trimmedSentence;
    } else {
      currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
