
import { createSupabaseClient } from './database-service.ts'

export async function handleDocumentProcessing(
  supabaseClient: any,
  meetingId: string,
  cleanedTranscript: string,
  meetingName: string,
  meetingDate: string,
  chunks: string[]
) {
  console.log(`[DOCUMENT] Processing document for meeting: ${meetingId}`);
  console.log(`[DOCUMENT] Created ${chunks.length} chunks for embeddings`);

  try {
    // NOUVEAU: Nettoyer les chunks avant l'embedding - supprimer les lignes vides
    const cleanedChunks = chunks
      .map(chunk => {
        // Supprimer les lignes vides et normaliser les espaces
        return chunk
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
      })
      .filter(chunk => chunk.length > 0); // Supprimer les chunks complètement vides

    console.log(`[DOCUMENT] Cleaned chunks: ${chunks.length} -> ${cleanedChunks.length} (removed empty content)`);

    if (cleanedChunks.length === 0) {
      console.warn('[DOCUMENT] ⚠️ No valid chunks after cleaning - skipping embedding generation');
      return {
        id: meetingId,
        chunksCount: 0,
        error: 'No valid content for embedding generation'
      };
    }

    // Générer les embeddings via l'API dédiée
    console.log('[DOCUMENT] 🔄 Génération des embeddings...');
    const embeddingResponse = await fetch('https://ecziljpkvshvapjsxaty.supabase.co/functions/v1/generate-embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjemlsanBrdnNodmFwanN4YXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MTg0ODIsImV4cCI6MjA2MjE5NDQ4Mn0.oRJVDFdTSmUS15nM7BKwsjed0F_S5HeRfviPIdQJkUk`,
      },
      body: JSON.stringify({
        texts: cleanedChunks
      }),
    });

    if (!embeddingResponse.ok) {
      const errorText = await embeddingResponse.text();
      console.error('[DOCUMENT] ❌ Erreur génération embeddings:', errorText);
      throw new Error(`Failed to generate embeddings: ${errorText}`);
    }

    const embeddingData = await embeddingResponse.json();
    const embeddings = embeddingData.embeddings;
    
    console.log(`[DOCUMENT] ✅ ${embeddings.length} embeddings générés`);

    // NOUVEAU: Améliorer le nommage du document avec plus de contexte significatif
    const keywords = extractKeywords(cleanedTranscript);
    const participantInfo = extractParticipantInfo(cleanedTranscript);
    const topicInfo = extractTopicInfo(cleanedTranscript);
    
    // Construire un titre enrichi avec contexte métier
    let enhancedTitle = `${meetingName} - ${meetingDate}`;
    
    // Ajouter les informations de participants si disponibles
    if (participantInfo) {
      enhancedTitle += ` (${participantInfo})`;
    }
    
    // Ajouter les sujets principaux si identifiés
    if (topicInfo) {
      enhancedTitle += ` - ${topicInfo}`;
    }
    
    // Ajouter des mots-clés pour différencier
    if (keywords.length > 0) {
      enhancedTitle += ` [${keywords.slice(0, 3).join(', ')}]`;
    }

    // Sauvegarder le document avec embeddings
    const { data: documentResult, error: storeError } = await supabaseClient.rpc(
      'store_document_with_embeddings',
      {
        p_title: enhancedTitle,
        p_type: 'meeting_transcript',
        p_content: cleanedTranscript,
        p_chunks: cleanedChunks,
        p_embeddings: embeddings.map((emb: number[]) => `[${emb.join(',')}]`),
        p_metadata: {
          meetingId: meetingId,
          meetingName: meetingName,
          meetingDate: meetingDate,
          chunkCount: cleanedChunks.length,
          originalChunkCount: chunks.length,
          keywords: keywords,
          participantInfo: participantInfo,
          topicInfo: topicInfo,
          processedAt: new Date().toISOString()
        },
        p_meeting_id: meetingId
      }
    );

    if (storeError) {
      console.error('[DOCUMENT] ❌ Erreur sauvegarde document:', storeError);
      throw new Error(`Failed to store document: ${storeError.message}`);
    }

    console.log('[DOCUMENT] ✅ Document et embeddings sauvegardés avec succès');

    return {
      id: documentResult || meetingId,
      chunksCount: cleanedChunks.length
    };

  } catch (error) {
    console.error('[DOCUMENT] ❌ Erreur processing document:', error);
    // Return default values to not break the main flow
    return {
      id: meetingId,
      chunksCount: chunks.length,
      error: error.message
    };
  }
}

