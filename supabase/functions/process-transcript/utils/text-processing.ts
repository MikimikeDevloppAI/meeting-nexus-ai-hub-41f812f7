
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

// Comprehensive text chunking with complete coverage and sentence boundaries
export const chunkText = (text: string, minChunkSize: number = 300, maxChunkSize: number = 1000): string[] => {
  if (!text || text.trim().length === 0) {
    return [];
  }

  console.log(`[CHUNKING] Processing text of ${text.length} characters with min: ${minChunkSize}, max: ${maxChunkSize}`);
  
  // NOUVEAU: Nettoyer le texte en supprimant les lignes vides et normalisant les espaces
  const cleanedText = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanedText) {
    console.log('[CHUNKING] ⚠️ Text became empty after cleaning');
    return [];
  }

  console.log(`[CHUNKING] Text cleaned: ${text.length} -> ${cleanedText.length} characters`);
  
  const chunks: string[] = [];
  
  // Split by sentences using proper sentence endings
  const sentences = cleanedText.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  let currentChunk = '';
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;
    
    const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + trimmedSentence;
    
    // If adding this sentence would exceed max size and current chunk meets min size
    if (potentialChunk.length > maxChunkSize && currentChunk.length >= minChunkSize) {
      chunks.push(`[Segment ${chunks.length + 1}] ${currentChunk.trim()}`);
      console.log(`[CHUNKING] Created chunk ${chunks.length}: ${currentChunk.length} chars`);
      currentChunk = trimmedSentence;
    } else {
      currentChunk = potentialChunk;
    }
  }
  
  // CRUCIAL: Handle the final chunk to ensure complete text coverage
  if (currentChunk.trim().length > 0) {
    if (currentChunk.trim().length >= minChunkSize) {
      chunks.push(`[Segment ${chunks.length + 1}] ${currentChunk.trim()}`);
      console.log(`[CHUNKING] Created final chunk: ${currentChunk.length} chars`);
    } else if (chunks.length > 0) {
      // Try to merge with previous chunk if possible
      const lastChunk = chunks[chunks.length - 1];
      const content = lastChunk.replace(/^\[Segment \d+\]\s*/, '');
      const mergedContent = content + ' ' + currentChunk.trim();
      
      if (mergedContent.length <= maxChunkSize) {
        chunks[chunks.length - 1] = `[Segment ${chunks.length}] ${mergedContent}`;
        console.log(`[CHUNKING] Merged final chunk with previous: ${mergedContent.length} chars`);
      } else {
        // Keep as separate chunk even if small to avoid text loss
        chunks.push(`[Final-segment ${chunks.length + 1}] ${currentChunk.trim()}`);
        console.log(`[CHUNKING] Kept small final chunk to avoid text loss: ${currentChunk.length} chars`);
      }
    } else {
      // If this is the only chunk, keep it regardless of size
      chunks.push(`[Single-segment] ${currentChunk.trim()}`);
      console.log(`[CHUNKING] Single chunk (ensuring no text loss): ${currentChunk.length} chars`);
    }
  }
  
  // Verify complete text coverage
  const totalChunkText = chunks.map(chunk => {
    return chunk.replace(/^\[(?:Segment|Final-segment|Single-segment).*?\]\s*/, '');
  }).join(' ');
  
  const originalText = cleanedText; // Utiliser le texte nettoyé comme référence
  const coverageRatio = totalChunkText.length / originalText.length;
  
  if (coverageRatio < 0.95) { // Less than 95% coverage indicates potential text loss
    console.warn(`[CHUNKING] ⚠️ Potential text loss detected: ${(coverageRatio * 100).toFixed(1)}% coverage`);
  }
  
  // Log final statistics with coverage verification
  const chunkSizes = chunks.map(chunk => {
    const cleanChunk = chunk.replace(/^\[(?:Segment|Final-segment|Single-segment).*?\]\s*/, '');
    return cleanChunk.length;
  });
  
  const avgSize = chunkSizes.length > 0 ? Math.round(chunkSizes.reduce((a,b) => a+b, 0) / chunkSizes.length) : 0;
  
  console.log(`[CHUNKING] Final result: ${chunks.length} chunks with complete coverage`);
  console.log(`[CHUNKING] Size distribution: min=${Math.min(...chunkSizes)}, max=${Math.max(...chunkSizes)}, avg=${avgSize}`);
  console.log(`[CHUNKING] Text coverage: ${(coverageRatio * 100).toFixed(1)}% of cleaned text preserved`);
  
  return chunks;
};
