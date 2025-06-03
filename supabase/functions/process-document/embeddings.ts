
// Embeddings generation utilities

export async function generateEmbeddings(chunks: string[], openaiApiKey: string): Promise<number[][]> {
  const embeddings: number[][] = [];
  
  console.log(`🔢 Generating embeddings for ${chunks.length} chunks...`);
  
  // Process in smaller batches to avoid rate limits and ensure reliability
  for (let i = 0; i < chunks.length; i += 2) {
    const batch = chunks.slice(i, i + 2);
    console.log(`⚡ Processing embedding batch ${Math.floor(i/2) + 1}/${Math.ceil(chunks.length/2)}`);
    
    try {
      const batchPromises = batch.map(async (chunk, batchIndex) => {
        console.log(`🔸 Generating embedding for chunk ${i + batchIndex + 1}: "${chunk.substring(0, 100)}..."`);
        
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: chunk.trim(),
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Embedding API error for chunk ${i + batchIndex + 1}:`, errorText);
          throw new Error(`Embedding failed: ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        if (!data.data || !data.data[0] || !data.data[0].embedding) {
          throw new Error('Invalid embedding response structure');
        }
        
        console.log(`✅ Generated embedding for chunk ${i + batchIndex + 1} (${data.data[0].embedding.length} dimensions)`);
        return data.data[0].embedding;
      });

      const batchResults = await Promise.all(batchPromises);
      embeddings.push(...batchResults);
      
      // Delay between batches to respect rate limits
      if (i + 2 < chunks.length) {
        console.log('⏱️ Waiting between batches...');
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
    } catch (error) {
      console.error(`❌ Batch ${Math.floor(i/2) + 1} failed:`, error.message);
      // Continue with next batch instead of failing completely
      console.log('⚠️ Continuing with next batch...');
    }
  }

  console.log(`✅ Successfully generated ${embeddings.length} embeddings out of ${chunks.length} chunks`);
  return embeddings;
}

export function chunkText(text: string, maxChunkSize: number = 400): string[] {
  if (!text || text.trim().length === 0) {
    console.log('⚠️ Empty text provided for chunking');
    return [];
  }

  const chunks = [];
  // Split by sentences first, then by paragraphs if sentences are too long
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (trimmedSentence.length === 0) continue;
    
    const potentialChunk = currentChunk + (currentChunk ? '. ' : '') + trimmedSentence;
    
    if (potentialChunk.length > maxChunkSize && currentChunk) {
      // Save current chunk and start new one
      chunks.push(currentChunk.trim());
      currentChunk = trimmedSentence;
    } else {
      currentChunk = potentialChunk;
    }
  }

  // Add the last chunk if it exists
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  // If no sentences were found, split by length
  if (chunks.length === 0 && text.trim()) {
    console.log('📝 No sentences found, splitting by character length...');
    for (let i = 0; i < text.length; i += maxChunkSize) {
      const chunk = text.substring(i, i + maxChunkSize).trim();
      if (chunk) chunks.push(chunk);
    }
  }

  console.log(`📝 Created ${chunks.length} text chunks`);
  return chunks;
}
