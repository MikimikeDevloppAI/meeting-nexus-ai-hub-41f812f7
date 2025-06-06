// Helper function to clean JSON response from OpenAI
export function cleanJSONResponse(content: string): string {
  // Remove markdown code blocks
  let cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  
  // Remove any leading/trailing whitespace
  cleaned = cleaned.trim();
  
  // If it starts with { or [, it's likely valid JSON
  if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
    return cleaned;
  }
  
  // Try to find JSON within the response
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }
  
  throw new Error('No valid JSON found in response');
}

// Helper function to format date
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Improved helper function to chunk text for embeddings with substantial content chunks
export const chunkText = (text: string, targetChunkSize: number = 500, minChunkSize: number = 300, overlap: number = 50): string[] => {
  if (!text || text.trim().length === 0) {
    return [];
  }

  console.log(`[CHUNKING-SUBSTANTIAL] Processing text of ${text.length} characters with target size ${targetChunkSize}`);
  
  // Split by paragraphs first for better semantic coherence
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const chunks: string[] = [];
  let totalCharactersProcessed = 0;
  
  for (const paragraph of paragraphs) {
    if (paragraph.trim().length === 0) continue;
    
    totalCharactersProcessed += paragraph.length;
    
    // If paragraph is within target range, use it as a chunk
    if (paragraph.length >= minChunkSize && paragraph.length <= targetChunkSize * 1.5) {
      chunks.push(`[Segment ${chunks.length + 1}] ${paragraph.trim()}`);
      console.log(`[CHUNKING-SUBSTANTIAL] Added substantial paragraph chunk: ${paragraph.length} chars`);
      continue;
    }
    
    // If paragraph is too small, try to combine with previous chunk
    if (paragraph.length < minChunkSize && chunks.length > 0) {
      const lastChunk = chunks[chunks.length - 1];
      const combinedLength = lastChunk.length + paragraph.length + 1;
      
      if (combinedLength <= targetChunkSize * 1.5) {
        chunks[chunks.length - 1] = `${lastChunk} ${paragraph.trim()}`;
        console.log(`[CHUNKING-SUBSTANTIAL] Combined small paragraph with previous chunk: ${combinedLength} chars`);
        continue;
      }
    }
    
    // Split large paragraphs by sentences but maintain substantial size
    if (paragraph.length > targetChunkSize * 1.5) {
      const sentences = paragraph.split(/[.!?]+\s+/).filter(s => s.trim().length > 0);
      let currentChunk = '';
      
      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i].trim();
        if (!sentence) continue;
        
        // Add proper punctuation if missing
        const punctuatedSentence = sentence.endsWith('.') || sentence.endsWith('!') || sentence.endsWith('?') 
          ? sentence 
          : sentence + '.';
        
        const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + punctuatedSentence;
        
        // Check if we should finalize current chunk
        const shouldFinalize = potentialChunk.length > targetChunkSize && currentChunk.length >= minChunkSize;
        
        if (shouldFinalize) {
          // Save current substantial chunk
          chunks.push(`[Segment ${chunks.length + 1}] ${currentChunk.trim()}`);
          console.log(`[CHUNKING-SUBSTANTIAL] Added substantial sentence-based chunk: ${currentChunk.length} chars`);
          
          // Start new chunk with intelligent overlap
          const words = currentChunk.split(' ');
          const overlapWords = words.slice(-Math.min(10, Math.floor(words.length / 4)));
          currentChunk = overlapWords.join(' ') + (overlapWords.length > 0 ? ' ' : '') + punctuatedSentence;
        } else {
          currentChunk = potentialChunk;
        }
      }
      
      // Add the final chunk if substantial enough
      if (currentChunk.trim().length >= minChunkSize) {
        chunks.push(`[Segment ${chunks.length + 1}] ${currentChunk.trim()}`);
        console.log(`[CHUNKING-SUBSTANTIAL] Added final substantial chunk: ${currentChunk.length} chars`);
      } else if (currentChunk.trim().length > 50 && chunks.length > 0) {
        // Merge small final chunk with last chunk if possible
        const lastChunk = chunks[chunks.length - 1];
        const combinedLength = lastChunk.length + currentChunk.length + 1;
        
        if (combinedLength <= targetChunkSize * 2) {
          chunks[chunks.length - 1] = `${lastChunk} ${currentChunk.trim()}`;
          console.log(`[CHUNKING-SUBSTANTIAL] Merged final small chunk with previous: ${combinedLength} chars`);
        } else {
          chunks.push(`[Final-segment ${chunks.length + 1}] ${currentChunk.trim()}`);
          console.log(`[CHUNKING-SUBSTANTIAL] Added final standalone chunk: ${currentChunk.length} chars`);
        }
      }
      continue;
    }
    
    // For medium paragraphs, add as is if substantial enough
    if (paragraph.length >= minChunkSize) {
      chunks.push(`[Segment ${chunks.length + 1}] ${paragraph.trim()}`);
      console.log(`[CHUNKING-SUBSTANTIAL] Added medium paragraph chunk: ${paragraph.length} chars`);
    }
  }
  
  // Quality check: ensure all chunks meet minimum standards
  const substantialChunks = chunks.filter(chunk => {
    const cleanChunk = chunk.replace(/^\[(?:Segment|Final-segment) \d+\]\s*/, '');
    return cleanChunk.length >= minChunkSize;
  });
  
  // Calculate statistics
  const chunkSizes = substantialChunks.map(chunk => {
    const cleanChunk = chunk.replace(/^\[(?:Segment|Final-segment) \d+\]\s*/, '');
    return cleanChunk.length;
  });
  
  const avgSize = chunkSizes.length > 0 ? Math.round(chunkSizes.reduce((a,b) => a+b, 0) / chunkSizes.length) : 0;
  const retentionRate = substantialChunks.length > 0 ? 
    chunkSizes.reduce((a,b) => a+b, 0) / text.length : 0;
  
  console.log(`[CHUNKING-SUBSTANTIAL] Final result: ${substantialChunks.length} substantial chunks`);
  console.log(`[CHUNKING-SUBSTANTIAL] Size distribution: min=${Math.min(...chunkSizes)}, max=${Math.max(...chunkSizes)}, avg=${avgSize}`);
  console.log(`[CHUNKING-SUBSTANTIAL] Content retention: ${(retentionRate * 100).toFixed(1)}%`);
  
  // If we have too few chunks or poor retention, create larger synthetic chunks
  if (substantialChunks.length < 3 && text.length > 1000) {
    console.log(`[CHUNKING-SUBSTANTIAL] Creating synthetic chunks for better coverage...`);
    const syntheticChunks: string[] = [];
    const words = text.split(/\s+/);
    let currentWords: string[] = [];
    
    for (const word of words) {
      currentWords.push(word);
      const currentText = currentWords.join(' ');
      
      if (currentText.length >= targetChunkSize) {
        syntheticChunks.push(`[Synthetic-segment ${syntheticChunks.length + 1}] ${currentText}`);
        // Keep some overlap
        currentWords = currentWords.slice(-overlap);
      }
    }
    
    // Add remaining words if substantial
    if (currentWords.length > 0 && currentWords.join(' ').length >= minChunkSize) {
      syntheticChunks.push(`[Synthetic-segment ${syntheticChunks.length + 1}] ${currentWords.join(' ')}`);
    }
    
    if (syntheticChunks.length > substantialChunks.length) {
      console.log(`[CHUNKING-SUBSTANTIAL] Using ${syntheticChunks.length} synthetic chunks instead`);
      return syntheticChunks;
    }
  }
  
  return substantialChunks;
};
