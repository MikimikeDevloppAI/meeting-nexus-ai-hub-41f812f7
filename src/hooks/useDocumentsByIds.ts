
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
        console.log('[useDocumentsByIds] Fetching documents for IDs:', documentIds);
        
        // Try to fetch all IDs as uploaded documents first
        const { data: uploadedDocs, error: docsError } = await supabase
          .from('uploaded_documents')
          .select('*')
          .in('id', documentIds);

        if (docsError) {
          console.error('[useDocumentsByIds] Error fetching uploaded documents:', docsError);
        }

        // Try to fetch all IDs as meetings (with transcript) 
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
          .in('id', documentIds)
          .not('transcript', 'is', null);

        if (meetingsError) {
          console.error('[useDocumentsByIds] Error fetching meetings:', meetingsError);
        }

        const unifiedDocuments: UnifiedDocumentItem[] = [];

        // Transform uploaded documents (exactly like useUnifiedDocuments)
        if (uploadedDocs && uploadedDocs.length > 0) {
          const transformedDocs: UnifiedDocumentItem[] = uploadedDocs.map(doc => ({
            ...doc,
            type: 'document' as const,
          }));
          unifiedDocuments.push(...transformedDocs);
          console.log('[useDocumentsByIds] Found uploaded documents:', transformedDocs.length);
        }

        // Transform meetings (exactly like useUnifiedDocuments)
        if (meetings && meetings.length > 0) {
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
          console.log('[useDocumentsByIds] Found meetings:', transformedMeetings.length);
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
