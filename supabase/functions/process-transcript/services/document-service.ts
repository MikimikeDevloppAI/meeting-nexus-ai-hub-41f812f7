
export async function handleDocumentProcessing(
  supabaseClient: any, 
  meetingId: string, 
  cleanedTranscript: string, 
  meetingName: string,
  meetingDate: string,
  chunks: string[]
) {
  console.log('Checking if document already exists for this meeting...');
  const { data: existingDocument, error: checkError } = await supabaseClient
    .from('documents')
    .select('id')
    .eq('metadata->meeting_id', meetingId)
    .eq('type', 'meeting_transcript')
    .maybeSingle();

  if (checkError) {
    console.error('Error checking existing document:', checkError);
  }

  let documentData;
  if (existingDocument) {
    console.log('Document already exists, updating content...');
    const { data: updatedDoc, error: updateError } = await supabaseClient
      .from('documents')
      .update({
        content: cleanedTranscript,
        title: `Transcript - ${meetingName}`,
      })
      .eq('id', existingDocument.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating existing document:', updateError);
      throw new Error('Failed to update existing document');
    }
    documentData = updatedDoc;
  } else {
    console.log('Creating new document for transcript...');
    const { data: newDoc, error: documentError } = await supabaseClient
      .from('documents')
      .insert({
        title: `Transcript - ${meetingName}`,
        type: 'meeting_transcript',
        content: cleanedTranscript,
        metadata: { meeting_id: meetingId, meeting_date: meetingDate }
      })
      .select()
      .single();

    if (documentError) {
      console.error('Error saving document:', documentError);
      throw new Error('Failed to save document for embeddings');
    }
    documentData = newDoc;
  }

  // Handle embeddings if chunks exist
  if (chunks.length > 0) {
    await processEmbeddings(supabaseClient, documentData.id, meetingId, chunks);
  } else {
    console.warn('No chunks created - this might indicate an issue with the chunking logic');
  }

  return documentData;
}

async function processEmbeddings(supabaseClient: any, documentId: string, meetingId: string, chunks: string[]) {
  console.log('Removing existing embeddings for this document...');
  const { error: deleteError } = await supabaseClient
    .from('document_embeddings')
    .delete()
    .eq('document_id', documentId);

  if (deleteError) {
    console.warn('Warning: Could not delete existing embeddings:', deleteError);
  }

  console.log('Generating embeddings...');
  const { data: embeddingsResult, error: embeddingsError } = await supabaseClient.functions.invoke('generate-embeddings', {
    body: { texts: chunks }
  });

  if (embeddingsError) {
    console.error('Error generating embeddings:', embeddingsError);
    throw new Error('Failed to generate embeddings');
  }

  const embeddings = embeddingsResult.embeddings;
  console.log(`Generated ${embeddings.length} embeddings`);

  await saveEmbeddings(supabaseClient, embeddings, chunks, documentId, meetingId);
}

async function saveEmbeddings(
  supabaseClient: any, 
  embeddings: number[][], 
  chunks: string[], 
  documentId: string, 
  meetingId: string
) {
  console.log('Saving embeddings to database...');
  const batchSize = 10;
  
  for (let i = 0; i < embeddings.length; i += batchSize) {
    const batch = [];
    const endIndex = Math.min(i + batchSize, embeddings.length);
    
    for (let j = i; j < endIndex; j++) {
      const embeddingVector = `[${embeddings[j].join(',')}]`;
      
      batch.push({
        document_id: documentId,
        meeting_id: meetingId,
        embedding: embeddingVector,
        chunk_text: chunks[j],
        chunk_index: j,
        type: 'meeting_transcript',
        metadata: { meeting_id: meetingId, chunk_index: j }
      });
    }

    const { error: embeddingError } = await supabaseClient
      .from('document_embeddings')
      .insert(batch);

    if (embeddingError) {
      console.error(`Error saving batch ${i / batchSize + 1}:`, embeddingError);
      throw embeddingError;
    }

    console.log(`Saved batch ${i / batchSize + 1}/${Math.ceil(embeddings.length / batchSize)}`);
  }

  console.log(`Successfully saved all ${embeddings.length} embeddings`);
}
