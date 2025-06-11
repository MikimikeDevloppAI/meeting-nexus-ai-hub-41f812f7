
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UnifiedDocumentItem } from "@/types/unified-document";

export const useUnifiedDocuments = () => {
  const [documents, setDocuments] = useState<UnifiedDocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUnifiedDocuments = async () => {
    try {
      // Récupérer les documents uploadés
      const { data: uploadedDocs, error: docsError } = await supabase
        .from('uploaded_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (docsError) throw docsError;

      // Récupérer les meetings avec transcript
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
        .not('transcript', 'is', null)
        .order('created_at', { ascending: false });

      if (meetingsError) throw meetingsError;

      // Transformer les documents uploadés
      const transformedDocs: UnifiedDocumentItem[] = (uploadedDocs || []).map(doc => ({
        ...doc,
        type: 'document' as const,
      }));

      // Transformer les meetings en documents
      const transformedMeetings: UnifiedDocumentItem[] = (meetings || []).map(meeting => ({
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

      // Combiner et trier par date de création
      const combined = [...transformedDocs, ...transformedMeetings].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setDocuments(combined);
    } catch (error) {
      console.error('Error fetching unified documents:', error);
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUnifiedDocuments();
  }, []);

  return { documents, isLoading, refetch: fetchUnifiedDocuments };
};
