
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UnifiedDocumentItem } from "@/types/unified-document";

interface UseDocumentsByIdsProps {
  documentIds: string[];
  documentTypes?: Record<string, string>; // documentId -> type mapping
}

export const useDocumentsByIds = ({ documentIds, documentTypes = {} }: UseDocumentsByIdsProps) => {
  const [documents, setDocuments] = useState<UnifiedDocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (documentIds.length === 0) {
      setDocuments([]);
      return;
    }

    const fetchDocuments = async () => {
      setIsLoading(true);
      setError(null);

      try {
        console.log('[useDocumentsByIds] Fetching bridge documents for IDs:', documentIds);
        
        // Étape 1: Récupérer les enregistrements de la table documents (pont)
        const { data: bridgeDocuments, error: bridgeError } = await supabase
          .from('documents')
          .select('*')
          .in('id', documentIds);

        if (bridgeError) {
          console.error('[useDocumentsByIds] Error fetching bridge documents:', bridgeError);
          throw bridgeError;
        }

        console.log('[useDocumentsByIds] Found bridge documents:', bridgeDocuments?.length || 0);

        if (!bridgeDocuments || bridgeDocuments.length === 0) {
          setDocuments([]);
          return;
        }

        // Étape 2: Analyser les métadonnées pour extraire les IDs sources
        const uploadedDocumentIds: string[] = [];
        const meetingIds: string[] = [];
        const bridgeMap = new Map();

        bridgeDocuments.forEach(doc => {
          bridgeMap.set(doc.id, doc);
          
          if (doc.type === 'uploaded_document' && doc.metadata?.documentId) {
            uploadedDocumentIds.push(doc.metadata.documentId);
            console.log('[useDocumentsByIds] Found uploaded document ID:', doc.metadata.documentId);
          } else if (doc.type === 'meeting_transcript' && doc.metadata?.meetingId) {
            meetingIds.push(doc.metadata.meetingId);
            console.log('[useDocumentsByIds] Found meeting ID:', doc.metadata.meetingId);
          }
        });

        const unifiedDocuments: UnifiedDocumentItem[] = [];

        // Étape 3: Récupérer les documents uploadés avec leurs vraies données
        if (uploadedDocumentIds.length > 0) {
          console.log('[useDocumentsByIds] Fetching uploaded documents:', uploadedDocumentIds);
          
          const { data: uploadedDocs, error: docsError } = await supabase
            .from('uploaded_documents')
            .select('*')
            .in('id', uploadedDocumentIds);

          if (docsError) {
            console.error('[useDocumentsByIds] Error fetching uploaded documents:', docsError);
          } else if (uploadedDocs && uploadedDocs.length > 0) {
            // Transformer les documents uploadés (exactement comme useUnifiedDocuments)
            const transformedDocs: UnifiedDocumentItem[] = uploadedDocs.map(doc => ({
              ...doc,
              type: 'document' as const,
            }));
            unifiedDocuments.push(...transformedDocs);
            console.log('[useDocumentsByIds] Transformed uploaded documents:', transformedDocs.length);
          }
        }

        // Étape 4: Récupérer les meetings avec leurs vraies données
        if (meetingIds.length > 0) {
          console.log('[useDocumentsByIds] Fetching meetings:', meetingIds);
          
          const { data: meetings, error: meetingsError } = await supabase
            .from('meetings')
            .select(`
              *,
              meeting_participants (
                participants (
                  name,
                  email
                )
              )
            `)
            .in('id', meetingIds)
            .not('transcript', 'is', null);

          if (meetingsError) {
            console.error('[useDocumentsByIds] Error fetching meetings:', meetingsError);
          } else if (meetings && meetings.length > 0) {
            // Transformer les meetings (exactement comme useUnifiedDocuments)
            const transformedMeetings: UnifiedDocumentItem[] = meetings.map(meeting => ({
              id: meeting.id,
              type: 'meeting' as const,
              original_name: meeting.title,
              ai_generated_name: meeting.title,
              file_path: undefined,
              file_size: null,
              content_type: 'audio/meeting',
              taxonomy: {
                category: "Meeting",
                subcategory: "Réunion transcrite",
                keywords: ["meeting", "réunion", "transcript"],
                documentType: "Réunion transcrite"
              },
              ai_summary: meeting.summary,
              processed: !!meeting.transcript,
              created_at: meeting.created_at,
              created_by: meeting.created_by,
              extracted_text: meeting.transcript,
              meeting_id: meeting.id,
              audio_url: meeting.audio_url,
              transcript: meeting.transcript,
              summary: meeting.summary,
              participants: meeting.meeting_participants?.map((mp: any) => mp.participants) || []
            }));
            unifiedDocuments.push(...transformedMeetings);
            console.log('[useDocumentsByIds] Transformed meetings:', transformedMeetings.length);
          }
        }

        console.log('[useDocumentsByIds] Total unified documents found:', unifiedDocuments.length);
        setDocuments(unifiedDocuments);

      } catch (err) {
        console.error('[useDocumentsByIds] Error fetching documents:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocuments();
  }, [JSON.stringify(documentIds), JSON.stringify(documentTypes)]);

  return { documents, isLoading, error };
};