// NOUVEAU: Fonction pour extraire des mots-clés significatifs du contenu
function extractKeywords(text: string): string[] {
  if (!text || text.length === 0) return [];
  
  // Mots vides à ignorer
  const stopWords = new Set([
    'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou', 'mais', 'donc', 'car', 'ni',
    'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles', 'ce', 'cette', 'ces',
    'que', 'qui', 'quoi', 'dont', 'où', 'quand', 'comment', 'pourquoi',
    'dans', 'sur', 'sous', 'avec', 'sans', 'pour', 'par', 'vers', 'chez', 'entre',
    'est', 'sont', 'était', 'étaient', 'sera', 'seront', 'avoir', 'être',
    'très', 'plus', 'moins', 'bien', 'mal', 'tout', 'tous', 'toute', 'toutes',
    'alors', 'aussi', 'ainsi', 'donc', 'puis', 'ensuite', 'enfin'
  ]);
  
  // Extraire les mots significatifs (plus de 3 caractères, pas dans les stop words)
  const words = text.toLowerCase()
    .replace(/[^\w\sàâäéèêëïîôöùûüÿç]/g, ' ')
    .split(/\s+/)
    .filter(word => 
      word.length > 3 && 
      !stopWords.has(word) &&
      !/^\d+$/.test(word) // Exclure les nombres purs
    );
  
  // Compter les occurrences
  const wordCount = words.reduce((acc, word) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // Retourner les mots les plus fréquents
  return Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(entry => entry[0]);
}

// NOUVEAU: Fonction pour extraire des informations sur les participants
function extractParticipantInfo(text: string): string | null {
  const lowerText = text.toLowerCase();
  
  // Rechercher des noms propres ou des rôles
  const participantPatterns = [
    /\b(dr|docteur|professeur|pr)\s+([a-zàâäéèêëïîôöùûüÿç]+)/gi,
    /\b([a-zàâäéèêëïîôöùûüÿç]{3,})\s+(dit|a dit|propose|suggère)/gi,
    /\bémilie\b/gi,
    /\btabibian\b/gi
  ];
  
  const participants = new Set<string>();
  
  for (const pattern of participantPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && match[2]) {
        participants.add(`${match[1]} ${match[2]}`);
      } else if (match[1]) {
        participants.add(match[1]);
      }
    }
  }
  
  if (participants.size > 0) {
    return Array.from(participants).slice(0, 2).join(', ');
  }
  
  return null;
}

// NOUVEAU: Fonction pour extraire des informations sur les sujets principaux
function extractTopicInfo(text: string): string | null {
  const lowerText = text.toLowerCase();
  
  // Identifier les sujets principaux
  const topics = [];
  
  if (lowerText.includes('planning') || lowerText.includes('organisation')) {
    topics.push('Planning');
  }
  
  if (lowerText.includes('patient') || lowerText.includes('consultation')) {
    topics.push('Consultations');
  }
  
  if (lowerText.includes('ophtalmologie') || lowerText.includes('œil') || lowerText.includes('vision')) {
    topics.push('Ophtalmologie');
  }
  
  if (lowerText.includes('budget') || lowerText.includes('finance') || lowerText.includes('coût')) {
    topics.push('Finances');
  }
  
  if (lowerText.includes('équipe') || lowerText.includes('personnel') || lowerText.includes('ressources')) {
    topics.push('Équipe');
  }
  
  if (lowerText.includes('urgence') || lowerText.includes('urgent')) {
    topics.push('Urgences');
  }
  
  if (topics.length > 0) {
    return topics.slice(0, 2).join(' & ');
  }
  
  return null;
}
