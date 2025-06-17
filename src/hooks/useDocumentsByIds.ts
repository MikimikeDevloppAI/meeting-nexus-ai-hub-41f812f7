
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
        const unifiedDocuments: UnifiedDocumentItem[] = [];

        // Separate meeting IDs from document IDs based on type mapping
        const meetingIds = documentIds.filter(id => documentTypes[id] === 'meeting');
        const uploadedDocIds = documentIds.filter(id => documentTypes[id] !== 'meeting');

        // Fetch meetings
        if (meetingIds.length > 0) {
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
            .in('id', meetingIds);

          if (meetingsError) {
            console.error('Error fetching meetings:', meetingsError);
          } else {
            meetings?.forEach(meeting => {
              unifiedDocuments.push({
                id: meeting.id,
                type: 'meeting',
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
              });
            });
          }
        }

        // Fetch uploaded documents
        if (uploadedDocIds.length > 0) {
          const { data: documents, error: documentsError } = await supabase
            .from('uploaded_documents')
            .select('*')
            .in('id', uploadedDocIds);

          if (documentsError) {
            console.error('Error fetching uploaded documents:', documentsError);
          } else {
            documents?.forEach(doc => {
              unifiedDocuments.push({
                id: doc.id,
                type: 'document',
                original_name: doc.original_name,
                ai_generated_name: doc.ai_generated_name,
                file_path: doc.file_path,
                file_size: doc.file_size,
                content_type: doc.content_type,
                taxonomy: doc.taxonomy || {},
                ai_summary: doc.ai_summary,
                processed: doc.processed,
                created_at: doc.created_at,
                created_by: doc.created_by,
                extracted_text: doc.extracted_text,
                participants: undefined
              });
            });
          }
        }

        setDocuments(unifiedDocuments);
      } catch (err) {
        console.error('Error fetching documents by IDs:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocuments();
  }, [JSON.stringify(documentIds), JSON.stringify(documentTypes)]);

  return { documents, isLoading, error };
};
