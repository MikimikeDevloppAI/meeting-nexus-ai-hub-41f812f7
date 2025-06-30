
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UnifiedDocumentItem } from "@/types/unified-document";

export const useUnifiedDocuments = () => {
  const [documents, setDocuments] = useState<UnifiedDocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchUnifiedDocuments = async () => {
    try {
      setIsLoading(true);
      
      // Récupérer les documents uploadés
      const { data: uploadedDocs, error: docsError } = await supabase
        .from('uploaded_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (docsError) {
        console.error('Erreur récupération documents:', docsError);
        throw docsError;
      }

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

      if (meetingsError) {
        console.error('Erreur récupération meetings:', meetingsError);
        throw meetingsError;
      }

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

      console.log('Documents unifiés récupérés:', combined.length);
      setDocuments(combined);
    } catch (error) {
      console.error('Error fetching unified documents:', error);
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const forceRefresh = () => {
    console.log('Force refresh triggered with key:', refreshKey + 1);
    setRefreshKey(prev => prev + 1);
  };

  useEffect(() => {
    fetchUnifiedDocuments();
  }, [refreshKey]);

  // Configuration des subscriptions temps réel améliorées
  useEffect(() => {
    console.log('🔄 Setting up comprehensive real-time subscriptions...');
    
    let refreshTimeout: NodeJS.Timeout;
    
    const scheduleRefresh = () => {
      clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => {
        console.log('⚡ Executing scheduled refresh...');
        forceRefresh();
      }, 300); // Délai réduit pour une meilleure réactivité
    };

    // Subscription pour uploaded_documents (création, mise à jour)
    const documentsChannel = supabase
      .channel('unified-documents-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'uploaded_documents'
        },
        (payload) => {
          console.log('📄 Document upload/update:', payload);
          scheduleRefresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meetings'
        },
        (payload) => {
          console.log('🎤 Meeting update:', payload);
          scheduleRefresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents'
        },
        (payload) => {
          console.log('🗂️ Vector document update:', payload);
          // La création d'un document dans la table documents signifie que le traitement est terminé
          scheduleRefresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'document_embeddings'
        },
        (payload) => {
          console.log('🔗 Document embeddings update:', payload);
          // Les embeddings sont créés = document complètement traité
          scheduleRefresh();
        }
      )
      .subscribe();

    return () => {
      console.log('🧹 Cleaning up real-time subscriptions...');
      clearTimeout(refreshTimeout);
      supabase.removeChannel(documentsChannel);
    };
  }, []);

  return { 
    documents, 
    isLoading, 
    refetch: fetchUnifiedDocuments,
    forceRefresh,
    refreshKey
  };
};
