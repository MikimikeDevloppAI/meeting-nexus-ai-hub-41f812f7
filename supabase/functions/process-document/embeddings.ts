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
        
        const embedding = data.data[0].embedding;
        console.log(`✅ Generated embedding for chunk ${globalIndex} (${embedding.length} dimensions)`);
        
        // Validate embedding format
        if (!Array.isArray(embedding) || embedding.length === 0) {
          throw new Error(`Invalid embedding format for chunk ${globalIndex}`);
        }
        
        // Ensure all values are numbers
        const validEmbedding = embedding.map(val => {
          if (typeof val !== 'number' || isNaN(val)) {
            throw new Error(`Invalid embedding value: ${val}`);
          }
          return val;
        });
        
        return validEmbedding;
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
      throw new Error(`Embedding generation failed at batch ${Math.floor(i/batchSize) + 1}: ${error.message}`);
    }
  }

  if (embeddings.length === 0) {
    throw new Error('No embeddings were generated');
  }

  console.log(`✅ Successfully generated ${embeddings.length} embeddings out of ${chunks.length} chunks`);
  return embeddings;
}

export function chunkText(text: string, minChunkSize: number = 300, maxChunkSize: number = 1000): string[] {
  if (!text || text.trim().length === 0) {
    console.log('⚠️ Empty text provided for chunking');
    return [];
  }

  console.log(`📝 Chunking text of ${text.length} characters with min: ${minChunkSize}, max: ${maxChunkSize}`);

  const chunks = [];
  
  // Split by sentences using proper sentence endings
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (trimmedSentence.length === 0) continue;
    
    const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + trimmedSentence;
    
    // If adding this sentence would exceed max size and current chunk meets min size
    if (potentialChunk.length > maxChunkSize && currentChunk.length >= minChunkSize) {
      chunks.push(currentChunk.trim());
      console.log(`📝 Created chunk of ${currentChunk.length} characters`);
      currentChunk = trimmedSentence;
    } else {
      currentChunk = potentialChunk;
    }
  }

  // Add the last chunk if it meets minimum size requirement
  if (currentChunk.trim().length >= minChunkSize) {
    chunks.push(currentChunk.trim());
    console.log(`📝 Created final chunk of ${currentChunk.length} characters`);
  } else if (currentChunk.trim().length > 0) {
    // If the last chunk is too small, merge it with the previous chunk if possible
    if (chunks.length > 0) {
      const lastChunk = chunks[chunks.length - 1];
      const mergedChunk = lastChunk + ' ' + currentChunk.trim();
      if (mergedChunk.length <= maxChunkSize) {
        chunks[chunks.length - 1] = mergedChunk;
        console.log(`📝 Merged small final chunk with previous chunk (${mergedChunk.length} characters)`);
      } else {
        // If merging would exceed max size, keep as separate chunk even if small
        chunks.push(currentChunk.trim());
        console.log(`📝 Kept small final chunk separate (${currentChunk.length} characters)`);
      }
    } else {
      chunks.push(currentChunk.trim());
      console.log(`📝 Kept only chunk even if small (${currentChunk.length} characters)`);
    }
  }

  // Log statistics
  const chunkSizes = chunks.map(chunk => chunk.length);
  const avgSize = chunkSizes.length > 0 ? Math.round(chunkSizes.reduce((a,b) => a+b, 0) / chunkSizes.length) : 0;
  
  console.log(`📝 Created ${chunks.length} chunks`);
  console.log(`📊 Size distribution: min=${Math.min(...chunkSizes)}, max=${Math.max(...chunkSizes)}, avg=${avgSize}`);
  
  return chunks;
}

// Convert embeddings to PostgreSQL vector format
export function formatEmbeddingsForPostgres(embeddings: number[][]): string[] {
  return embeddings.map(embedding => {
    // Convert to PostgreSQL vector format: [1,2,3,4,...]
    const formatted = `[${embedding.join(',')}]`;
    console.log(`🔄 Formatted embedding: ${formatted.substring(0, 50)}... (${embedding.length} dimensions)`);
    return formatted;
  });
}
