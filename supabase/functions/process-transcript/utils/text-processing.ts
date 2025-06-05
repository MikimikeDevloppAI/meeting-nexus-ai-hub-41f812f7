
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

// Improved helper function to chunk text for embeddings with better content preservation
export const chunkText = (text: string, maxChunkSize: number = 800, overlap: number = 100): string[] => {
  if (!text || text.trim().length === 0) {
    return [];
  }

  console.log(`[CHUNKING-EDGE] Processing text of ${text.length} characters`);
  
  // Split by paragraphs first, then sentences
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let totalCharactersProcessed = 0;
  
  for (const paragraph of paragraphs) {
    if (paragraph.trim().length === 0) continue;
    
    totalCharactersProcessed += paragraph.length;
    
    // If paragraph is small enough, add it as a chunk (reduced threshold)
    if (paragraph.length <= maxChunkSize) {
      if (paragraph.trim().length >= 30) { // Reduced from 150 to 30
        chunks.push(`[Segment ${chunks.length + 1}] ${paragraph.trim()}`);
        console.log(`[CHUNKING-EDGE] Added small paragraph chunk: ${paragraph.length} chars`);
      } else {
        // Preserve small paragraphs by combining with previous chunk if possible
        if (chunks.length > 0 && chunks[chunks.length - 1].length + paragraph.length <= maxChunkSize) {
          chunks[chunks.length - 1] += ` ${paragraph.trim()}`;
          console.log(`[CHUNKING-EDGE] Combined small paragraph with previous chunk`);
        } else {
          // Create a minimal chunk to not lose content
          chunks.push(`[Mini-segment ${chunks.length + 1}] ${paragraph.trim()}`);
          console.log(`[CHUNKING-EDGE] Created mini-chunk to preserve content: ${paragraph.length} chars`);
        }
      }
      continue;
    }
    
    // Split large paragraphs by sentences with improved logic
    const sentences = paragraph.split(/[.!?]+\s+/);
    let currentChunk = '';
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      if (!sentence) continue;
      
      // Add proper punctuation if missing
      const punctuatedSentence = sentence.endsWith('.') || sentence.endsWith('!') || sentence.endsWith('?') 
        ? sentence 
        : sentence + '.';
      
      // Check if adding this sentence would exceed the limit
      const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + punctuatedSentence;
      
      if (potentialChunk.length > maxChunkSize && currentChunk.length > 0) {
        // Save current chunk with reduced minimum threshold
        if (currentChunk.trim().length >= 50) { // Reduced from 150 to 50
          chunks.push(`[Segment ${chunks.length + 1}] ${currentChunk.trim()}`);
          console.log(`[CHUNKING-EDGE] Added sentence-based chunk: ${currentChunk.length} chars`);
        }
        
        // Start new chunk with smart overlap
        const words = currentChunk.split(' ');
        const overlapWords = words.slice(-Math.min(15, Math.floor(words.length / 3))); // More intelligent overlap
        currentChunk = overlapWords.join(' ') + (overlapWords.length > 0 ? ' ' : '') + punctuatedSentence;
      } else {
        currentChunk = potentialChunk;
      }
    }
    
    // Add the final chunk with reduced threshold
    if (currentChunk.trim().length >= 30) { // Reduced from 150 to 30
      chunks.push(`[Segment ${chunks.length + 1}] ${currentChunk.trim()}`);
      console.log(`[CHUNKING-EDGE] Added final chunk: ${currentChunk.length} chars`);
    } else if (currentChunk.trim().length > 0) {
      // Don't lose any content - create mini-chunk
      chunks.push(`[Final-mini ${chunks.length + 1}] ${currentChunk.trim()}`);
      console.log(`[CHUNKING-EDGE] Created final mini-chunk: ${currentChunk.length} chars`);
    }
  }
  
  // Recovery phase: if we lost too much content, create additional chunks from remaining text
  const processedLength = chunks.reduce((total, chunk) => {
    const cleanChunk = chunk.replace(/^\[(?:Segment|Part|Mini-segment|Final-mini) \d+\]\s*/, '');
    return total + cleanChunk.length;
  }, 0);
  
  const retentionRate = processedLength / text.length;
  console.log(`[CHUNKING-EDGE] Content retention rate: ${(retentionRate * 100).toFixed(1)}% (${processedLength}/${text.length} chars)`);
  
  if (retentionRate < 0.85) { // If we're losing more than 15% of content
    console.log(`[CHUNKING-EDGE] Low retention detected, attempting content recovery...`);
    
    // Find text portions that might have been missed
    const allChunkText = chunks.join(' ').toLowerCase();
    const originalWords = text.toLowerCase().split(/\s+/);
    const missingWords = originalWords.filter(word => 
      word.length > 3 && !allChunkText.includes(word)
    );
    
    if (missingWords.length > 0) {
      // Create recovery chunks from missing content
      const recoveryText = missingWords.join(' ');
      if (recoveryText.length >= 20) {
        chunks.push(`[Recovery ${chunks.length + 1}] Content analysis: ${recoveryText.substring(0, 400)}`);
        console.log(`[CHUNKING-EDGE] Added recovery chunk with ${missingWords.length} missing words`);
      }
    }
  }
  
  // Final filtering with much more lenient criteria
  const finalChunks = chunks.filter(chunk => {
    const cleanChunk = chunk.replace(/^\[(?:Segment|Part|Mini-segment|Final-mini|Recovery) \d+\]\s*/, '');
    return cleanChunk.length >= 20; // Very permissive minimum - reduced from 100 to 20
  });
  
  console.log(`[CHUNKING-EDGE] Final result: ${finalChunks.length} chunks from ${text.length} chars (${chunks.length} initial chunks)`);
  
  // Log chunk distribution for debugging
  const chunkSizes = finalChunks.map(chunk => {
    const cleanChunk = chunk.replace(/^\[(?:Segment|Part|Mini-segment|Final-mini|Recovery) \d+\]\s*/, '');
    return cleanChunk.length;
  });
  
  if (chunkSizes.length > 0) {
    console.log(`[CHUNKING-EDGE] Chunk size distribution: min=${Math.min(...chunkSizes)}, max=${Math.max(...chunkSizes)}, avg=${Math.round(chunkSizes.reduce((a,b) => a+b, 0) / chunkSizes.length)}`);
  }
  
  return finalChunks;
};
