
// Embeddings generation utilities

export async function generateEmbeddings(chunks: string[], openaiApiKey: string): Promise<number[][]> {
  const embeddings: number[][] = [];
  
  console.log(`🔢 Generating embeddings for ${chunks.length} chunks...`);
  
  // Process in smaller batches to avoid rate limits and ensure reliability
  const batchSize = 1; // Process one at a time for better reliability
  
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    console.log(`⚡ Processing embedding batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(chunks.length/batchSize)}`);
    
    try {
      const batchPromises = batch.map(async (chunk, batchIndex) => {
        const globalIndex = i + batchIndex + 1;
        console.log(`🔸 Generating embedding for chunk ${globalIndex}: "${chunk.substring(0, 100)}..."`);
        
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
          console.error(`❌ Embedding API error for chunk ${globalIndex}:`, errorText);
          throw new Error(`Embedding failed: ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        if (!data.data || !data.data[0] || !data.data[0].embedding) {
          console.error(`❌ Invalid embedding response for chunk ${globalIndex}:`, data);
          throw new Error('Invalid embedding response structure');
        }
        
        console.log(`✅ Generated embedding for chunk ${globalIndex} (${data.data[0].embedding.length} dimensions)`);
        return data.data[0].embedding;
      });

      const batchResults = await Promise.all(batchPromises);
      embeddings.push(...batchResults);
      
      // Delay between batches to respect rate limits
      if (i + batchSize < chunks.length) {
        console.log('⏱️ Waiting between batches...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      console.error(`❌ Batch ${Math.floor(i/batchSize) + 1} failed:`, error.message);
      // Instead of continuing, we'll throw to ensure proper error handling
      throw new Error(`Embedding generation failed at batch ${Math.floor(i/batchSize) + 1}: ${error.message}`);
    }
  }

  if (embeddings.length === 0) {
    throw new Error('No embeddings were generated');
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
